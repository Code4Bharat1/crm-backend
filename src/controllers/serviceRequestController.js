import ServiceRequest from '../models/ServiceRequest.js';
import Warranty from '../models/Warranty.js';
import SerialNumber from '../models/SerialNumber.js';
import Employee from '../models/Employee.js';
import Notification from '../models/Notification.js';

// GET /api/service-requests — List service requests with filtering & KPIs
export const getServiceRequests = async (req, res) => {
  try {
    const { status, priority, underWarranty, search, page = 1, limit = 50 } = req.query;
    const query = {};

    if (status && status !== 'All') {
      query.status = status;
    }
    if (priority && priority !== 'All') {
      query.priority = priority;
    }
    if (underWarranty !== undefined && underWarranty !== 'All') {
      query.underWarranty = underWarranty === 'true';
    }
    if (search) {
      query.$or = [
        { requestId: { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } },
        { productName: { $regex: search, $options: 'i' } },
        { serialNo: { $regex: search, $options: 'i' } },
        { issue: { $regex: search, $options: 'i' } },
        { 'engineer.name': { $regex: search, $options: 'i' } }
      ];
    }

    const requests = await ServiceRequest.find(query)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await ServiceRequest.countDocuments(query);

    // Global KPIs
    const allRequests = await ServiceRequest.find();
    const openCount = allRequests.filter(r => ['New', 'Assigned', 'In Progress', 'On Hold'].includes(r.status)).length;
    const underWarrantyCount = allRequests.filter(r => r.underWarranty).length;
    const resolvedCount = allRequests.filter(r => ['Resolved', 'Closed'].includes(r.status)).length;
    const totalServiceCharges = allRequests.reduce((sum, r) => sum + (Number(r.serviceCharges) || 0), 0);
    const totalPartsCost = allRequests.reduce((sum, r) => sum + (Number(r.partsCost) || 0), 0);
    const totalTravelCost = allRequests.reduce((sum, r) => sum + (Number(r.travelCost) || 0), 0);
    const totalEngineerHours = allRequests.reduce((sum, r) => sum + (Number(r.engineerHours) || 0), 0);

    res.json({
      success: true,
      requests,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit))
      },
      kpis: {
        total: allRequests.length,
        open: openCount,
        underWarranty: underWarrantyCount,
        resolved: resolvedCount,
        serviceRevenue: totalServiceCharges,
        partsCost: totalPartsCost,
        travelCost: totalTravelCost,
        engineerHours: totalEngineerHours
      }
    });
  } catch (error) {
    console.error('Error in getServiceRequests:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch service requests', error: error.message });
  }
};

// GET /api/service-requests/:id — Single service request
export const getServiceRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await ServiceRequest.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { requestId: id }]
    });

    if (!request) {
      return res.status(404).json({ success: false, message: 'Service request not found' });
    }

    res.json({ success: true, request });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch service request', error: error.message });
  }
};

