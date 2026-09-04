import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import Employee from '../models/Employee.js';
import Attendance from '../models/Attendance.js';

const MONGODB_URI = process.env.MONGODB_URI;

export async function seedRealAttendance() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to database.');

  const employees = await Employee.find({ isActive: true });
  console.log(`Found ${employees.length} active employees.`);

  if (employees.length === 0) {
    console.log('No employees found!');
    return;
  }

  // Remove old attendance records where employeeId is null or not in current active employees or date > 2026-09-04
  const deletedNulls = await Attendance.deleteMany({
    $or: [
      { employeeId: null },
      { employeeId: { $nin: employees.map(e => e._id) } },
      { date: { $gt: '2026-09-04' } }
    ]
  });
  console.log(`Removed ${deletedNulls.deletedCount} orphaned/invalid/future attendance records.`);

  // Generate date list from August 1, 2026 to September 4, 2026
  const dates = [];
  const start = new Date(2026, 7, 1); // August 1, 2026
  const end = new Date(2026, 8, 4);   // September 4, 2026

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dates.push({
      dateStr: `${year}-${month}-${day}`,
      dayOfWeek: d.getDay(), // 0 = Sunday, 6 = Saturday
      dayNum: d.getDate()
    });
  }

  console.log(`Generating attendance across ${dates.length} calendar days...`);

  let createdCount = 0;
  let updatedCount = 0;

  for (const emp of employees) {
    let empPresent = 0;
    let empLeave = 0;
    let empOT = 0;

    for (const d of dates) {
      const { dateStr, dayOfWeek, dayNum } = d;

      let existing = await Attendance.findOne({ employeeId: emp._id, date: dateStr });

      // Sunday = Week Off
      if (dayOfWeek === 0) {
        if (!existing) {
          await Attendance.create({
            employeeId: emp._id,
            date: dateStr,
            status: 'Week Off',
            workedMinutes: 0,
            overtimeHours: 0,
            remarks: 'Scheduled weekly rest day',
            source: 'System'
          });
          createdCount++;
        }
        continue;
      }

      // Independence Day on August 15
      if (dateStr === '2026-08-15') {
        if (!existing) {
          await Attendance.create({
            employeeId: emp._id,
            date: dateStr,
            status: 'Holiday',
            workedMinutes: 0,
            overtimeHours: 0,
            remarks: 'Independence Day Holiday',
            source: 'System'
          });
          createdCount++;
        }
        continue;
      }

      // Planned leave
      const isLeaveDay = (emp.employeeCode === 'EMP002' && dayNum === 18) ||
                         (emp.employeeCode === 'EMP008' && dayNum === 21) ||
                         (emp.employeeCode === 'EMP009' && dayNum === 26) ||
                         (emp.employeeCode === 'EMP017' && dayNum === 11) ||
                         (emp.employeeCode === 'EMP007' && dayNum === 14);

      if (isLeaveDay) {
        empLeave += 1;
        if (!existing) {
          await Attendance.create({
            employeeId: emp._id,
            date: dateStr,
            status: 'Leave',
            workedMinutes: 0,
            overtimeHours: 0,
            remarks: 'Approved casual/earned leave',
            source: 'ESS Portal'
          });
          createdCount++;
        }
        continue;
      }

      // Occasional half day on some Saturdays
      const isHalfDay = dayOfWeek === 6 && (dayNum === 8 || dayNum === 22);
      if (isHalfDay) {
        empPresent += 0.5;
        const checkIn = new Date(`${dateStr}T09:10:00.000Z`);
        const checkOut = new Date(`${dateStr}T13:40:00.000Z`);
        const workedMins = 270;

        if (!existing) {
          await Attendance.create({
            employeeId: emp._id,
            date: dateStr,
            status: 'Half Day',
            checkIn,
            checkOut,
            workedMinutes: workedMins,
            overtimeHours: 0,
            remarks: 'Half Day Saturday shift',
            source: 'Biometric ESS'
          });
          createdCount++;
        }
        continue;
      }

      // Normal Working Day (Present)
      empPresent += 1;

      // Realistic check-in time between 08:50 AM and 09:22 AM
      const checkInMinutes = 50 + ((dayNum * 7 + emp.fullName.length * 3) % 32);
      const checkInHour = checkInMinutes >= 60 ? 9 : 8;
      const checkInMin = checkInMinutes % 60;
      const checkIn = new Date(`${dateStr}T${String(checkInHour).padStart(2, '0')}:${String(checkInMin).padStart(2, '0')}:00.000Z`);

      // Field technicians & PMs work overtime on several days
      const isTechOrPM = emp.role.toLowerCase().includes('tech') || emp.role.toLowerCase().includes('project');
      const otHours = isTechOrPM && (dayNum % 3 === 0) ? (1.0 + (dayNum % 3) * 0.5) : (dayNum % 5 === 0 ? 1.0 : 0);
      empOT += otHours;

      // Check-out between 18:00 and 19:45
      const checkOutHour = 18 + Math.floor(otHours);
      const checkOutMin = (dayNum * 11) % 45;
      const checkOut = new Date(`${dateStr}T${String(checkOutHour).padStart(2, '0')}:${String(checkOutMin).padStart(2, '0')}:00.000Z`);

      const workedMins = Math.round((checkOut.getTime() - checkIn.getTime()) / 60000);
      const source = isTechOrPM && (dayNum % 2 === 0) ? 'Mobile Field Check-in' : 'Biometric ESS';
      const remarks = otHours > 0 
        ? `Shift completed + ${otHours} hrs overtime logged`
        : 'Regular on-time biometric verification';

      if (!existing) {
        await Attendance.create({
          employeeId: emp._id,
          date: dateStr,
          status: 'Present',
          checkIn,
          checkOut,
          workedMinutes: workedMins,
          overtimeHours: otHours,
          remarks,
          source
        });
        createdCount++;
      } else {
        existing.status = 'Present';
        existing.checkIn = checkIn;
        existing.checkOut = checkOut;
        existing.workedMinutes = workedMins;
        existing.overtimeHours = otHours;
        existing.remarks = remarks;
        existing.source = source;
        await existing.save();
        updatedCount++;
      }
    }

    // Update Employee's summary fields
    emp.presentDays = empPresent;
    emp.leaveDays = empLeave;
    emp.overtimeHours = empOT;
    await emp.save();
    console.log(`Updated ${emp.fullName} (${emp.role}): ${empPresent} present, ${empLeave} leave, ${empOT}h OT`);
  }

  console.log(`Seeding complete! Created: ${createdCount}, Updated: ${updatedCount}`);
}

// Run directly
seedRealAttendance()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error seeding attendance:', err);
    process.exit(1);
  });
