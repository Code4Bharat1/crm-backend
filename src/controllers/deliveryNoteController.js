import DeliveryNote from '../models/DeliveryNote.js';
import SalesOrder from '../models/SalesOrder.js';
import SalesInvoice from '../models/SalesInvoice.js';
import ProformaInvoice from '../models/ProformaInvoice.js';

const generateDnNo = async () => {
  const year = new Date().getFullYear();
  const last = await DeliveryNote.findOne({ dnNo: { $regex: `DN-${year}-` } }).sort({ dnNo: -1 });
  if (!last) return `DN-${year}-001`;
  const num = parseInt(last.dnNo.split('-')[2] || '0') + 1;
  return `DN-${year}-${String(num).padStart(3, '0')}`;
};

export const getDeliveryNotes = async (req, res) => {
  try {
    const { status, soRef, search } = req.query;
    const query = {};
    if (status) query.status = status;
    if (soRef) query.soRef = soRef;
    if (search) query.$or = [
      { dnNo: { $regex: search, $options: 'i' } },
      { soRef: { $regex: search, $options: 'i' } },
      { 'customer.name': { $regex: search, $options: 'i' } },
      { lrNumber: { $regex: search, $options: 'i' } },
    ];
    const notes = await DeliveryNote.find(query).sort({ date: -1 });
    res.json(notes);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching delivery notes', error: error.message });
  }
};

