import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  id: { type: String, unique: true }, // e.g., CUST-001
  name: { type: String, required: true },
  type: { type: String, default: 'End User' }, // OEM, End User, System Integrator, EPC, Trader
  status: { type: String, enum: ['Active', 'Inactive', 'Lead'], default: 'Active' },
  area: { type: String }, // e.g., Chakan MIDC, Bhosari, PCMC, Pune
  industry: { type: String }, // Automotive, Packaging, Pharma, Food, Robotics
  salesPerson: { type: String },
  contactPerson: {
    name: { type: String },
    email: { type: String },
    phone: { type: String },
    designation: { type: String },
  },
  address: {
    street: { type: String },
    city: { type: String },
    state: { type: String, default: 'Maharashtra' },
    pinCode: { type: String },
    country: { type: String, default: 'India' },
  },
  gstNumber: { type: String },
  panNumber: { type: String },
  paymentTerms: { type: String, default: '30 Days Net' },
  creditLimit: { type: Number, default: 0 },
  totalRevenue: { type: Number, default: 0 },
  outstanding: { type: Number, default: 0 },
  notes: { type: String },
}, { timestamps: true });

customerSchema.pre('validate', async function () {
  if (!this.id) {
    const count = await mongoose.model('Customer').countDocuments();
    this.id = `CUST-${String(count + 1).padStart(3, '0')}`;
  }
});

export default mongoose.model('Customer', customerSchema);
