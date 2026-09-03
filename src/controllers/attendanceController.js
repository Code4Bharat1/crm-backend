import Attendance from '../models/Attendance.js';
import Employee from '../models/Employee.js';
import { createAuditLog } from '../services/auditLogService.js';

export const createAttendance = async (req, res) => {
  try {
    const { employeeId, date, status, overtimeHours, remarks } = req.body;

    if (!employeeId || !date || !status) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const existing = await Attendance.findOne({ employeeId, date });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Attendance already exists for this date' });
    }

    const newAttendance = new Attendance({
      employeeId,
      date,
      status,
      overtimeHours: overtimeHours || 0,
      remarks,
      source: 'Manual'
    });

    await newAttendance.save();

    // Update Employee counters
    if (status === 'Present') employee.presentDays += 1;
    if (status === 'Half Day') employee.presentDays += 0.5;
    if (status === 'Leave') employee.leaveDays += 1;
    if (overtimeHours) employee.overtimeHours += Number(overtimeHours);
    await employee.save();

    await createAuditLog({
      req,
      action: 'CREATE',
      module: 'ATTENDANCE',
      resourceType: 'Attendance',
      resourceId: newAttendance._id,
      description: `Created attendance for ${employee.fullName} on ${date}`,
      severity: 'INFO'
    });

    res.status(201).json({ success: true, message: 'Attendance created successfully', data: newAttendance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAttendance = async (req, res) => {
  try {
    const { page = 1, limit = 10, employeeId, status, fromDate, toDate } = req.query;
    const query = {};

    if (employeeId) query.employeeId = employeeId;
    if (status) query.status = status;
    if (fromDate || toDate) {
      query.date = {};
      if (fromDate) query.date.$gte = fromDate;
      if (toDate) query.date.$lte = toDate;
    }

    const limitNum = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * limitNum;

    const records = await Attendance.find(query)
      .populate('employeeId', 'fullName employeeCode')
      .skip(skip)
      .limit(limitNum)
      .sort({ date: -1 });

    const total = await Attendance.countDocuments(query);

    res.json({
      success: true,
      data: {
        records,
        pagination: { page: parseInt(page, 10), limit: limitNum, total, totalPages: Math.ceil(total / limitNum) }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAttendance = async (req, res) => {
  try {
    const { status, overtimeHours, remarks } = req.body;
    const record = await Attendance.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Record not found' });

    // Reverse old values from Employee
    const employee = await Employee.findById(record.employeeId);
    if (employee) {
      if (record.status === 'Present') employee.presentDays -= 1;
      if (record.status === 'Half Day') employee.presentDays -= 0.5;
      if (record.status === 'Leave') employee.leaveDays -= 1;
      if (record.overtimeHours) employee.overtimeHours -= record.overtimeHours;
      
      // Apply new values
      if (status) {
        if (status === 'Present') employee.presentDays += 1;
        if (status === 'Half Day') employee.presentDays += 0.5;
        if (status === 'Leave') employee.leaveDays += 1;
        record.status = status;
      }
      if (overtimeHours !== undefined) {
        employee.overtimeHours += Number(overtimeHours);
        record.overtimeHours = Number(overtimeHours);
      }
      await employee.save();
    }

    if (remarks !== undefined) record.remarks = remarks;
    await record.save();

    await createAuditLog({
      req,
      action: 'UPDATE',
      module: 'ATTENDANCE',
      resourceType: 'Attendance',
      resourceId: record._id,
      description: `Updated attendance for employee ${employee ? employee.fullName : record.employeeId}`,
      severity: 'INFO'
    });

    res.json({ success: true, message: 'Updated successfully', data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteAttendance = async (req, res) => {
  try {
    const record = await Attendance.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Record not found' });
    
    // Deduct from Employee stats
    const employee = await Employee.findById(record.employeeId);
    if (employee) {
      if (record.status === 'Present') employee.presentDays -= 1;
      if (record.status === 'Half Day') employee.presentDays -= 0.5;
      if (record.status === 'Leave') employee.leaveDays -= 1;
      if (record.overtimeHours) employee.overtimeHours -= record.overtimeHours;
      await employee.save();
    }

    await Attendance.deleteOne({ _id: req.params.id });
    
    await createAuditLog({
      req,
      action: 'DELETE',
      module: 'ATTENDANCE',
      resourceType: 'Attendance',
      resourceId: req.params.id,
      description: `Deleted attendance record`,
      severity: 'WARNING'
    });
    
    res.json({ success: true, message: 'Record deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAttendanceSummary = async (req, res) => {
  try {
    // Generate a summary dynamically for the current active month/year or overall
    const employees = await Employee.find({ isActive: true }).select('id fullName employeeCode role presentDays leaveDays overtimeHours');
    
    const data = employees.map(emp => ({
      employee: {
        id: emp._id,
        fullName: emp.fullName,
        employeeCode: emp.employeeCode,
        role: emp.role
      },
      presentDays: emp.presentDays,
      leaveDays: emp.leaveDays,
      overtimeHours: emp.overtimeHours
    }));

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAttendanceStats = async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        attendanceMode: "Manual",
        apiStatus: "Not Configured",
        lastSynchronization: null,
        recordsSynchronized: 0,
        failedRecords: 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const punchIn = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, message: 'Not authorized' });

    let employeeId = user.employeeId;
    if (!employeeId) {
      const emp = await Employee.findOne({ email: user.email });
      if (!emp) return res.status(404).json({ success: false, message: 'Linked employee not found' });
      employeeId = emp._id;
    }

    const todayDate = new Date().toISOString().split('T')[0];
    const existing = await Attendance.findOne({ employeeId, date: todayDate });
    if (existing) {
      if (existing.checkIn) {
         return res.status(400).json({ success: false, message: 'Already punched in today' });
      } else {
         existing.checkIn = new Date();
         existing.status = 'Present';
         await existing.save();

         await createAuditLog({
           req,
           action: 'PUNCH_IN',
           module: 'ATTENDANCE',
           resourceType: 'Attendance',
           resourceId: existing._id,
           description: `Employee punched in`,
           severity: 'INFO'
         });

         return res.json({ success: true, message: 'Punch in successful', data: existing });
      }
    }

    const newAttendance = await Attendance.create({
      employeeId,
      date: todayDate,
      status: 'Present',
      checkIn: new Date(),
      source: 'Manual'
    });

    const emp = await Employee.findById(employeeId);
    if (emp) {
      emp.presentDays += 1;
      await emp.save();
    }

    await createAuditLog({
      req,
      action: 'PUNCH_IN',
      module: 'ATTENDANCE',
      resourceType: 'Attendance',
      resourceId: newAttendance._id,
      description: `Employee punched in`,
      severity: 'INFO'
    });

    res.status(201).json({ success: true, message: 'Punch in successful', data: newAttendance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const punchOut = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, message: 'Not authorized' });

    let employeeId = user.employeeId;
    if (!employeeId) {
      const emp = await Employee.findOne({ email: user.email });
      if (!emp) return res.status(404).json({ success: false, message: 'Linked employee not found' });
      employeeId = emp._id;
    }

    const todayDate = new Date().toISOString().split('T')[0];
    const existing = await Attendance.findOne({ employeeId, date: todayDate });
    
    if (!existing || !existing.checkIn) {
      return res.status(400).json({ success: false, message: 'Must punch in first' });
    }
    if (existing.checkOut) {
      return res.status(400).json({ success: false, message: 'Already punched out today' });
    }

    const now = new Date();
    existing.checkOut = now;
    
    const diffMs = now - new Date(existing.checkIn);
    const diffMins = Math.round(diffMs / 60000);
    existing.workedMinutes = diffMins;

    await existing.save();

    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    const workedStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;

    await createAuditLog({
      req,
      action: 'PUNCH_OUT',
      module: 'ATTENDANCE',
      resourceType: 'Attendance',
      resourceId: existing._id,
      description: `Employee punched out after ${workedStr} hours`,
      severity: 'INFO'
    });

    res.json({ success: true, message: 'Punch out successful', data: { ...existing.toObject(), workedHours: workedStr } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTodayStatus = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, message: 'Not authorized' });

    let employeeId = user.employeeId;
    if (!employeeId) {
      const emp = await Employee.findOne({ email: user.email });
      if (!emp) return res.json({ success: true, data: { status: 'NOT_PUNCHED_IN', checkIn: null, checkOut: null } });
      employeeId = emp._id;
    }

    const todayDate = new Date().toISOString().split('T')[0];
    const existing = await Attendance.findOne({ employeeId, date: todayDate });

    if (!existing || !existing.checkIn) {
      return res.json({ success: true, data: { status: 'NOT_PUNCHED_IN', checkIn: null, checkOut: null } });
    }

    if (existing.checkOut) {
      return res.json({ 
        success: true, 
        data: { 
          status: 'COMPLETED', 
          checkIn: existing.checkIn, 
          checkOut: existing.checkOut, 
          workedMinutes: existing.workedMinutes 
        } 
      });
    }

    return res.json({ success: true, data: { status: 'WORKING', checkIn: existing.checkIn, checkOut: null } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
