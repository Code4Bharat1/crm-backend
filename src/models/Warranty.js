import mongoose from 'mongoose';

const warrantyClaimSchema = new mongoose.Schema({
  claimId: { type: String, required: true },
  date: { type: Date, default: Date.now },
  serviceRequestId: { type: String, default: '' },
  description: { type: String, required: true },
  amount: { type: Number, default: 0, min: 0 },
  status: {
    type: String,
    enum: ['Approved', 'Under Review', 'Rejected'],
    default: 'Approved'
  }
}, { _id: true });

const warrantySchema = new mongoose.Schema({
  warrantyNo: { type: String, unique: true }, // e.g. WAR-2026-001
  serialNo: { type: String, required: true, unique: true, index: true },
  product: {
    id: { type: String },
    name: { type: String, required: true },
    itemCode: { type: String, default: '' }
  },
  customer: {
    id: { type: String },
    name: { type: String, required: true },
    phone: { type: String, default: '' },
    email: { type: String, default: '' }
  },
  invoiceRef: { type: String, default: '' },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date, required: true },
  durationMonths: { type: Number, default: 12 },
  status: {
    type: String,
    enum: ['Active', 'Expiring Soon', 'Expired', 'Void'],
    default: 'Active'
  },
  coverageType: {
    type: String,
    enum: ['Comprehensive', 'Standard Manufacturer', 'Parts Only', 'Labor Only', 'AMC'],
    default: 'Standard Manufacturer'
  },
  terms: { type: String, default: 'Standard 1-year manufacturer warranty covering parts and labor defects under normal operating conditions.' },
  serviceCount: { type: Number, default: 0 },
  claims: [warrantyClaimSchema],
  amc: {
    isAmc: { type: Boolean, default: false },
    contractNo: { type: String, default: '' },
    value: { type: Number, default: 0 },
    renewalDate: { type: Date }
  }
}, { timestamps: true });

// Auto-generate warrantyNo if not provided
warrantySchema.pre('validate', async function () {
  if (!this.warrantyNo) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('Warranty').countDocuments();
    this.warrantyNo = `WAR-${year}-${String(count + 1).padStart(3, '0')}`;
  }

  // Auto calculate status based on endDate
  if (this.endDate) {
    const now = new Date();
    const expiry = new Date(this.endDate);
    const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      this.status = 'Expired';
    } else if (diffDays <= 30) {
      this.status = 'Expiring Soon';
    } else {
      this.status = 'Active';
    }
  }
});

export default mongoose.model('Warranty', warrantySchema);
