import PurchaseOrder from '../models/PurchaseOrder.js';

const generatePoNo = async () => {
  const year = new Date().getFullYear();
  const last = await PurchaseOrder.findOne({ poNo: { $regex: `PO-${year}-` } }).sort({ poNo: -1 });
  if (!last) return `PO-${year}-001`;
  const num = parseInt(last.poNo.split('-')[2] || '0') + 1;
  return `PO-${year}-${String(num).padStart(3, '0')}`;
};

export const getPurchaseOrders = async (req, res) => {
  try {
    const { status, soRef, search } = req.query;
    const query = {};
    if (status) query.status = status;
    if (soRef) query.soRef = soRef;
    if (search) query.$or = [
      { poNo: { $regex: search, $options: 'i' } },
      { 'supplier.name': { $regex: search, $options: 'i' } },
      { soRef: { $regex: search, $options: 'i' } },
    ];
    const orders = await PurchaseOrder.find(query).sort({ date: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching purchase orders', error: error.message });
  }
};

export const getPurchaseOrderById = async (req, res) => {
  try {
    const doc = await PurchaseOrder.findOne({ poNo: req.params.id })
      || await PurchaseOrder.findById(req.params.id).catch(() => null);
    if (!doc) return res.status(404).json({ message: 'Purchase order not found' });
    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const createPurchaseOrder = async (req, res) => {
  try {
    const poNo = req.body.poNo || await generatePoNo();
    const po = new PurchaseOrder({ ...req.body, poNo });
    await po.save();
    res.status(201).json(po);
  } catch (error) {
    res.status(400).json({ message: 'Error creating purchase order', error: error.message });
  }
};

export const updatePurchaseOrder = async (req, res) => {
  try {
    const doc = await PurchaseOrder.findOne({ poNo: req.params.id })
      || await PurchaseOrder.findById(req.params.id).catch(() => null);
    if (!doc) return res.status(404).json({ message: 'Purchase order not found' });
    Object.assign(doc, req.body);
    await doc.save();
    res.json(doc);
  } catch (error) {
    res.status(400).json({ message: 'Error updating purchase order', error: error.message });
  }
};

export const deletePurchaseOrder = async (req, res) => {
  try {
    const doc = await PurchaseOrder.findOneAndDelete({ poNo: req.params.id })
      || await PurchaseOrder.findByIdAndDelete(req.params.id).catch(() => null);
    if (!doc) return res.status(404).json({ message: 'Purchase order not found' });
    res.json({ message: 'Purchase order deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting purchase order', error: error.message });
  }
};

// POST /api/purchase-orders/:id/mark-received
export const markReceived = async (req, res) => {
  try {
    const doc = await PurchaseOrder.findOne({ poNo: req.params.id })
      || await PurchaseOrder.findById(req.params.id).catch(() => null);
    if (!doc) return res.status(404).json({ message: 'Purchase order not found' });

    // Update received qty for each item
    if (req.body.items) {
      req.body.items.forEach(({ index, receivedQty }) => {
        if (doc.items[index]) doc.items[index].receivedQty = receivedQty;
      });
    }

    const allReceived = doc.items.every(i => (i.receivedQty || 0) >= i.qty);
    const anyReceived = doc.items.some(i => (i.receivedQty || 0) > 0);
    doc.status = allReceived ? 'Received' : anyReceived ? 'Partially Received' : doc.status;
    await doc.save();
    res.json(doc);
  } catch (error) {
    res.status(400).json({ message: 'Error marking received', error: error.message });
  }
};
