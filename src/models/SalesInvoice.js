import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
  productCode:  { type: String },
  description:  { type: String, required: true },
  hsnCode:      { type: String },
  qty:          { type: Number, required: true, min: 0 },
  unit:         { type: String, default: 'Nos' },
  rate:         { type: Number, required: true, min: 0 },
  discount:     { type: Number, default: 0 },
  taxableAmount:{ type: Number, required: true },
  gstRate:      { type: Number, default: 18 },
  cgst:         { type: Number, default: 0 },
  sgst:         { type: Number, default: 0 },
  igst:         { type: Number, default: 0 },
  totalAmount:  { type: Number, required: true },
});

const paymentSchema = new mongoose.Schema({
  amount:    { type: Number, required: true },
  date:      { type: Date, default: Date.now },
  mode:      { type: String, enum: ['NEFT', 'RTGS', 'UPI', 'Cheque', 'Cash', 'DD', 'Credit Note'], default: 'NEFT' },
  reference: { type: String },  // UTR number, cheque number
  notes:     { type: String },
  recordedBy:{ type: String },
});

const salesInvoiceSchema = new mongoose.Schema({
  invoiceNo:       { type: String, unique: true },  // e.g., INV-2026-001
  date:            { type: Date, default: Date.now },
  dueDate:         { type: Date },
  soRef:           { type: String },  // Links to SalesOrder No
  proformaRef:     { type: String },  // Links to ProformaInvoice No
  quotationRef:    { type: String },  // Links to Quotation No
  dnRef:           { type: String },  // Links to DeliveryNote No
  customer: {
    id:           { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    name:         { type: String, required: true },
    address:      { type: String },
    gstNumber:    { type: String },
    state:        { type: String },
    contactPerson:{ type: String },
    email:        { type: String },
    phone:        { type: String },
  },
  billingAddress:  { type: String },
  shippingAddress: { type: String },
  items:           [itemSchema],
  subtotal:        { type: Number, required: true },
  totalDiscount:   { type: Number, default: 0 },
  totalCgst:       { type: Number, default: 0 },
  totalSgst:       { type: Number, default: 0 },
  totalIgst:       { type: Number, default: 0 },
  roundOff:        { type: Number, default: 0 },
  grandTotal:      { type: Number, required: true },
  amountInWords:   { type: String },
  isInterState:    { type: Boolean, default: false },
  advanceAdjusted: { type: Number, default: 0 },  // Advance from proforma
  receivedAmount:  { type: Number, default: 0 },
  balanceAmount:   { type: Number, default: 0 },
  payments:        [paymentSchema],
  paymentTerms:    { type: String, default: '30 Days Net' },
  salesperson:     { type: String },
  termsAndConditions: { type: String },
  notes:           { type: String },
  status: {
    type: String,
    enum: ['Draft', 'Sent', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled', 'Written Off'],
    default: 'Draft',
  },
  eWayBillNo:  { type: String },
  irn:         { type: String },  // GST e-invoice IRN
}, { timestamps: true });

salesInvoiceSchema.pre('validate', async function () {
  if (!this.invoiceNo) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('SalesInvoice').countDocuments();
    this.invoiceNo = `INV-${year}-${String(count + 1).padStart(3, '0')}`;
  }
});

// Auto-calculate balance before save
salesInvoiceSchema.pre('save', function () {
  this.receivedAmount = (this.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0) + (this.advanceAdjusted || 0);
  this.balanceAmount = Math.max(0, this.grandTotal - this.receivedAmount);
  if (this.balanceAmount === 0 && this.grandTotal > 0) {
    this.status = 'Paid';
  }
});

export default mongoose.model('SalesInvoice', salesInvoiceSchema);
