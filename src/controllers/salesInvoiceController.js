import SalesInvoice from '../models/SalesInvoice.js';
import ProformaInvoice from '../models/ProformaInvoice.js';
import SalesOrder from '../models/SalesOrder.js';

const generateInvoiceNo = async () => {
  const year = new Date().getFullYear();
  const last = await SalesInvoice.findOne({ invoiceNo: { $regex: `INV-${year}-` } }).sort({ invoiceNo: -1 });
  if (!last) return `INV-${year}-001`;
  const num = parseInt(last.invoiceNo.split('-')[2] || '0') + 1;
  return `INV-${year}-${String(num).padStart(3, '0')}`;
};

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

export const getInvoices = async (req, res) => {
  try {
    const { status, customerId, search } = req.query;
    const query = {};
    if (status) query.status = status;
    if (customerId) query['customer.id'] = customerId;
    if (search) query.$or = [
      { invoiceNo: { $regex: search, $options: 'i' } },
      { 'customer.name': { $regex: search, $options: 'i' } },
      { soRef: { $regex: search, $options: 'i' } },
      { proformaRef: { $regex: search, $options: 'i' } },
      { dnRef: { $regex: search, $options: 'i' } },
    ];
    const invoices = await SalesInvoice.find(query).sort({ date: -1 });
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching invoices', error: error.message });
  }
};

export const getInvoiceById = async (req, res) => {
  try {
    const doc = await SalesInvoice.findOne({ invoiceNo: req.params.id })
      || await SalesInvoice.findById(req.params.id).catch(() => null);
    if (!doc) return res.status(404).json({ message: 'Invoice not found' });
    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const createInvoice = async (req, res) => {
  try {
    const invoiceNo = req.body.invoiceNo || await generateInvoiceNo();
    const amountInWords = numberToWords(req.body.grandTotal || 0);

    let advanceAdjusted = req.body.advanceAdjusted !== undefined ? Number(req.body.advanceAdjusted) : 0;
    if (advanceAdjusted === 0) {
      if (req.body.proformaRef) {
        const pi = await ProformaInvoice.findOne({ proformaNo: req.body.proformaRef });
        if (pi && pi.advanceReceived > 0) advanceAdjusted = pi.advanceReceived;
      } else if (req.body.soRef) {
        const so = await SalesOrder.findOne({ soNo: req.body.soRef });
        if (so?.proformaRef) {
          const pi = await ProformaInvoice.findOne({ proformaNo: so.proformaRef });
          if (pi && pi.advanceReceived > 0) advanceAdjusted = pi.advanceReceived;
        }
      }
    }

    const invoice = new SalesInvoice({ ...req.body, advanceAdjusted, invoiceNo, amountInWords });
    await invoice.save();
    res.status(201).json(invoice);
  } catch (error) {
    res.status(400).json({ message: 'Error creating invoice', error: error.message });
  }
};

export const updateInvoice = async (req, res) => {
  try {
    const doc = await SalesInvoice.findOne({ invoiceNo: req.params.id })
      || await SalesInvoice.findById(req.params.id).catch(() => null);
    if (!doc) return res.status(404).json({ message: 'Invoice not found' });
    Object.assign(doc, req.body);
    if (req.body.grandTotal) {
      doc.amountInWords = numberToWords(req.body.grandTotal);
    }
    await doc.save();
    res.json(doc);
  } catch (error) {
    res.status(400).json({ message: 'Error updating invoice', error: error.message });
  }
};

export const deleteInvoice = async (req, res) => {
  try {
    const doc = await SalesInvoice.findOneAndDelete({ invoiceNo: req.params.id })
      || await SalesInvoice.findByIdAndDelete(req.params.id).catch(() => null);
    if (!doc) return res.status(404).json({ message: 'Invoice not found' });
    res.json({ message: 'Invoice deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting invoice', error: error.message });
  }
};

// POST /api/invoices/:id/record-payment
export const recordPayment = async (req, res) => {
  try {
    const doc = await SalesInvoice.findOne({ invoiceNo: req.params.id })
      || await SalesInvoice.findById(req.params.id).catch(() => null);
    if (!doc) return res.status(404).json({ message: 'Invoice not found' });

    doc.payments.push({
      date:      req.body.date || new Date(),
      amount:    Number(req.body.amount),
      mode:      req.body.mode || 'NEFT',
      reference: req.body.reference,
      notes:     req.body.notes,
    });

    // pre-save hook recalculates receivedAmount, balanceAmount, and status
    await doc.save();
    res.json(doc);
  } catch (error) {
    res.status(400).json({ message: 'Error recording payment', error: error.message });
  }
};

// GET /api/invoices/payments-ledger — every recorded payment across all
// invoices, flattened into one list. Real received-money records already
// tied to an invoice/customer -- this is the reconciliation ledger; there is
// no live bank feed to auto-match against yet.
export const getPaymentsLedger = async (req, res) => {
  try {
    const invoicesWithPayments = await SalesInvoice.find({ 'payments.0': { $exists: true } })
      .select('invoiceNo customer payments grandTotal');

    const rows = [];
    invoicesWithPayments.forEach((inv) => {
      inv.payments.forEach((p) => {
        rows.push({
          id: String(p._id),
          invoiceNo: inv.invoiceNo,
          invoiceId: inv._id,
          customerId: inv.customer?.id,
          customerName: inv.customer?.name || 'Unknown',
          amount: p.amount,
          date: p.date,
          mode: p.mode,
          reference: p.reference || '',
          notes: p.notes || '',
          recordedBy: p.recordedBy || '',
        });
      });
    });

    rows.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching payments ledger', error: error.message });
  }
};

// GET /api/invoices/overdue — find overdue invoices and update status
export const checkOverdue = async (req, res) => {
  try {
    const now = new Date();
    const result = await SalesInvoice.updateMany(
      { status: { $in: ['Sent', 'Partially Paid'] }, dueDate: { $lt: now } },
      { status: 'Overdue' }
    );
    res.json({ message: `Updated ${result.modifiedCount} invoices to Overdue` });
  } catch (error) {
    res.status(500).json({ message: 'Error checking overdue invoices', error: error.message });
  }
};
