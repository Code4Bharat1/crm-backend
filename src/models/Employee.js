import mongoose from 'mongoose';

const employeeSchema = new mongoose.Schema({
  employeeCode: { type: String, required: true, unique: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  fullName: { type: String, required: true },
  role: { type: String, required: true },
  department: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  employmentType: { type: String, default: 'Full Time' },
  joiningDate: { type: Date, default: Date.now },
  status: { type: String, default: 'Active' },
  presentDays: { type: Number, default: 0 },
  leaveDays: { type: Number, default: 0 },
  overtimeHours: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model('Employee', employeeSchema);
