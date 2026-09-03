import Warranty from '../models/Warranty.js';
import SerialNumber from '../models/SerialNumber.js';
import ServiceRequest from '../models/ServiceRequest.js';

// Helper to update warranty status based on dates
const recalculateStatus = (warranty) => {
  if (!warranty.endDate) return warranty.status;
  const now = new Date();
  const expiry = new Date(warranty.endDate);
  const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'Expired';
  if (diffDays <= 30) return 'Expiring Soon';
  return 'Active';
};

// GET /api/warranties — List warranty records with filtering & KPIs
export const getWarranties = async (req, res) => {
  try {
    const { status, coverageType, isAmc, search, page = 1, limit = 50 } = req.query;
    const query = {};

    if (status && status !== 'All') {
      query.status = status;
    }
    if (coverageType && coverageType !== 'All') {
      query.coverageType = coverageType;
    }
    if (isAmc !== undefined && isAmc !== 'All') {
      query['amc.isAmc'] = isAmc === 'true';
    }
    if (search) {
      query.$or = [
        { warrantyNo: { $regex: search, $options: 'i' } },
        { serialNo: { $regex: search, $options: 'i' } },
        { 'product.name': { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } },
        { invoiceRef: { $regex: search, $options: 'i' } }
      ];
    }

    const warranties = await Warranty.find(query)
      .sort({ endDate: 1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await Warranty.countDocuments(query);

    // Dynamic refresh of statuses and global KPIs
    const allWarranties = await Warranty.find();
    let activeCount = 0;
    let expiringSoonCount = 0;
    let expiredCount = 0;
    let amcCount = 0;

    allWarranties.forEach(w => {
      const currentStatus = recalculateStatus(w);
      if (currentStatus === 'Active') activeCount++;
      if (currentStatus === 'Expiring Soon') expiringSoonCount++;
      if (currentStatus === 'Expired') expiredCount++;
      if (w.amc && w.amc.isAmc) amcCount++;
    });

    const serialCount = await SerialNumber.countDocuments();

    res.json({
      success: true,
      warranties,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit))
      },
      kpis: {
        total: allWarranties.length,
        active: activeCount + expiringSoonCount,
        expiringSoon: expiringSoonCount,
        expired: expiredCount,
        amc: amcCount,
        totalSerials: serialCount
      }
    });
  } catch (error) {
    console.error('Error in getWarranties:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch warranties', error: error.message });
  }
};

