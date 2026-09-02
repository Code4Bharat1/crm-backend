import SalesOrder from '../models/SalesOrder.js';
import DeliveryNote from '../models/DeliveryNote.js';
import SalesInvoice from '../models/SalesInvoice.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import ProformaInvoice from '../models/ProformaInvoice.js';
import Product from '../models/Product.js';

export const deductInventoryStock = async (items) => {
  if (!items || !items.length) return;
  for (const item of items) {
    const qty = Number(item.qty) || 0;
    if (qty <= 0) continue;

    const query = [];
    if (item.productCode) query.push({ itemCode: item.productCode });
    if (item.description) query.push({ name: item.description });

    if (query.length > 0) {
      const prod = await Product.findOne({ $or: query });
      if (prod) {
        prod.stock = Math.max(0, (prod.stock || 0) - qty);
        if (prod.stock === 0) prod.status = 'Out of Stock';
        await prod.save();
      }
    }
  }
};

const generateSoNo = async () => {
  const year = new Date().getFullYear();
  const last = await SalesOrder.findOne({ soNo: { $regex: `SO-${year}-` } }).sort({ soNo: -1 });
  if (!last) return `SO-${year}-001`;
  const num = parseInt(last.soNo.split('-')[2] || '0') + 1;
  return `SO-${year}-${String(num).padStart(3, '0')}`;
};

// Convert number to words for invoices
const numberToWords = (num) => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convert = (n) => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + convert(n % 10000000) : '');
  };

  const n = Math.round(num);
  if (n === 0) return 'Zero';
  return 'Rupees ' + convert(n) + ' Only';
};

