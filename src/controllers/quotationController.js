import Quotation from '../models/Quotation.js';
import ProformaInvoice from '../models/ProformaInvoice.js';
import SalesOrder from '../models/SalesOrder.js';
import { deductInventoryStock } from './salesOrderController.js';

// Generate next quotation number  e.g. QT-2026-001
const generateQuotationNo = async () => {
  const year = new Date().getFullYear();
  const last = await Quotation.findOne({ quotationNo: { $regex: `QT-${year}-` } }).sort({ quotationNo: -1 });
  if (!last) return `QT-${year}-001`;
  const num = parseInt(last.quotationNo.split('-')[2] || '0') + 1;
  return `QT-${year}-${String(num).padStart(3, '0')}`;
};

export const getQuotations = async (req, res) => {
  try {
    const { status, customerId, search } = req.query;
    const query = {};
    if (status) query.status = status;
    if (customerId) query['customer.id'] = customerId;
    if (search) query.$or = [
      { quotationNo: { $regex: search, $options: 'i' } },
      { 'customer.name': { $regex: search, $options: 'i' } },
      { salesperson: { $regex: search, $options: 'i' } },
    ];
    const quotations = await Quotation.find(query).sort({ date: -1 });
    res.json(quotations);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching quotations', error: error.message });
  }
};

export const getQuotationById = async (req, res) => {
  try {
    const doc = await Quotation.findOne({ quotationNo: req.params.id })
      || await Quotation.findById(req.params.id).catch(() => null);
    if (!doc) return res.status(404).json({ message: 'Quotation not found' });
    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const createQuotation = async (req, res) => {
  try {
    const quotationNo = req.body.quotationNo || await generateQuotationNo();
    const quotation = new Quotation({ ...req.body, quotationNo });
    await quotation.save();
    res.status(201).json(quotation);
  } catch (error) {
    res.status(400).json({ message: 'Error creating quotation', error: error.message });
  }
};

export const updateQuotation = async (req, res) => {
  try {
    const doc = await Quotation.findOne({ quotationNo: req.params.id })
      || await Quotation.findById(req.params.id).catch(() => null);
    if (!doc) return res.status(404).json({ message: 'Quotation not found' });
    Object.assign(doc, req.body);
    await doc.save();
    res.json(doc);
  } catch (error) {
    res.status(400).json({ message: 'Error updating quotation', error: error.message });
  }
};

export const deleteQuotation = async (req, res) => {
  try {
    const doc = await Quotation.findOneAndDelete({ quotationNo: req.params.id })
      || await Quotation.findByIdAndDelete(req.params.id).catch(() => null);
    if (!doc) return res.status(404).json({ message: 'Quotation not found' });
    res.json({ message: 'Quotation deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting quotation', error: error.message });
  }
};

// POST /api/quotations/:id/convert-to-proforma
export const convertToProforma = async (req, res) => {
  try {
    const quotation = await Quotation.findOne({ quotationNo: req.params.id })
      || await Quotation.findById(req.params.id).catch(() => null);
    if (!quotation) return res.status(404).json({ message: 'Quotation not found' });

    if (quotation.convertedToProforma) {
      const existing = await ProformaInvoice.findOne({ proformaNo: quotation.convertedToProforma });
      if (existing) return res.status(200).json(existing);
    }

    const year = new Date().getFullYear();
    const lastPI = await ProformaInvoice.findOne({ proformaNo: { $regex: `PI-${year}-` } }).sort({ proformaNo: -1 });
    const num = lastPI ? parseInt(lastPI.proformaNo.split('-')[2] || '0') + 1 : 1;
    const proformaNo = `PI-${year}-${String(num).padStart(3, '0')}`;

    const proforma = new ProformaInvoice({
      proformaNo,
      quotationRef: quotation.quotationNo,
      customer: quotation.customer,
      subject: quotation.subject,
      items: quotation.items,
      subtotal: quotation.subtotal,
      totalDiscount: quotation.totalDiscount,
      totalCgst: quotation.totalCgst,
      totalSgst: quotation.totalSgst,
      totalIgst: quotation.totalIgst,
      grandTotal: quotation.grandTotal,
      isInterState: quotation.isInterState,
      salesperson: quotation.salesperson,
      termsAndConditions: quotation.termsAndConditions,
      advanceRequired: req.body.advanceRequired !== undefined ? Number(req.body.advanceRequired) : 0,
    });
    await proforma.save();

    quotation.convertedToProforma = proformaNo;
    quotation.status = 'Accepted';
    await quotation.save();

    res.status(201).json(proforma);
  } catch (error) {
    res.status(400).json({ message: 'Error converting to proforma', error: error.message });
  }
};

// POST /api/quotations/:id/convert-to-so
export const convertToSalesOrder = async (req, res) => {
  try {
    const quotation = await Quotation.findOne({ quotationNo: req.params.id })
      || await Quotation.findById(req.params.id).catch(() => null);
    if (!quotation) return res.status(404).json({ message: 'Quotation not found' });

    if (quotation.convertedToSalesOrder) {
      const existing = await SalesOrder.findOne({ soNo: quotation.convertedToSalesOrder });
      if (existing) return res.status(200).json(existing);
    }

    const year = new Date().getFullYear();
    const lastSO = await SalesOrder.findOne({ soNo: { $regex: `SO-${year}-` } }).sort({ soNo: -1 });
    const num = lastSO ? parseInt(lastSO.soNo.split('-')[2] || '0') + 1 : 1;
    const soNo = `SO-${year}-${String(num).padStart(3, '0')}`;

    const so = new SalesOrder({
      soNo,
      quotationRef: quotation.quotationNo,
      poReference: req.body.poReference,
      customer: quotation.customer,
      deliveryAddress: quotation.customer.address,
      items: quotation.items,
      subtotal: quotation.subtotal,
      totalDiscount: quotation.totalDiscount,
      totalCgst: quotation.totalCgst,
      totalSgst: quotation.totalSgst,
      totalIgst: quotation.totalIgst,
      grandTotal: quotation.grandTotal,
      isInterState: quotation.isInterState,
      salesperson: quotation.salesperson,
      termsAndConditions: quotation.termsAndConditions,
    });
    await so.save();

    // Auto-deduct inventory stock
    await deductInventoryStock(so.items);

    quotation.convertedToSalesOrder = soNo;
    quotation.status = 'Accepted';
    await quotation.save();

    res.status(201).json(so);
  } catch (error) {
    res.status(400).json({ message: 'Error converting to sales order', error: error.message });
  }
};