// POST /api/service-requests — Create service request with auto warranty lookup
export const createServiceRequest = async (req, res) => {
  try {
    const {
      customer,
      project,
      productName,
      serialNo,
      issue,
      description,
      type = 'Breakdown / Repair',
      priority = 'Medium',
      engineer,
      scheduledOn,
      serviceCharges = 0,
      partsCost = 0,
      travelCost = 0
    } = req.body;

    if (!issue) {
      return res.status(400).json({ success: false, message: 'Issue title is required' });
    }
    if (!customer || !customer.name) {
      return res.status(400).json({ success: false, message: 'Customer name is required' });
    }

    let isUnderWarranty = false;
    let warrantyRef = '';

    // Check warranty status if serialNo provided
    if (serialNo) {
      const warranty = await Warranty.findOne({ serialNo: serialNo.trim() });
      if (warranty && warranty.endDate && new Date(warranty.endDate) > new Date()) {
        isUnderWarranty = true;
        warrantyRef = warranty.warrantyNo;
      } else {
        // Fallback check on SerialNumber model
        const sn = await SerialNumber.findOne({ serialNo: serialNo.trim() });
        if (sn && sn.warrantyEnd && new Date(sn.warrantyEnd) > new Date()) {
          isUnderWarranty = true;
        }
      }
    }

    const serviceRequest = new ServiceRequest({
      customer,
      project: project || { id: '', name: '' },
      productName: productName || 'Equipment',
      serialNo: serialNo ? serialNo.trim() : '',
      issue,
      description: description || '',
      type,
      priority,
      status: engineer && engineer.name ? 'Assigned' : 'New',
      underWarranty: req.body.underWarranty !== undefined ? req.body.underWarranty : isUnderWarranty,
      warrantyRef,
      engineer: engineer || { id: '', name: 'Unassigned', phone: '' },
      scheduledOn: scheduledOn || null,
      serviceCharges: isUnderWarranty ? 0 : Number(serviceCharges) || 0,
      partsCost: Number(partsCost) || 0,
      travelCost: Number(travelCost) || 0
    });

    await serviceRequest.save();

    // Increment service count on SerialNumber if present
    if (serialNo) {
      await SerialNumber.findOneAndUpdate(
        { serialNo: serialNo.trim() },
        { $inc: { serviceCount: 1 } }
      );
      await Warranty.findOneAndUpdate(
        { serialNo: serialNo.trim() },
        { $inc: { serviceCount: 1 } }
      );
    }

    // Trigger Notification for the assigned Technician / Engineer
    if (serviceRequest.engineer?.name && serviceRequest.engineer.name !== 'Unassigned') {
      try {
        const emp = await Employee.findOne({
          $or: [
            { fullName: { $regex: `^${serviceRequest.engineer.name.trim()}$`, $options: 'i' } },
            { firstName: { $regex: `^${serviceRequest.engineer.name.trim()}$`, $options: 'i' } }
          ]
        });

        const scheduledStr = serviceRequest.scheduledOn 
          ? new Date(serviceRequest.scheduledOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
          : 'Immediate / Pending';

        await Notification.create({
          recipient: serviceRequest.engineer.name,
          recipientEmail: emp?.email || '',
          recipientRole: emp?.role || 'Technician',
          title: `Service Request Assigned: ${serviceRequest.requestId}`,
          detail: `You have been assigned to service ticket ${serviceRequest.requestId} (${serviceRequest.issue}) for ${serviceRequest.customer?.name || 'Customer'}. Equipment: ${serviceRequest.productName}${serviceRequest.serialNo ? ` (SN: ${serviceRequest.serialNo})` : ''}. Priority: ${serviceRequest.priority}. Scheduled: ${scheduledStr}.`,
          type: 'Service',
          severity: serviceRequest.priority === 'Urgent' ? 'danger' : serviceRequest.priority === 'High' ? 'warning' : 'info',
          link: '/service',
          projectId: serviceRequest.project?.id || '',
          projectName: serviceRequest.project?.name || '',
          customerName: serviceRequest.customer?.name || '',
          revenue: serviceRequest.serviceCharges || 0,
          read: false,
          at: new Date()
        });
        console.log(`🔔 [Notification] Service assignment notification created for Technician: ${serviceRequest.engineer.name}`);
      } catch (notifErr) {
        console.error('⚠️ [Notification] Failed to create service assignment notification:', notifErr);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Service request logged successfully',
      request: serviceRequest
    });
  } catch (error) {
    console.error('Error creating service request:', error);
    res.status(400).json({ success: false, message: 'Failed to create service request', error: error.message });
  }
};

// PUT /api/service-requests/:id — Update service request
export const updateServiceRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await ServiceRequest.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { requestId: id }]
    });

    if (!request) {
      return res.status(404).json({ success: false, message: 'Service request not found' });
    }

    const oldEngineer = request.engineer?.name;
    Object.assign(request, req.body);

    if (req.body.status === 'Resolved' && !request.resolvedOn) {
      request.resolvedOn = new Date();
    }

    await request.save();

    // Trigger notification if engineer is newly assigned or changed
    if (request.engineer?.name && request.engineer.name !== 'Unassigned' && request.engineer.name !== oldEngineer) {
      try {
        const emp = await Employee.findOne({
          $or: [
            { fullName: { $regex: `^${request.engineer.name.trim()}$`, $options: 'i' } },
            { firstName: { $regex: `^${request.engineer.name.trim()}$`, $options: 'i' } }
          ]
        });

        await Notification.create({
          recipient: request.engineer.name,
          recipientEmail: emp?.email || '',
          recipientRole: emp?.role || 'Technician',
          title: `Service Request Reassigned: ${request.requestId}`,
          detail: `You have been assigned to service ticket ${request.requestId} (${request.issue}) for ${request.customer?.name || 'Customer'}. Priority: ${request.priority}.`,
          type: 'Service',
          severity: request.priority === 'Urgent' ? 'danger' : 'info',
          link: '/service',
          projectId: request.project?.id || '',
          projectName: request.project?.name || '',
          customerName: request.customer?.name || '',
          revenue: request.serviceCharges || 0,
          read: false,
          at: new Date()
        });
        console.log(`🔔 [Notification] Service reassignment notification created for Technician: ${request.engineer.name}`);
      } catch (notifErr) {
        console.error('⚠️ [Notification] Failed to create service reassignment notification:', notifErr);
      }
    }

    res.json({
      success: true,
      message: 'Service request updated successfully',
      request
    });
  } catch (error) {
    console.error('Error updating service request:', error);
    res.status(400).json({ success: false, message: 'Failed to update service request', error: error.message });
  }
};

// DELETE /api/service-requests/:id — Delete service request
export const deleteServiceRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await ServiceRequest.findOneAndDelete({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { requestId: id }]
    });

    if (!request) {
      return res.status(404).json({ success: false, message: 'Service request not found' });
    }

    res.json({ success: true, message: 'Service request deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete request', error: error.message });
  }
};

// POST /api/service-requests/:id/resolve — Complete & resolve ticket with parts and billing
export const resolveServiceRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolutionNotes, engineerHours, partsCost, travelCost, serviceCharges, partsUsed } = req.body;

    const request = await ServiceRequest.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { requestId: id }]
    });

    if (!request) {
      return res.status(404).json({ success: false, message: 'Service request not found' });
    }

    request.status = 'Resolved';
    request.resolvedOn = new Date();
    request.resolutionNotes = resolutionNotes || request.resolutionNotes;
    if (engineerHours !== undefined) request.engineerHours = Number(engineerHours) || 0;
    if (partsCost !== undefined) request.partsCost = Number(partsCost) || 0;
    if (travelCost !== undefined) request.travelCost = Number(travelCost) || 0;
    if (serviceCharges !== undefined) request.serviceCharges = Number(serviceCharges) || 0;
    if (partsUsed && Array.isArray(partsUsed)) request.partsUsed = partsUsed;

    await request.save();

    // If under warranty, record a claim on the Warranty record
    if (request.underWarranty && request.serialNo) {
      await Warranty.findOneAndUpdate(
        { serialNo: request.serialNo },
        {
          $push: {
            claims: {
              claimId: `CLM-${Date.now().toString().slice(-6)}`,
              date: new Date(),
              serviceRequestId: request.requestId,
              description: request.issue,
              amount: (Number(request.partsCost) || 0) + (Number(request.travelCost) || 0),
              status: 'Approved'
            }
          }
        }
      );
    }

    res.json({
      success: true,
      message: 'Service request marked as resolved',
      request
    });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Failed to resolve service request', error: error.message });
  }
};
