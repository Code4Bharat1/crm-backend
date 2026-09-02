import SerialNumber from '../models/SerialNumber.js';

export const getSerialNumbers = async (req, res) => {
  try {
    const { status, search, productId, customerId } = req.query;
    const query = {};

    if (status) query.status = status;
    if (productId) query['product.id'] = productId;
    if (customerId) query['customer.id'] = customerId;
    if (search) {
      query.$or = [
        { serialNo: { $regex: search, $options: 'i' } },
        { 'product.name': { $regex: search, $options: 'i' } },
        { 'product.itemCode': { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } },
        { 'supplier.name': { $regex: search, $options: 'i' } },
        { soRef: { $regex: search, $options: 'i' } },
        { dnRef: { $regex: search, $options: 'i' } },
        { invoiceRef: { $regex: search, $options: 'i' } },
      ];
    }

    const serials = await SerialNumber.find(query).sort({ createdAt: -1 });
    res.json(serials);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching serial numbers', error: error.message });
  }
};

export const getSerialNumberById = async (req, res) => {
  try {
    const doc = await SerialNumber.findOne({ serialNo: req.params.id })
      || await SerialNumber.findById(req.params.id).catch(() => null);
    if (!doc) return res.status(404).json({ message: 'Serial number not found' });
    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const createSerialNumber = async (req, res) => {
  try {
    const serial = new SerialNumber(req.body);
    await serial.save();
    res.status(201).json(serial);
  } catch (error) {
    res.status(400).json({ message: 'Error creating serial number', error: error.message });
  }
};

export const updateSerialNumber = async (req, res) => {
  try {
    const doc = await SerialNumber.findOne({ serialNo: req.params.id })
      || await SerialNumber.findById(req.params.id).catch(() => null);
    if (!doc) return res.status(404).json({ message: 'Serial number not found' });
    Object.assign(doc, req.body);
    await doc.save();
    res.json(doc);
  } catch (error) {
    res.status(400).json({ message: 'Error updating serial number', error: error.message });
  }
};

export const deleteSerialNumber = async (req, res) => {
  try {
    const doc = await SerialNumber.findOneAndDelete({ serialNo: req.params.id })
      || await SerialNumber.findByIdAndDelete(req.params.id).catch(() => null);
    if (!doc) return res.status(404).json({ message: 'Serial number not found' });
    res.json({ message: 'Serial number deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting serial number', error: error.message });
  }
};
