import mongoose from 'mongoose';

const deliveryItemSchema = new mongoose.Schema({
  productCode:  { type: String },
  description:  { type: String, required: true },
  hsnCode:      { type: String },
  qty:          { type: Number, required: true, min: 0 },
  unit:         { type: String, default: 'Nos' },
  serialNumbers:[{ type: String }],  // Serial numbers for tracked items
  remarks:      { type: String },
});

const deliveryNoteSchema = new mongoose.Schema({
  dnNo:             { type: String, unique: true },  // e.g., DN-2026-001
  soRef:            { type: String, required: true }, // Required link to SalesOrder
  date:             { type: Date, default: Date.now },
  customer: {
    id:             { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    name:           { type: String, required: true },
    address:        { type: String },
    contactPerson:  { type: String },
    phone:          { type: String },
  },
  deliveryAddress:  { type: String },
  items:            [deliveryItemSchema],
  transporter:      { type: String },
  vehicleNumber:    { type: String },
  lrNumber:         { type: String }, // Lorry Receipt Number
  dispatchDate:     { type: Date, default: Date.now },
  expectedDelivery: { type: Date },
  deliveryDate:     { type: Date },   // Actual delivery date
  receivedBy:       { type: String },
  receiverSignature:{ type: String }, // URL to uploaded signature image
  status: {
    type: String,
    enum: ['Prepared', 'Dispatched', 'In Transit', 'Delivered', 'Returned', 'Partial'],
    default: 'Prepared',
  },
  notes:  { type: String },
  // Cross-references
  invoiceRef: { type: String },  // If invoice linked to this delivery
}, { timestamps: true });

deliveryNoteSchema.pre('validate', async function () {
  if (!this.dnNo) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('DeliveryNote').countDocuments();
    this.dnNo = `DN-${year}-${String(count + 1).padStart(3, '0')}`;
  }
});

export default mongoose.model('DeliveryNote', deliveryNoteSchema);
