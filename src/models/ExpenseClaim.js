import mongoose from 'mongoose';

const expenseClaimSchema = new mongoose.Schema({
  claimId: { type: String, required: true, unique: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  date: { type: String, required: true },
  category: { type: String, required: true },
  amount: { type: Number, required: true },
  project: { type: String, default: '' },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' }
}, { timestamps: true });

export default mongoose.model('ExpenseClaim', expenseClaimSchema);