export const getDeliveryNoteById = async (req, res) => {
  try {
    const doc = await DeliveryNote.findOne({ dnNo: req.params.id })
      || await DeliveryNote.findById(req.params.id).catch(() => null);
    if (!doc) return res.status(404).json({ message: 'Delivery note not found' });
    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const createDeliveryNote = async (req, res) => {
  try {
    const dnNo = req.body.dnNo || await generateDnNo();
    const dn = new DeliveryNote({ ...req.body, dnNo });
    await dn.save();
    res.status(201).json(dn);
  } catch (error) {
    res.status(400).json({ message: 'Error creating delivery note', error: error.message });
  }
};

export const updateDeliveryNote = async (req, res) => {
  try {
    const doc = await DeliveryNote.findOne({ dnNo: req.params.id })
      || await DeliveryNote.findById(req.params.id).catch(() => null);
    if (!doc) return res.status(404).json({ message: 'Delivery note not found' });
    Object.assign(doc, req.body);
    await doc.save();
    res.json(doc);
  } catch (error) {
    res.status(400).json({ message: 'Error updating delivery note', error: error.message });
  }
};

export const deleteDeliveryNote = async (req, res) => {
  try {
    const doc = await DeliveryNote.findOneAndDelete({ dnNo: req.params.id })
      || await DeliveryNote.findByIdAndDelete(req.params.id).catch(() => null);
    if (!doc) return res.status(404).json({ message: 'Delivery note not found' });
    res.json({ message: 'Delivery note deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting delivery note', error: error.message });
  }
};

// POST /api/delivery-notes/:id/mark-delivered
export const markDelivered = async (req, res) => {
  try {
    const doc = await DeliveryNote.findOne({ dnNo: req.params.id })
      || await DeliveryNote.findById(req.params.id).catch(() => null);
    if (!doc) return res.status(404).json({ message: 'Delivery note not found' });

    doc.status = 'Delivered';
    doc.deliveryDate = req.body.deliveryDate || new Date();
    doc.receivedBy = req.body.receivedBy || doc.receivedBy;
    await doc.save();
    res.json(doc);
  } catch (error) {
    res.status(400).json({ message: 'Error marking delivered', error: error.message });
  }
};

// POST /api/delivery-notes/:id/create-invoice
export const createInvoiceFromDeliveryNote = async (req, res) => {
  try {
    const dn = await DeliveryNote.findOne({ dnNo: req.params.id })
      || await DeliveryNote.findById(req.params.id).catch(() => null);
    if (!dn) return res.status(404).json({ message: 'Delivery note not found' });

    if (dn.invoiceRef) {
      const existing = await SalesInvoice.findOne({ invoiceNo: dn.invoiceRef });
      if (existing) return res.status(200).json(existing);
    }

    let so = null;
    if (dn.soRef) {
      so = await SalesOrder.findOne({ soNo: dn.soRef });
    }

    // Prepare items and financial numbers
    let items = [];
    let subtotal = 0;
    let totalDiscount = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let grandTotal = 0;
    let isInterState = so ? !!so.isInterState : false;

    if (so && so.items && so.items.length > 0) {
      items = so.items;
      subtotal = so.subtotal;
      totalDiscount = so.totalDiscount || 0;
      totalCgst = so.totalCgst || 0;
      totalSgst = so.totalSgst || 0;
      totalIgst = so.totalIgst || 0;
      grandTotal = so.grandTotal;
      isInterState = so.isInterState;
    } else {
      items = (dn.items || []).map(item => {
        const qty = item.qty || 1;
        const rate = item.rate || 0;
        const taxable = qty * rate;
        const gstRate = 18;
        const gst = taxable * 0.18;
        return {
          productCode: item.productCode || '',
          description: item.description,
          hsnCode: item.hsnCode || '',
          qty,
          unit: item.unit || 'Nos',
          rate,
          taxableAmount: taxable,
          gstRate,
          cgst: isInterState ? 0 : gst / 2,
          sgst: isInterState ? 0 : gst / 2,
          igst: isInterState ? gst : 0,
          totalAmount: taxable + gst,
        };
      });
      subtotal = items.reduce((s, i) => s + (i.taxableAmount || 0), 0);
      totalCgst = items.reduce((s, i) => s + (i.cgst || 0), 0);
      totalSgst = items.reduce((s, i) => s + (i.sgst || 0), 0);
      totalIgst = items.reduce((s, i) => s + (i.igst || 0), 0);
      grandTotal = subtotal + totalCgst + totalSgst + totalIgst;
    }

    let advanceAdjusted = req.body.advanceAdjusted !== undefined ? Number(req.body.advanceAdjusted) : 0;
    if (advanceAdjusted === 0 && so?.proformaRef) {
      const pi = await ProformaInvoice.findOne({ proformaNo: so.proformaRef });
      if (pi && pi.advanceReceived > 0) {
        advanceAdjusted = pi.advanceReceived;
      }
    }

    const invoice = new SalesInvoice({
      dnRef: dn.dnNo,
      soRef: dn.soRef || '',
      proformaRef: so?.proformaRef || '',
      quotationRef: so?.quotationRef || '',
      customer: {
        id: dn.customer?.id || so?.customer?.id,
        name: dn.customer?.name || so?.customer?.name,
        address: dn.customer?.address || so?.customer?.address || '',
        gstNumber: so?.customer?.gstNumber || '',
        state: so?.customer?.state || '',
        contactPerson: dn.customer?.contactPerson || so?.customer?.contactPerson || '',
        phone: dn.customer?.phone || so?.customer?.phone || '',
        email: dn.customer?.email || so?.customer?.email || '',
      },
      billingAddress: dn.customer?.address || so?.customer?.address || dn.deliveryAddress || '',
      shippingAddress: dn.deliveryAddress || so?.deliveryAddress || dn.customer?.address || '',
      items,
      subtotal,
      totalDiscount,
      totalCgst,
      totalSgst,
      totalIgst,
      grandTotal,
      advanceAdjusted,
      isInterState,
      salesperson: so?.salesperson || '',
      dueDate: new Date(Date.now() + 30 * 86400000),
      paymentTerms: so?.paymentTerms || '30 Days Net',
      status: 'Draft',
    });

    await invoice.save();

    // Link back to DN
    dn.invoiceRef = invoice.invoiceNo;
    await dn.save();

    // Link back to SO
    if (so) {
      if (!so.invoices.includes(invoice.invoiceNo)) {
        so.invoices.push(invoice.invoiceNo);
        await so.save();
      }
    }

    res.status(201).json(invoice);
  } catch (error) {
    res.status(400).json({ message: 'Error converting Delivery Note to Invoice', error: error.message });
  }
};
