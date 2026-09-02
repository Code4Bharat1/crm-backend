import ProformaInvoice from '../models/ProformaInvoice.js';
import SalesOrder from '../models/SalesOrder.js';
import { deductInventoryStock } from './salesOrderController.js';
import SalesInvoice from '../models/SalesInvoice.js';

const generateProformaNo = async () => {
  const year = new Date().getFullYear();
  const last = await ProformaInvoice.findOne({ proformaNo: { $regex: `PI-${year}-` } }).sort({ proformaNo: -1 });
  if (!last) return `PI-${year}-001`;
  const num = parseInt(last.proformaNo.split('-')[2] || '0') + 1;
  return `PI-${year}-${String(num).padStart(3, '0')}`;
};

export const getProformas = async (req, res) => {
  try {
    const { status, customerId, search } = req.query;
    const query = {};
    if (status) query.status = status;
    if (customerId) query['customer.id'] = customerId;
    if (search) query.$or = [
      { proformaNo: { $regex: search, $options: 'i' } },
      { 'customer.name': { $regex: search, $options: 'i' } },
      { quotationRef: { $regex: search, $options: 'i' } },
    ];
    const proformas = await ProformaInvoice.find(query).sort({ date: -1 });
    res.json(proformas);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching proformas', error: error.message });
  }
};

export const getProformaById = async (req, res) => {
  try {
    const doc = await ProformaInvoice.findOne({ proformaNo: req.params.id })
      || await ProformaInvoice.findById(req.params.id).catch(() => null);
    if (!doc) return res.status(404).json({ message: 'Proforma not found' });
    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const createProforma = async (req, res) => {
  try {
    const proformaNo = req.body.proformaNo || await generateProformaNo();
    const proforma = new ProformaInvoice({ ...req.body, proformaNo });
    await proforma.save();
    res.status(201).json(proforma);
  } catch (error) {
    res.status(400).json({ message: 'Error creating proforma', error: error.message });
  }
};

export const updateProforma = async (req, res) => {
  try {
    const doc = await ProformaInvoice.findOne({ proformaNo: req.params.id })
      || await ProformaInvoice.findById(req.params.id).catch(() => null);
    if (!doc) return res.status(404).json({ message: 'Proforma not found' });
    Object.assign(doc, req.body);
    await doc.save();
    res.json(doc);
  } catch (error) {
    res.status(400).json({ message: 'Error updating proforma', error: error.message });
  }
};

export const deleteProforma = async (req, res) => {
  try {
    const doc = await ProformaInvoice.findOneAndDelete({ proformaNo: req.params.id })
      || await ProformaInvoice.findByIdAndDelete(req.params.id).catch(() => null);
    if (!doc) return res.status(404).json({ message: 'Proforma not found' });
    res.json({ message: 'Proforma deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting proforma', error: error.message });
  }
};

// POST /api/proformas/:id/record-advance
export const recordAdvance = async (req, res) => {
  try {
    const doc = await ProformaInvoice.findOne({ proformaNo: req.params.id })
      || await ProformaInvoice.findById(req.params.id).catch(() => null);
    if (!doc) return res.status(404).json({ message: 'Proforma not found' });

    doc.advanceReceived = (doc.advanceReceived || 0) + Number(req.body.amount);
    if (doc.advanceReceived >= doc.grandTotal) {
      doc.status = 'Advance Received';
    } else {
      doc.status = 'Partially Paid';
    }
    await doc.save();
    res.json(doc);
  } catch (error) {
    res.status(400).json({ message: 'Error recording advance', error: error.message });
  }
};

// POST /api/proformas/:id/convert-to-so
export const convertToSalesOrder = async (req, res) => {
  try {
    const proforma = await ProformaInvoice.findOne({ proformaNo: req.params.id })
      || await ProformaInvoice.findById(req.params.id).catch(() => null);
    if (!proforma) return res.status(404).json({ message: 'Proforma not found' });

    if (proforma.convertedToSalesOrder) {
      const existing = await SalesOrder.findOne({ soNo: proforma.convertedToSalesOrder });
      if (existing) return res.status(200).json(existing);
    }

    const year = new Date().getFullYear();
    const lastSO = await SalesOrder.findOne({ soNo: { $regex: `SO-${year}-` } }).sort({ soNo: -1 });
    const num = lastSO ? parseInt(lastSO.soNo.split('-')[2] || '0') + 1 : 1;
    const soNo = `SO-${year}-${String(num).padStart(3, '0')}`;

    const so = new SalesOrder({
      soNo,
      proformaRef: proforma.proformaNo,
      quotationRef: proforma.quotationRef,
      poReference: req.body.poReference,
      customer: proforma.customer,
      deliveryAddress: proforma.customer.address,
      items: proforma.items,
      subtotal: proforma.subtotal,
      totalDiscount: proforma.totalDiscount,
      totalCgst: proforma.totalCgst,
      totalSgst: proforma.totalSgst,
      totalIgst: proforma.totalIgst,
      grandTotal: proforma.grandTotal,
      isInterState: proforma.isInterState,
      salesperson: proforma.salesperson,
      termsAndConditions: proforma.termsAndConditions,
    });
    await so.save();

    // Auto-deduct inventory stock
    await deductInventoryStock(so.items);

    proforma.convertedToSalesOrder = soNo;
    proforma.status = 'Converted';
    await proforma.save();

    res.status(201).json(so);
  } catch (error) {
    res.status(400).json({ message: 'Error converting to sales order', error: error.message });
  }
};
