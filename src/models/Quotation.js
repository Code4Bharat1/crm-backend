import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
  productCode:  { type: String },
  description:  { type: String, required: true },
  hsnCode:      { type: String },
  qty:          { type: Number, required: true, min: 0 },
  unit:         { type: String, default: 'Nos' },
  rate:         { type: Number, required: true, min: 0 },
  discount:     { type: Number, default: 0 },  // percentage
  taxableAmount:{ type: Number, required: true },
  gstRate:      { type: Number, default: 18 },  // percentage e.g. 18
  cgst:         { type: Number, default: 0 },
  sgst:         { type: Number, default: 0 },
  igst:         { type: Number, default: 0 },
  totalAmount:  { type: Number, required: true },
});

const quotationSchema = new mongoose.Schema({
  quotationNo:  { type: String, required: true, unique: true },  // e.g., QT-2026-001
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
  subject:      { type: String },
  items:        [itemSchema],
  subtotal:     { type: Number, required: true },
  totalDiscount:{ type: Number, default: 0 },
  totalCgst:    { type: Number, default: 0 },
  totalSgst:    { type: Number, default: 0 },
  totalIgst:    { type: Number, default: 0 },
  grandTotal:   { type: Number, required: true },
  isInterState: { type: Boolean, default: false },  // determines IGST vs CGST+SGST
  salesperson:  { type: String },
  termsAndConditions: { type: String },
  notes:        { type: String },
  status:       {
    type: String,
    enum: ['Draft', 'Sent', 'Viewed', 'Accepted', 'Rejected', 'Expired', 'Revised'],
    default: 'Draft',
  },
  // Cross-references
  convertedToProforma:   { type: String },  // ProformaInvoice No
  convertedToSalesOrder: { type: String },  // SalesOrder No
  revisionOf:            { type: String },  // Original Quotation No (for revisions)
}, { timestamps: true });

quotationSchema.pre('validate', async function () {
  if (!this.quotationNo) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('Quotation').countDocuments();
    this.quotationNo = `QT-${year}-${String(count + 1).padStart(3, '0')}`;
  }
});

quotationSchema.index({ 'customer.id': 1 });
quotationSchema.index({ status: 1 });

export default mongoose.model('Quotation', quotationSchema);