export const getSalesOrders = async (req, res) => {
  try {
    const { status, customerId, search } = req.query;
    const query = {};
    if (status) query.status = status;
    if (customerId) query['customer.id'] = customerId;
    if (search) query.$or = [
      { soNo: { $regex: search, $options: 'i' } },
      { 'customer.name': { $regex: search, $options: 'i' } },
      { quotationRef: { $regex: search, $options: 'i' } },
    ];
    const orders = await SalesOrder.find(query).sort({ date: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching sales orders', error: error.message });
  }
};

export const getSalesOrderById = async (req, res) => {
  try {
    const doc = await SalesOrder.findOne({ soNo: req.params.id })
      || await SalesOrder.findById(req.params.id).catch(() => null);
    if (!doc) return res.status(404).json({ message: 'Sales order not found' });
    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const createSalesOrder = async (req, res) => {
  try {
    const soNo = req.body.soNo || await generateSoNo();
    const so = new SalesOrder({ ...req.body, soNo });
    await so.save();

    // Auto-deduct inventory stock for line items
    await deductInventoryStock(so.items);

    res.status(201).json(so);
  } catch (error) {
    res.status(400).json({ message: 'Error creating sales order', error: error.message });
  }
};

export const updateSalesOrder = async (req, res) => {
  try {
    const doc = await SalesOrder.findOne({ soNo: req.params.id })
      || await SalesOrder.findById(req.params.id).catch(() => null);
    if (!doc) return res.status(404).json({ message: 'Sales order not found' });
    Object.assign(doc, req.body);
    await doc.save();
    res.json(doc);
  } catch (error) {
    res.status(400).json({ message: 'Error updating sales order', error: error.message });
  }
};

export const deleteSalesOrder = async (req, res) => {
  try {
    const doc = await SalesOrder.findOneAndDelete({ soNo: req.params.id })
      || await SalesOrder.findByIdAndDelete(req.params.id).catch(() => null);
    if (!doc) return res.status(404).json({ message: 'Sales order not found' });
    res.json({ message: 'Sales order deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting sales order', error: error.message });
  }
};

// POST /api/sales-orders/:id/create-delivery-note
export const createDeliveryNoteFromSO = async (req, res) => {
  try {
    const so = await SalesOrder.findOne({ soNo: req.params.id })
      || await SalesOrder.findById(req.params.id).catch(() => null);
    if (!so) return res.status(404).json({ message: 'Sales order not found' });

    if (so.deliveryNotes && so.deliveryNotes.length > 0) {
      const existing = await DeliveryNote.findOne({ dnNo: so.deliveryNotes[0] });
      if (existing) return res.status(200).json(existing);
    }

    const year = new Date().getFullYear();
    const lastDN = await DeliveryNote.findOne({ dnNo: { $regex: `DN-${year}-` } }).sort({ dnNo: -1 });
    const num = lastDN ? parseInt(lastDN.dnNo.split('-')[2] || '0') + 1 : 1;
    const dnNo = `DN-${year}-${String(num).padStart(3, '0')}`;

    const dn = new DeliveryNote({
      dnNo,
      soRef: so.soNo,
      customer: { id: so.customer.id, name: so.customer.name, address: so.customer.address, phone: so.customer.phone },
      deliveryAddress: so.deliveryAddress || so.customer.address,
      items: so.items.map(item => ({
        description: item.description,
        hsnCode: item.hsnCode,
        qty: item.qty,
        unit: item.unit,
        serialNumbers: [],
      })),
      ...req.body,
    });
    await dn.save();

    // Update SO cross-reference
    so.deliveryNotes = [...(so.deliveryNotes || []), dnNo];
    so.status = 'In Progress';
    await so.save();

    res.status(201).json(dn);
  } catch (error) {
    res.status(400).json({ message: 'Error creating delivery note', error: error.message });
  }
};

// POST /api/sales-orders/:id/create-invoice
export const createInvoiceFromSO = async (req, res) => {
  try {
    const so = await SalesOrder.findOne({ soNo: req.params.id })
      || await SalesOrder.findById(req.params.id).catch(() => null);
    if (!so) return res.status(404).json({ message: 'Sales order not found' });

    if (so.invoices && so.invoices.length > 0) {
      const existing = await SalesInvoice.findOne({ invoiceNo: so.invoices[0] });
      if (existing) return res.status(200).json(existing);
    }

    const year = new Date().getFullYear();
    const lastINV = await SalesInvoice.findOne({ invoiceNo: { $regex: `INV-${year}-` } }).sort({ invoiceNo: -1 });
    const num = lastINV ? parseInt(lastINV.invoiceNo.split('-')[2] || '0') + 1 : 1;
    const invoiceNo = `INV-${year}-${String(num).padStart(3, '0')}`;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    let advanceAdjusted = req.body.advanceAdjusted !== undefined ? Number(req.body.advanceAdjusted) : 0;
    if (advanceAdjusted === 0 && so.proformaRef) {
      const pi = await ProformaInvoice.findOne({ proformaNo: so.proformaRef });
      if (pi && pi.advanceReceived > 0) {
        advanceAdjusted = pi.advanceReceived;
      }
    }

    const invoice = new SalesInvoice({
      invoiceNo,
      soRef: so.soNo,
      proformaRef: so.proformaRef,
      quotationRef: so.quotationRef,
      dueDate,
      customer: so.customer,
      billingAddress: so.customer.address,
      shippingAddress: so.deliveryAddress || so.customer.address,
      items: so.items,
      subtotal: so.subtotal,
      totalDiscount: so.totalDiscount,
      totalCgst: so.totalCgst,
      totalSgst: so.totalSgst,
      totalIgst: so.totalIgst,
      grandTotal: so.grandTotal,
      advanceAdjusted,
      isInterState: so.isInterState,
      salesperson: so.salesperson,
      amountInWords: numberToWords(so.grandTotal),
      termsAndConditions: so.termsAndConditions,
      ...req.body,
    });
    await invoice.save();

    so.invoices = [...(so.invoices || []), invoiceNo];
    so.status = 'Invoiced';
    await so.save();

    res.status(201).json(invoice);
  } catch (error) {
    res.status(400).json({ message: 'Error creating invoice', error: error.message });
  }
};

// POST /api/sales-orders/:id/create-purchase-order
export const createPurchaseOrderFromSO = async (req, res) => {
  try {
    const so = await SalesOrder.findOne({ soNo: req.params.id })
      || await SalesOrder.findById(req.params.id).catch(() => null);
    if (!so) return res.status(404).json({ message: 'Sales order not found' });

    const year = new Date().getFullYear();
    const lastPO = await PurchaseOrder.findOne({ poNo: { $regex: `PO-${year}-` } }).sort({ poNo: -1 });
    const num = lastPO ? parseInt(lastPO.poNo.split('-')[2] || '0') + 1 : 1;
    const poNo = `PO-${year}-${String(num).padStart(3, '0')}`;

    const po = new PurchaseOrder({
      poNo,
      soRef: so.soNo,
      supplier: req.body.supplier,
      items: so.items.map(i => ({
        description: i.description,
        hsnCode: i.hsnCode,
        qty: i.qty,
        unit: i.unit,
        rate: i.rate,
        discount: 0,
        taxableAmount: i.taxableAmount,
        gstRate: i.gstRate,
        cgst: i.cgst,
        sgst: i.sgst,
        igst: i.igst,
        totalAmount: i.totalAmount,
      })),
      subtotal: so.subtotal,
      totalCgst: so.totalCgst,
      totalSgst: so.totalSgst,
      totalIgst: so.totalIgst,
      grandTotal: so.grandTotal,
      isInterState: so.isInterState,
      deliveryAddress: so.deliveryAddress,
      ...req.body,
    });
    await po.save();

    so.purchaseOrders = [...(so.purchaseOrders || []), poNo];
    await so.save();

    res.status(201).json(po);
  } catch (error) {
    res.status(400).json({ message: 'Error creating purchase order', error: error.message });
  }
};
