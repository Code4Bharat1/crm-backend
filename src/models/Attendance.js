import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  date: { type: String, required: true },
  status: { type: String, enum: ['Present', 'Absent', 'Leave', 'Half Day', 'Holiday', 'Week Off'], required: true },
  checkIn: { type: Date },
  checkOut: { type: Date },
  workedMinutes: { type: Number, default: 0 },
  overtimeHours: { type: Number, default: 0 },
  remarks: { type: String, default: '' },
  source: { type: String, default: 'Manual' }
}, { timestamps: true });

// Prevent duplicate attendance for same employee on same date
attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

export default mongoose.model('Attendance', attendanceSchema);
