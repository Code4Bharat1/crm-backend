import mongoose from 'mongoose';

const serialNumberSchema = new mongoose.Schema({
  serialNo: { type: String, required: true, unique: true, index: true },
  product: {
    id: { type: String },
    itemCode: { type: String },
    name: { type: String, required: true },
  },
  supplier: {
    id: { type: String },
    name: { type: String },
  },
  receivedOn: { type: Date, default: Date.now },
  location: { type: String, default: 'Main Warehouse' },
  customer: {
    id: { type: String },
    name: { type: String },
  },
  soRef: { type: String },
  dnRef: { type: String },
  invoiceRef: { type: String },
  warrantyEnd: { type: Date },
  status: {
    type: String,
    enum: ['In Stock', 'Reserved', 'Dispatched', 'Installed', 'Under Repair'],
    default: 'In Stock',
  },
  serviceCount: { type: Number, default: 0 },
  notes: { type: String },
}, { timestamps: true });

// Auto-generate serialNo if not provided
serialNumberSchema.pre('validate', async function () {
  if (!this.serialNo) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('SerialNumber').countDocuments();
    this.serialNo = `SN-${year}-${String(count + 1).padStart(4, '0')}`;
  }
});

export default mongoose.model('SerialNumber', serialNumberSchema);
