import mongoose from 'mongoose';
import { nextDocNumber } from '../utils/nextDocNumber.js';

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
    this.serialNo = await nextDocNumber(mongoose.model('SerialNumber'), 'serialNo', `SN-${new Date().getFullYear()}-`, 4);
  }
});

export default mongoose.model('SerialNumber', serialNumberSchema);
