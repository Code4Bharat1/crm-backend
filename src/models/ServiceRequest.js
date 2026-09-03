import mongoose from 'mongoose';

const partUsedSchema = new mongoose.Schema({
  partName: { type: String, required: true },
  partCode: { type: String, default: '' },
  qty: { type: Number, default: 1, min: 1 },
  unitCost: { type: Number, default: 0, min: 0 },
  totalCost: { type: Number, default: 0, min: 0 }
}, { _id: true });

const serviceRequestSchema = new mongoose.Schema({
  requestId: { type: String, unique: true }, // e.g. SR-2026-001
  customer: {
    id: { type: String },
    name: { type: String, required: true },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    address: { type: String, default: '' }
  },
  project: {
    id: { type: String, default: '' },
    name: { type: String, default: '' }
  },
  productName: { type: String, required: true },
  serialNo: { type: String, default: '', index: true },
  issue: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  type: {
    type: String,
    enum: [
      'Breakdown / Repair',
      'Preventive Maintenance',
      'Installation & Setup',
      'Commissioning',
      'Calibration',
      'Inspection'
    ],
    default: 'Breakdown / Repair'
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium'
  },
  status: {
    type: String,
    enum: ['New', 'Assigned', 'In Progress', 'On Hold', 'Resolved', 'Closed'],
    default: 'New'
  },
  underWarranty: { type: Boolean, default: false },
  warrantyRef: { type: String, default: '' },
  engineer: {
    id: { type: String, default: '' },
    name: { type: String, default: 'Unassigned' },
    phone: { type: String, default: '' }
  },
  scheduledOn: { type: Date },
  resolvedOn: { type: Date },
  serviceCharges: { type: Number, default: 0, min: 0 },
  partsCost: { type: Number, default: 0, min: 0 },
  travelCost: { type: Number, default: 0, min: 0 },
  engineerHours: { type: Number, default: 0, min: 0 },
  partsUsed: [partUsedSchema],
  resolutionNotes: { type: String, default: '' }
}, { timestamps: true });

// Auto-generate requestId if not provided
serviceRequestSchema.pre('validate', async function () {
  if (!this.requestId) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('ServiceRequest').countDocuments();
    this.requestId = `SR-${year}-${String(count + 1).padStart(3, '0')}`;
  }
});

export default mongoose.model('ServiceRequest', serviceRequestSchema);