// GET /api/warranties/:id — Single warranty detail with linked service cases
export const getWarranty = async (req, res) => {
  try {
    const { id } = req.params;
    const warranty = await Warranty.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { warrantyNo: id }, { serialNo: id }]
    });

    if (!warranty) {
      return res.status(404).json({ success: false, message: 'Warranty record not found' });
    }

    // Also fetch service requests for this serial
    const serviceJobs = await ServiceRequest.find({ serialNo: warranty.serialNo }).sort({ createdAt: -1 });

    res.json({
      success: true,
      warranty: {
        ...warranty.toObject(),
        serviceJobs
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch warranty', error: error.message });
  }
};

// GET /api/warranties/check/:serialNo — Quick warranty lookup by serial number
export const checkSerialWarranty = async (req, res) => {
  try {
    const { serialNo } = req.params;
    if (!serialNo) {
      return res.status(400).json({ success: false, message: 'Serial number is required' });
    }

    const cleanSerial = serialNo.trim();
    const warranty = await Warranty.findOne({ serialNo: cleanSerial });
    const serialInfo = await SerialNumber.findOne({ serialNo: cleanSerial });

    if (warranty) {
      const now = new Date();
      const expiry = new Date(warranty.endDate);
      const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
      const isUnderWarranty = diffDays > 0;

      return res.json({
        success: true,
        found: true,
        underWarranty: isUnderWarranty,
        daysRemaining: Math.max(0, diffDays),
        status: recalculateStatus(warranty),
        warranty,
        serialInfo
      });
    }

    if (serialInfo) {
      const now = new Date();
      const expiry = serialInfo.warrantyEnd ? new Date(serialInfo.warrantyEnd) : null;
      const diffDays = expiry ? Math.ceil((expiry - now) / (1000 * 60 * 60 * 24)) : 0;
      const isUnderWarranty = diffDays > 0;

      return res.json({
        success: true,
        found: true,
        underWarranty: isUnderWarranty,
        daysRemaining: Math.max(0, diffDays),
        status: isUnderWarranty ? (diffDays <= 30 ? 'Expiring Soon' : 'Active') : 'Expired',
        serialInfo
      });
    }

    res.json({
      success: true,
      found: false,
      underWarranty: false,
      message: 'No warranty or serial record found'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to verify serial number', error: error.message });
  }
};

// POST /api/warranties — Register new warranty
export const createWarranty = async (req, res) => {
  try {
    const {
      serialNo,
      product,
      customer,
      invoiceRef = '',
      startDate = new Date(),
      durationMonths = 12,
      coverageType = 'Standard Manufacturer',
      terms
    } = req.body;

    if (!serialNo) {
      return res.status(400).json({ success: false, message: 'Serial number is required' });
    }
    if (!product || !product.name) {
      return res.status(400).json({ success: false, message: 'Product name is required' });
    }
    if (!customer || !customer.name) {
      return res.status(400).json({ success: false, message: 'Customer name is required' });
    }

    const start = new Date(startDate);
    const end = new Date(start);
    end.setMonth(end.getMonth() + Number(durationMonths));

    const warranty = new Warranty({
      serialNo: serialNo.trim(),
      product,
      customer,
      invoiceRef,
      startDate: start,
      endDate: end,
      durationMonths: Number(durationMonths) || 12,
      coverageType,
      terms: terms || undefined
    });

    await warranty.save();

    // Update SerialNumber warrantyEnd if exists
    await SerialNumber.findOneAndUpdate(
      { serialNo: serialNo.trim() },
      {
        warrantyEnd: end,
        'customer.id': customer.id,
        'customer.name': customer.name,
        invoiceRef
      }
    );

    res.status(201).json({
      success: true,
      message: 'Warranty registered successfully',
      warranty
    });
  } catch (error) {
    console.error('Error creating warranty:', error);
    res.status(400).json({ success: false, message: 'Failed to create warranty', error: error.message });
  }
};

// PUT /api/warranties/:id — Update warranty
export const updateWarranty = async (req, res) => {
  try {
    const { id } = req.params;
    const warranty = await Warranty.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { warrantyNo: id }, { serialNo: id }]
    });

    if (!warranty) {
      return res.status(404).json({ success: false, message: 'Warranty record not found' });
    }

    Object.assign(warranty, req.body);
    warranty.status = recalculateStatus(warranty);
    await warranty.save();

    res.json({
      success: true,
      message: 'Warranty updated successfully',
      warranty
    });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Failed to update warranty', error: error.message });
  }
};

// POST /api/warranties/:id/renew-amc — Convert or extend warranty into an AMC contract
export const renewWarrantyAMC = async (req, res) => {
  try {
    const { id } = req.params;
    const { contractNo, amcValue, extensionMonths = 12 } = req.body;

    const warranty = await Warranty.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { warrantyNo: id }, { serialNo: id }]
    });

    if (!warranty) {
      return res.status(404).json({ success: false, message: 'Warranty record not found' });
    }

    // Extend from current endDate or now, whichever is later
    const baseDate = new Date(warranty.endDate) > new Date() ? new Date(warranty.endDate) : new Date();
    const newEnd = new Date(baseDate);
    newEnd.setMonth(newEnd.getMonth() + Number(extensionMonths));

    warranty.endDate = newEnd;
    warranty.coverageType = 'AMC';
    warranty.status = 'Active';
    warranty.amc = {
      isAmc: true,
      contractNo: contractNo || `AMC-${Date.now().toString().slice(-6)}`,
      value: Number(amcValue) || 0,
      renewalDate: new Date()
    };

    await warranty.save();

    // Update serial number
    await SerialNumber.findOneAndUpdate(
      { serialNo: warranty.serialNo },
      { warrantyEnd: newEnd }
    );

    res.json({
      success: true,
      message: 'Warranty successfully converted/renewed as AMC contract',
      warranty
    });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Failed to renew AMC', error: error.message });
  }
};

// DELETE /api/warranties/:id — Delete warranty
export const deleteWarranty = async (req, res) => {
  try {
    const { id } = req.params;
    const warranty = await Warranty.findOneAndDelete({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { warrantyNo: id }]
    });

    if (!warranty) {
      return res.status(404).json({ success: false, message: 'Warranty not found' });
    }

    res.json({ success: true, message: 'Warranty deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete warranty', error: error.message });
  }
};
