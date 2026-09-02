import mongoose from 'mongoose';

const poItemSchema = new mongoose.Schema({
  productCode:  { type: String },
  description:  { type: String, required: true },
  hsnCode:      { type: String },
  qty:          { type: Number, required: true, min: 0 },
  receivedQty:  { type: Number, default: 0 },
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

const purchaseOrderSchema = new mongoose.Schema({
  poNo:         { type: String, unique: true },  // e.g., PO-2026-001
  date:         { type: Date, default: Date.now },
  expectedDelivery: { type: Date },
  soRef:        { type: String },  // If PO created against a SalesOrder
  projectRef:   { type: String },  // If linked to a Project
  supplier: {
    id:           { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    name:         { type: String, required: true },
    gstNumber:    { type: String },
    address:      { type: String },
    contactPerson:{ type: String },
    phone:        { type: String },
    email:        { type: String },
  },
  deliveryAddress:{ type: String },
  items:        [poItemSchema],
  subtotal:     { type: Number, required: true },
  totalDiscount:{ type: Number, default: 0 },
  totalCgst:    { type: Number, default: 0 },
  totalSgst:    { type: Number, default: 0 },
  totalIgst:    { type: Number, default: 0 },
  grandTotal:   { type: Number, required: true },
  isInterState: { type: Boolean, default: false },
  paymentTerms: { type: String, default: '30 Days Net' },
  termsAndConditions: { type: String },
  notes:        { type: String },
  status: {
    type: String,
    enum: ['Draft', 'Sent', 'Acknowledged', 'Partially Received', 'Received', 'Closed', 'Cancelled'],
    default: 'Draft',
  },
  preparedBy:   { type: String },
  approvedBy:   { type: String },
}, { timestamps: true });

purchaseOrderSchema.pre('validate', async function () {
  if (!this.poNo) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('PurchaseOrder').countDocuments();
    this.poNo = `PO-${year}-${String(count + 1).padStart(3, '0')}`;
  }
});

export default mongoose.model('PurchaseOrder', purchaseOrderSchema);
