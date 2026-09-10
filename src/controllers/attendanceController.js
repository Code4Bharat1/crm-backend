import Attendance from '../models/Attendance.js';
import Employee from '../models/Employee.js';
import CompanySettings from '../models/CompanySettings.js';
import { createAuditLog } from '../services/auditLogService.js';
import { getISTDateString } from '../utils/dateUtils.js';

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

const checkIsAdmin = (user) => {
  if (!user) return false;
  const r = (user.role || '').toLowerCase().trim();
  return r === 'admin' || r === 'director' || r === 'admin manager';
};

export const getAttendance = async (req, res) => {
  try {
    const { page = 1, limit = 20, employeeId, status, fromDate, toDate, search } = req.query;
    const query = {};
    const user = req.user;
    const isAdmin = checkIsAdmin(user);

    // If logged-in user is an employee (not admin/HR), strictly lock to their assigned employeeId
    if (user && !isAdmin) {
      let userEmpId = user.employeeId;
      if (!userEmpId) {
        const emp = await Employee.findOne({ email: user.email });
        if (emp) userEmpId = emp._id;
      }
      if (userEmpId) {
        query.employeeId = userEmpId;
      } else {
        query.employeeId = { $ne: null };
      }
    } else {
      if (employeeId && employeeId !== 'All') {
        query.employeeId = employeeId;
      } else {
        query.employeeId = { $ne: null };
      }
    }

    if (status && status !== 'All') {
      query.status = status;
    }

    if (fromDate || toDate) {
      query.date = {};
      if (fromDate) query.date.$gte = fromDate;
      if (toDate) query.date.$lte = toDate;
    }

    if (search && search.trim()) {
      const s = search.trim();
      const matchedEmployees = await Employee.find({
        $or: [
          { fullName: { $regex: s, $options: 'i' } },
          { employeeCode: { $regex: s, $options: 'i' } },
          { role: { $regex: s, $options: 'i' } }
        ]
      }).select('_id');
      const empIds = matchedEmployees.map(e => e._id);

      query.$or = [
        ...(empIds.length > 0 ? [{ employeeId: { $in: empIds } }] : []),
        { date: { $regex: s, $options: 'i' } },
        { status: { $regex: s, $options: 'i' } },
        { remarks: { $regex: s, $options: 'i' } },
        { source: { $regex: s, $options: 'i' } }
      ];
    }

    const limitNum = parseInt(limit, 10) || 20;
    const skip = (parseInt(page, 10) - 1) * limitNum;

    const records = await Attendance.find(query)
      .populate('employeeId', 'fullName employeeCode role department email phone')
      .skip(skip)
      .limit(limitNum)
      .sort({ date: -1, createdAt: -1 });

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
    const user = req.user;
    const isAdmin = checkIsAdmin(user);
    let empQuery = { isActive: true };

    if (user && !isAdmin) {
      let userEmpId = user.employeeId;
      if (!userEmpId) {
        const emp = await Employee.findOne({ email: user.email });
        if (emp) userEmpId = emp._id;
      }
      if (userEmpId) empQuery = { _id: userEmpId };
    }

    const employees = await Employee.find(empQuery).select('id fullName employeeCode role department presentDays leaveDays overtimeHours');
    
    // Recalculate accurately from actual attendance records for each employee
    const data = await Promise.all(employees.map(async emp => {
      const records = await Attendance.find({ employeeId: emp._id });
      const presentCount = records.filter(r => r.status === 'Present').length + (records.filter(r => r.status === 'Half Day').length * 0.5);
      const leaveCount = records.filter(r => r.status === 'Leave').length;
      const overtime = records.reduce((sum, r) => sum + (r.overtimeHours || 0), 0);
      const totalWorkedMinutes = records.reduce((sum, r) => sum + (r.workedMinutes || 0), 0);
      const avgHours = presentCount > 0 ? (totalWorkedMinutes / (presentCount * 60)).toFixed(1) : "0.0";
      const workingDays = records.filter(r => r.status !== 'Week Off' && r.status !== 'Holiday').length;

      return {
        employee: {
          id: emp._id,
          fullName: emp.fullName,
          employeeCode: emp.employeeCode,
          role: emp.role,
          department: emp.department
        },
        presentDays: presentCount,
        leaveDays: leaveCount,
        overtimeHours: overtime,
        avgHours: Number(avgHours),
        totalRecords: records.length,
        attendanceRate: workingDays > 0 ? Math.min(100, Math.round((presentCount / workingDays) * 100)) : 0
      };
    }));

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAttendanceStats = async (req, res) => {
  try {
    const user = req.user;
    const isAdmin = checkIsAdmin(user);

    if (user && !isAdmin) {
      let userEmpId = user.employeeId;
      if (!userEmpId) {
        const emp = await Employee.findOne({ email: user.email });
        if (emp) userEmpId = emp._id;
      }
      const myRecords = await Attendance.find({ employeeId: userEmpId }).sort({ date: -1 });
      const todayStr = getISTDateString();
      const todayRec = myRecords.find(r => r.date === todayStr);
      const myPresent = myRecords.filter(r => r.status === 'Present' || r.status === 'Half Day').length;
      const myLeave = myRecords.filter(r => r.status === 'Leave').length;
      const myOT = myRecords.reduce((sum, r) => sum + (r.overtimeHours || 0), 0);

      const now = new Date();
      let todayStatus = 'NOT_PUNCHED_IN';
      if (todayRec) {
        if (todayRec.checkOut) todayStatus = 'COMPLETED';
        else if (todayRec.checkIn) todayStatus = 'WORKING';
        else if (todayRec.status === 'Leave') todayStatus = 'LEAVE';
        else todayStatus = todayRec.status;
      }

      return res.json({
        success: true,
        data: {
          isEmployeeView: true,
          attendanceMode: "Employee Self-Service",
          apiStatus: "Active",
          lastSynchronization: `Today, ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`,
          recordsSynchronized: myRecords.length,
          totalEmployees: 1,
          presentToday: todayRec && (todayRec.status === 'Present' || todayRec.status === 'Half Day') ? 1 : 0,
          leaveToday: todayRec && todayRec.status === 'Leave' ? 1 : 0,
          attendanceRateToday: myRecords.length > 0 ? Math.round((myPresent / myRecords.length) * 100) : 100,
          totalOvertimeHours: Math.round(myOT * 10) / 10,
          personalPresentDays: myPresent,
          personalLeaveDays: myLeave,
          todayStatus,
          todayRecord: todayRec || null,
          recentRecords: myRecords.slice(0, 10)
        }
      });
    }

    const todayStr = getISTDateString();
    const activeEmployees = await Employee.find({ isActive: true })
      .select('fullName employeeCode role department email phone')
      .sort({ fullName: 1 });
    const totalEmployees = activeEmployees.length;

    // Today's attendance records
    const todayRecords = await Attendance.find({ date: todayStr });
    const todayMap = new Map();
    todayRecords.forEach(r => {
      const eid = r.employeeId?.toString();
      if (eid) todayMap.set(eid, r);
    });

    let workingNow = 0;
    let completedToday = 0;
    let leaveToday = 0;

    const todayRoster = activeEmployees.map(emp => {
      const rec = todayMap.get(emp._id.toString());
      let status = 'NOT_PUNCHED_IN';
      if (rec) {
        if (rec.checkOut) {
          status = 'COMPLETED';
          completedToday += 1;
        } else if (rec.checkIn) {
          status = 'WORKING';
          workingNow += 1;
        } else if (rec.status === 'Leave') {
          status = 'LEAVE';
          leaveToday += 1;
        } else if (rec.status === 'Present' || rec.status === 'Half Day') {
          status = 'COMPLETED';
          completedToday += 1;
        } else {
          status = rec.status;
        }
      }

      return {
        employeeId: emp._id,
        fullName: emp.fullName,
        employeeCode: emp.employeeCode,
        role: emp.role,
        department: emp.department || 'General',
        email: emp.email,
        status,
        checkIn: rec?.checkIn || null,
        checkOut: rec?.checkOut || null,
        workedMinutes: rec?.workedMinutes || 0,
        overtimeHours: rec?.overtimeHours || 0,
        remarks: rec?.remarks || '',
        source: rec?.source || 'Web'
      };
    });

    const presentToday = workingNow + completedToday;
    const absentToday = Math.max(0, totalEmployees - (presentToday + leaveToday));
    const attendanceRateToday = totalEmployees > 0 ? Math.round((presentToday / totalEmployees) * 100) : 0;

    // All active attendance records for total overtime
    const allRecords = await Attendance.find({ employeeId: { $ne: null } });
    const totalOvertime = allRecords.reduce((sum, r) => sum + (r.overtimeHours || 0), 0);

    const now = new Date();
    const syncTimeStr = `Today, ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;

    res.json({
      success: true,
      data: {
        isEmployeeView: false,
        attendanceMode: "Biometric & ESS",
        apiStatus: "Active & Synchronised",
        lastSynchronization: syncTimeStr,
        recordsSynchronized: allRecords.length,
        failedRecords: 0,
        totalEmployees,
        presentToday,
        workingNow,
        completedToday,
        absentToday,
        leaveToday,
        attendanceRateToday,
        totalOvertimeHours: Math.round(totalOvertime * 10) / 10,
        todayRoster
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const punchIn = async (req, res) => {
  try {
    const user = req.user;
    const isAdmin = checkIsAdmin(user);
    let employeeId = req.body?.employeeId;

    // Non-admin employees can only punch in for themselves
    if (user && !isAdmin) {
      employeeId = user.employeeId;
      if (!employeeId) {
        const emp = await Employee.findOne({ email: user.email });
        if (emp) employeeId = emp._id;
      }
    } else if (!employeeId && user) {
      employeeId = user.employeeId;
      if (!employeeId) {
        const emp = await Employee.findOne({ email: user.email });
        if (emp) employeeId = emp._id;
      }
    }

    if (!employeeId) {
      return res.status(400).json({ success: false, message: 'Employee ID is required for punch in' });
    }

    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const todayDate = getISTDateString();
    const punchTime = new Date();
    const source = req.body?.source || 'Employee Panel (Web)';
    const remarks = req.body?.remarks || 'Clocked in via Employee Self-Service Panel';

    let existing = await Attendance.findOne({ employeeId, date: todayDate });
    if (existing) {
      if (existing.checkIn && !req.body?.force) {
        return res.status(400).json({ success: false, message: `${employee.fullName} is already punched in today at ${new Date(existing.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` });
      }
      existing.checkIn = punchTime;
      existing.status = 'Present';
      existing.source = source;
      if (req.body?.remarks) existing.remarks = req.body.remarks;
      await existing.save();

      await createAuditLog({
        req,
        action: 'PUNCH_IN',
        module: 'ATTENDANCE',
        resourceType: 'Attendance',
        resourceId: existing._id,
        description: `${employee.fullName} (${employee.employeeCode}) punched in via Employee Panel at ${punchTime.toLocaleTimeString()}`,
        severity: 'INFO'
      });

      const populated = await Attendance.findById(existing._id).populate('employeeId', 'fullName employeeCode role department');
      return res.json({ success: true, message: `Punched in successfully as ${employee.fullName}!`, data: populated });
    }

    const newAttendance = await Attendance.create({
      employeeId,
      date: todayDate,
      status: 'Present',
      checkIn: punchTime,
      source,
      remarks
    });

    employee.presentDays = (employee.presentDays || 0) + 1;
    await employee.save();

    await createAuditLog({
      req,
      action: 'PUNCH_IN',
      module: 'ATTENDANCE',
      resourceType: 'Attendance',
      resourceId: newAttendance._id,
      description: `${employee.fullName} (${employee.employeeCode}) punched in via Employee Panel at ${punchTime.toLocaleTimeString()}`,
      severity: 'INFO'
    });

    const populated = await Attendance.findById(newAttendance._id).populate('employeeId', 'fullName employeeCode role department');
    res.status(201).json({ success: true, message: `Punched in successfully as ${employee.fullName}!`, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const punchOut = async (req, res) => {
  try {
    const user = req.user;
    const isAdmin = checkIsAdmin(user);
    let employeeId = req.body?.employeeId;

    // Non-admin employees can only punch out for themselves
    if (user && !isAdmin) {
      employeeId = user.employeeId;
      if (!employeeId) {
        const emp = await Employee.findOne({ email: user.email });
        if (emp) employeeId = emp._id;
      }
    } else if (!employeeId && user) {
      employeeId = user.employeeId;
      if (!employeeId) {
        const emp = await Employee.findOne({ email: user.email });
        if (emp) employeeId = emp._id;
      }
    }

    if (!employeeId) {
      return res.status(400).json({ success: false, message: 'Employee ID is required for punch out' });
    }

    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const todayDate = getISTDateString();
    const existing = await Attendance.findOne({ employeeId, date: todayDate });

    if (!existing || !existing.checkIn) {
      return res.status(400).json({ success: false, message: `${employee.fullName} has not punched in today yet` });
    }
    if (existing.checkOut && !req.body?.force) {
      return res.status(400).json({ success: false, message: `${employee.fullName} already punched out today at ${new Date(existing.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` });
    }

    const now = new Date();
    existing.checkOut = now;

    const diffMs = now - new Date(existing.checkIn);
    const diffMins = Math.max(1, Math.round(diffMs / 60000));
    existing.workedMinutes = diffMins;

    // Overtime if worked > 480 mins (8 hours)
    if (diffMins > 480) {
      const otHours = Math.round(((diffMins - 480) / 60) * 10) / 10;
      existing.overtimeHours = otHours;
      employee.overtimeHours = (employee.overtimeHours || 0) + otHours;
      await employee.save();
    }

    if (req.body?.remarks) {
      existing.remarks = (existing.remarks ? `${existing.remarks} | ` : '') + req.body.remarks;
    }

    await existing.save();

    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    const workedStr = `${hours}h ${mins}m`;

    await createAuditLog({
      req,
      action: 'PUNCH_OUT',
      module: 'ATTENDANCE',
      resourceType: 'Attendance',
      resourceId: existing._id,
      description: `${employee.fullName} (${employee.employeeCode}) punched out via Employee Panel after ${workedStr}`,
      severity: 'INFO'
    });

    const populated = await Attendance.findById(existing._id).populate('employeeId', 'fullName employeeCode role department');
    res.json({
      success: true,
      message: `Punched out successfully as ${employee.fullName}! Shift Duration: ${workedStr}`,
      data: { ...populated.toObject(), workedHours: workedStr }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTodayStatus = async (req, res) => {
  try {
    const user = req.user;
    const isAdmin = checkIsAdmin(user);
    let employeeId = req.query?.employeeId || req.body?.employeeId;

    // Non-admin employees can only check their own status
    if (user && !isAdmin) {
      employeeId = user.employeeId;
      if (!employeeId) {
        const emp = await Employee.findOne({ email: user.email });
        if (emp) employeeId = emp._id;
      }
    } else if (!employeeId && user) {
      employeeId = user.employeeId;
      if (!employeeId) {
        const emp = await Employee.findOne({ email: user.email });
        if (emp) employeeId = emp._id;
      }
    }

    if (!employeeId) {
      return res.json({ success: true, data: { status: 'NOT_PUNCHED_IN', checkIn: null, checkOut: null, employee: null } });
    }

    const employee = await Employee.findById(employeeId).select('fullName employeeCode role department');
    const todayDate = getISTDateString();
    const existing = await Attendance.findOne({ employeeId, date: todayDate });

    if (!existing || !existing.checkIn) {
      return res.json({
        success: true,
        data: { status: 'NOT_PUNCHED_IN', checkIn: null, checkOut: null, employee }
      });
    }

    if (existing.checkOut) {
      return res.json({
        success: true,
        data: {
          status: 'COMPLETED',
          checkIn: existing.checkIn,
          checkOut: existing.checkOut,
          workedMinutes: existing.workedMinutes,
          overtimeHours: existing.overtimeHours,
          employee
        }
      });
    }

    const workedMins = Math.round((new Date() - new Date(existing.checkIn)) / 60000);
    return res.json({
      success: true,
      data: {
        status: 'WORKING',
        checkIn: existing.checkIn,
        checkOut: null,
        workedMinutes: workedMins,
        employee
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/attendance/weekend-policy
export const getWeekendPolicy = async (req, res) => {
  try {
    let settings = await CompanySettings.findOne();
    if (!settings) {
      settings = await CompanySettings.create({});
    }
    const weekendPolicy = settings.weekendPolicy || { saturdayOff: true, sundayOff: true };
    res.json({ success: true, data: weekendPolicy });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/attendance/weekend-policy (Admin, HR, and Manager panels only)
export const updateWeekendPolicy = async (req, res) => {
  try {
    const user = req.user;
    const role = (user?.role || '').toLowerCase().trim();
    const isAllowed = role === 'admin' || role === 'director' || role === 'admin manager' || role === 'hr' || role.includes('manager');

    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied. Saturday and Sunday policy controls are restricted to Admin, HR, and Manager panels only.'
      });
    }

    const { saturdayOff, sundayOff } = req.body;
    let settings = await CompanySettings.findOne();
    if (!settings) {
      settings = new CompanySettings({});
    }

    const currentPolicy = settings.weekendPolicy || { saturdayOff: true, sundayOff: true };
    const newSaturdayOff = typeof saturdayOff === 'boolean' ? saturdayOff : currentPolicy.saturdayOff;
    const newSundayOff = typeof sundayOff === 'boolean' ? sundayOff : currentPolicy.sundayOff;

    settings.weekendPolicy = {
      saturdayOff: newSaturdayOff,
      sundayOff: newSundayOff
    };

    await settings.save();

    await createAuditLog({
      req,
      action: 'UPDATE_WEEKEND_POLICY',
      module: 'ATTENDANCE',
      resourceType: 'CompanySettings',
      resourceId: settings._id,
      description: `Weekend Policy updated by ${user.name || user.email} (${user.role}): Saturday is ${newSaturdayOff ? 'OFF (Weekend Off)' : 'ON (Working Day)'}, Sunday is ${newSundayOff ? 'OFF (Weekend Off)' : 'ON (Working Day)'}`,
      severity: 'INFO'
    });

    res.json({
      success: true,
      message: 'Weekend policy updated successfully',
      data: settings.weekendPolicy
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
