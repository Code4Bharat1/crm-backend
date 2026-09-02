import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Employee from '../src/models/Employee.js';
import Attendance from '../src/models/Attendance.js';

dotenv.config();

const clearSeed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const records = await Attendance.find({ remarks: 'Seed test data' });
    
    let deletedCount = 0;
    
    for (const record of records) {
      const emp = await Employee.findById(record.employeeId);
      if (emp) {
        if (record.status === 'Present') emp.presentDays = Math.max(0, emp.presentDays - 1);
        if (record.status === 'Leave') emp.leaveDays = Math.max(0, emp.leaveDays - 1);
        emp.overtimeHours = Math.max(0, emp.overtimeHours - record.overtimeHours);
        await emp.save();
      }
      await Attendance.deleteOne({ _id: record._id });
      deletedCount++;
    }
    
    console.log(`Deleted ${deletedCount} seed attendance records.`);
    process.exit(0);
  } catch (error) {
    console.error("Error clearing attendance seed:", error);
    process.exit(1);
  }
};

clearSeed();
