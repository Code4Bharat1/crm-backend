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

const proformaInvoiceSchema = new mongoose.Schema({
  proformaNo:   { type: String, unique: true },  // e.g., PI-2026-001
  quotationRef: { type: String },                // Links back to Quotation No
  date:         { type: Date, default: Date.now },
  validUntil:   { type: Date },
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
  subject:        { type: String },
  items:          [itemSchema],
  subtotal:       { type: Number, required: true },
  totalDiscount:  { type: Number, default: 0 },
  totalCgst:      { type: Number, default: 0 },
  totalSgst:      { type: Number, default: 0 },
  totalIgst:      { type: Number, default: 0 },
  grandTotal:     { type: Number, required: true },
  isInterState:   { type: Boolean, default: false },
  advanceRequired:{ type: Number, default: 0 },  // Amount required as advance
  advanceReceived:{ type: Number, default: 0 },
  salesperson:    { type: String },
  termsAndConditions: { type: String },
  notes:          { type: String },
  status: {
    type: String,
    enum: ['Draft', 'Sent', 'Advance Received', 'Partially Paid', 'Converted', 'Cancelled'],
    default: 'Draft',
  },
  // Cross-references
  convertedToSalesOrder: { type: String },  // SalesOrder No
  convertedToInvoice:    { type: String },  // SalesInvoice No
}, { timestamps: true });

proformaInvoiceSchema.pre('validate', async function () {
  if (!this.proformaNo) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('ProformaInvoice').countDocuments();
    this.proformaNo = `PI-${year}-${String(count + 1).padStart(3, '0')}`;
  }
});

export default mongoose.model('ProformaInvoice', proformaInvoiceSchema);
