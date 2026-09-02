import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Employee from '../src/models/Employee.js';
import Attendance from '../src/models/Attendance.js';

dotenv.config();

const testAttendance = async () => {
  try {
    // 1. Connect to DB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB for testing.");

    // 2. Find any active employee
    const employee = await Employee.findOne({ isActive: true });
    
    if (!employee) {
      console.log("❌ Koi employee nahi mila. Pehle 'npm run seed:employees' chalayen.");
      process.exit(1);
    }

    console.log(`\n👨‍💼 Employee Found: ${employee.fullName} (Present Days before test: ${employee.presentDays})`);

    // 3. Prepare manual attendance data for a unique test date
    const testDate = `2026-09-${Math.floor(Math.random() * 28) + 1}`; // Random date to avoid duplicates if run multiple times
    
    console.log(`📅 Marking attendance for date: ${testDate}`);
    
    const existing = await Attendance.findOne({ employeeId: employee._id, date: testDate });
    if (existing) {
        console.log("⚠️ Is date ki attendance pehle se majood hai. Dobara test run karein.");
        process.exit(0);
    }

    // 4. Create Attendance Record (Backend logic simulation)
    const newAttendance = await Attendance.create({
      employeeId: employee._id,
      date: testDate,
      status: 'Present',
      overtimeHours: 2,
      remarks: 'Manual entry test from script',
      source: 'Manual'
    });

    console.log("✅ Attendance record successfully created in DB!");

    // 5. Update Employee stats (as our controller does)
    employee.presentDays += 1;
    employee.overtimeHours += 2;
    await employee.save();

    console.log(`📈 Employee stats updated! (New Present Days: ${employee.presentDays}, New Overtime: ${employee.overtimeHours})\n`);
    
    console.log("Test successful! Frontend par 'Create Attendance' button dabane par bilkul yahi backend logic execute hota hai.");
    process.exit(0);

  } catch (error) {
    console.error("❌ Error during test:", error);
    process.exit(1);
  }
};

testAttendance();
