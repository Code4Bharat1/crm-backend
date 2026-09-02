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

const salesOrderSchema = new mongoose.Schema({
  soNo:         { type: String, unique: true },  // e.g., SO-2026-001
  proformaRef:  { type: String },                // Links back to ProformaInvoice No
  quotationRef: { type: String },                // Links back to Quotation No
  poReference:  { type: String },                // Customer's PO number
  date:         { type: Date, default: Date.now },
  expectedDelivery: { type: Date },
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
  deliveryAddress:{ type: String },
  items:          [itemSchema],
  subtotal:       { type: Number, required: true },
  totalDiscount:  { type: Number, default: 0 },
  totalCgst:      { type: Number, default: 0 },
  totalSgst:      { type: Number, default: 0 },
  totalIgst:      { type: Number, default: 0 },
  grandTotal:     { type: Number, required: true },
  isInterState:   { type: Boolean, default: false },
  salesperson:    { type: String },
  termsAndConditions: { type: String },
  notes:          { type: String },
  status: {
    type: String,
    enum: ['Confirmed', 'In Progress', 'Partially Delivered', 'Delivered', 'Invoiced', 'Closed', 'Cancelled'],
    default: 'Confirmed',
  },
  // Cross-references
  deliveryNotes: [{ type: String }],  // DeliveryNote Nos
  invoices:      [{ type: String }],  // SalesInvoice Nos
  purchaseOrders:[{ type: String }],  // PurchaseOrder Nos
}, { timestamps: true });

salesOrderSchema.pre('validate', async function () {
  if (!this.soNo) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('SalesOrder').countDocuments();
    this.soNo = `SO-${year}-${String(count + 1).padStart(3, '0')}`;
  }
});

export default mongoose.model('SalesOrder', salesOrderSchema);
