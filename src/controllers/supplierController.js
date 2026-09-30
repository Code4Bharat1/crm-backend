import Supplier from '../models/Supplier.js';

// Generate next supplier code
const generateSupplierCode = async () => {
  const last = await Supplier.findOne().sort({ createdAt: -1 });
  if (!last) return 'SUP-001';
  const num = parseInt(last.supplierCode.split('-')[1] || '0') + 1;
  return `SUP-${String(num).padStart(3, '0')}`;
};

export const getSuppliers = async (req, res) => {
  try {
    const { status, search } = req.query;
    const query = {};
    if (status) query.status = status;
    if (search) query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { supplierCode: { $regex: search, $options: 'i' } },
      { 'address.city': { $regex: search, $options: 'i' } },
    ];
    const suppliers = await Supplier.find(query).sort({ createdAt: -1 });
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching suppliers', error: error.message });
  }
};

export const getSupplierById = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
    res.json(supplier);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Validate supplier payload
const validateSupplierPayload = (data) => {
  const errors = [];
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length < 2) {
    errors.push('Supplier Name is required (minimum 2 characters)');
  }
  if (data.email && typeof data.email === 'string' && data.email.trim()) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
      errors.push('Invalid email format (e.g. contact@supplier.com)');
    }
  }
  if (data.phone && typeof data.phone === 'string' && data.phone.trim()) {
    const cleanedPhone = data.phone.replace(/[\s\-()]/g, '');
    if (!/^(\+91)?[6-9]\d{9}$/.test(cleanedPhone) && !/^\d{10,12}$/.test(cleanedPhone)) {
      errors.push('Invalid phone number (must be a valid 10-digit mobile/phone number)');
    }
  }
  if (data.gstNumber && typeof data.gstNumber === 'string' && data.gstNumber.trim()) {
    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i.test(data.gstNumber.trim())) {
      errors.push('Invalid GST Number format (must be 15-character GSTIN, e.g. 27AABCN1234F1Z5)');
    }
  }
  if (data.panNumber && typeof data.panNumber === 'string' && data.panNumber.trim()) {
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(data.panNumber.trim())) {
      errors.push('Invalid PAN Number format (must be 10 characters, e.g. AABCN1234F)');
    }
  }
  if (data.address?.pinCode && typeof data.address.pinCode === 'string' && data.address.pinCode.trim()) {
    if (!/^[1-9][0-9]{5}$/.test(data.address.pinCode.trim())) {
      errors.push('Invalid PIN Code (must be a 6-digit numeric code)');
    }
  }
  if (data.bankDetails?.accountNumber && typeof data.bankDetails.accountNumber === 'string' && data.bankDetails.accountNumber.trim()) {
    if (!/^\d{9,18}$/.test(data.bankDetails.accountNumber.trim())) {
      errors.push('Invalid Bank Account Number (must be between 9 and 18 digits)');
    }
  }
  if (data.bankDetails?.ifscCode && typeof data.bankDetails.ifscCode === 'string' && data.bankDetails.ifscCode.trim()) {
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(data.bankDetails.ifscCode.trim())) {
      errors.push('Invalid IFSC Code format (e.g. HDFC0001234)');
    }
  }
  return errors;
};

export const createSupplier = async (req, res) => {
  try {
    const validationErrors = validateSupplierPayload(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({ message: validationErrors.join(', '), errors: validationErrors });
    }

    const supplierCode = req.body.supplierCode || await generateSupplierCode();
    const payload = {
      ...req.body,
      name: req.body.name?.trim(),
      gstNumber: req.body.gstNumber ? req.body.gstNumber.trim().toUpperCase() : '',
      panNumber: req.body.panNumber ? req.body.panNumber.trim().toUpperCase() : '',
      bankDetails: {
        ...req.body.bankDetails,
        ifscCode: req.body.bankDetails?.ifscCode ? req.body.bankDetails.ifscCode.trim().toUpperCase() : '',
      },
      supplierCode,
    };
    const supplier = new Supplier(payload);
    await supplier.save();
    res.status(201).json(supplier);
  } catch (error) {
    res.status(400).json({ message: 'Error creating supplier', error: error.message });
  }
};

export const updateSupplier = async (req, res) => {
  try {
    const validationErrors = validateSupplierPayload(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({ message: validationErrors.join(', '), errors: validationErrors });
    }

    const payload = {
      ...req.body,
      name: req.body.name?.trim(),
      gstNumber: req.body.gstNumber ? req.body.gstNumber.trim().toUpperCase() : '',
      panNumber: req.body.panNumber ? req.body.panNumber.trim().toUpperCase() : '',
      bankDetails: {
        ...req.body.bankDetails,
        ifscCode: req.body.bankDetails?.ifscCode ? req.body.bankDetails.ifscCode.trim().toUpperCase() : '',
      },
    };
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
    res.json(supplier);
  } catch (error) {
    res.status(400).json({ message: 'Error updating supplier', error: error.message });
  }
};

export const deleteSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndDelete(req.params.id);
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
    res.json({ message: 'Supplier deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting supplier', error: error.message });
  }
};
