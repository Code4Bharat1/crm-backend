import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Employee from '../src/models/Employee.js';
import Attendance from '../src/models/Attendance.js';

dotenv.config();

const targetData = {
  "Rajesh Deshpande": { present: 24, leave: 2, overtime: 17, absent: 4 },
  "Sunita Kulkarni": { present: 19, leave: 0, overtime: 5, absent: 11 },
  "Zaid Shaikh": { present: 22, leave: 2, overtime: 8, absent: 6 },
  "Amruta Joshi": { present: 24, leave: 3, overtime: 19, absent: 3 },
  "Nilesh Pawar": { present: 23, leave: 0, overtime: 17, absent: 7 },
  "Prasad Bhosale": { present: 18, leave: 1, overtime: 14, absent: 11 },
  "Kiran Jadhav": { present: 19, leave: 2, overtime: 0, absent: 9 },
  "Snehal Patil": { present: 23, leave: 3, overtime: 5, absent: 4 },
  "Vivek Ranade": { present: 23, leave: 1, overtime: 0, absent: 6 },
  "Imran Qureshi": { present: 19, leave: 1, overtime: 14, absent: 10 },
  "Rohit Shinde": { present: 23, leave: 2, overtime: 14, absent: 5 },
  "Pooja Nair": { present: 18, leave: 3, overtime: 22, absent: 9 }
};

const runSeed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const employees = await Employee.find({ isActive: true });
    
    if (employees.length === 0) {
      console.log("No employees found. Please seed employees first.");
      process.exit(0);
    }

    let recordsCreated = 0;
    
    for (const emp of employees) {
      const data = targetData[emp.fullName] || { present: 20, leave: 2, overtime: 5, absent: 8 };
      
      const statuses = [];
      for(let i=0; i<data.present; i++) statuses.push('Present');
      for(let i=0; i<data.leave; i++) statuses.push('Leave');
      for(let i=0; i<data.absent; i++) statuses.push('Absent');
      
      // We will seed September 2026 (max 30 days)
      const year = 2026;
      const month = 9;
      
      let presentCount = 0;
      let totalOvertimeAssigned = 0;

      for (let day = 1; day <= 30; day++) {
        if (statuses.length === 0) break;
        
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const status = statuses.pop();
        
        let otHours = 0;
        if (status === 'Present' && totalOvertimeAssigned < data.overtime) {
          otHours = 1; // Assign 1 hour OT randomly on present days until we reach target
          totalOvertimeAssigned++;
        }

        const existing = await Attendance.findOne({ employeeId: emp._id, date: dateStr });
        
        if (!existing) {
          await Attendance.create({
            employeeId: emp._id,
            date: dateStr,
            status: status,
            overtimeHours: otHours,
            remarks: 'Seed test data',
            source: 'Manual'
          });
          
          if (status === 'Present') emp.presentDays += 1;
          if (status === 'Leave') emp.leaveDays += 1;
          emp.overtimeHours += otHours;
          
          recordsCreated++;
        }
      }
      
      await emp.save();
    }
    
    console.log(`Seeded ${recordsCreated} attendance records for ${employees.length} employees.`);
    process.exit(0);
  } catch (error) {
    console.error("Error seeding attendance:", error);
    process.exit(1);
  }
};

runSeed();
