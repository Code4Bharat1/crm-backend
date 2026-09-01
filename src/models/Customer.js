import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // e.g., CUST-001
  name: { type: String, required: true },
  type: { type: String, required: true }, // OEM, End User, System Integrator, EPC
  status: { type: String, required: true }, // Active, Inactive
  area: { type: String }, // e.g., North, South
  industry: { type: String },
  salesPerson: { type: String },
  contactPerson: {
    name: { type: String },
    email: { type: String },
    phone: { type: String },
  },
  address: {
    street: { type: String },
    city: { type: String },
    state: { type: String },
    pinCode: { type: String },
  },
  gstNumber: { type: String },
  totalRevenue: { type: Number, default: 0 },
  outstanding: { type: Number, default: 0 }
}, { timestamps: true });

export default mongoose.model('Customer', customerSchema);
