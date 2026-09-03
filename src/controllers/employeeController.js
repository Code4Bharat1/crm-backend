import Employee from '../models/Employee.js';
import { createAuditLog } from '../services/auditLogService.js';

export const createEmployee = async (req, res) => {
  try {
    const { firstName, lastName, role, department, phone, email, employmentType, joiningDate, status } = req.body;

    if (!firstName || !lastName || !role || !department || !phone || !email) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const existingEmail = await Employee.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }

    const count = await Employee.countDocuments();
    const employeeCode = `EMP${(count + 1).toString().padStart(3, '0')}`;
    const fullName = `${firstName} ${lastName}`;

    const newEmployee = new Employee({
      employeeCode,
      firstName,
      lastName,
      fullName,
      role,
      department,
      phone,
      email,
      employmentType: employmentType || 'Full Time',
      joiningDate: joiningDate || new Date(),
      status: status || 'Active',
      presentDays: 0,
      leaveDays: 0,
      overtimeHours: 0,
      isActive: true
    });

    await newEmployee.save();

    await createAuditLog({
      req,
      action: 'CREATE',
      module: 'EMPLOYEE',
      resourceType: 'Employee',
      resourceId: newEmployee._id,
      description: `Created employee ${employeeCode} - ${fullName}`,
      severity: 'INFO'
    });

    res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      data: newEmployee
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getEmployees = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', department, role, status } = req.query;
    const query = { isActive: true };

    if (department) query.department = department;
    if (role) query.role = role;
    if (status) query.status = status;

    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { employeeCode: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { department: { $regex: search, $options: 'i' } },
        { role: { $regex: search, $options: 'i' } }
      ];
    }

    const limitNum = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * limitNum;

    const employees = await Employee.find(query).skip(skip).limit(limitNum).sort({ createdAt: -1 });
    const total = await Employee.countDocuments(query);

    res.json({
      success: true,
      data: {
        employees,
        pagination: {
          page: parseInt(page, 10),
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getEmployeeById = async (req, res) => {
  try {
    const employee = await Employee.findOne({ _id: req.params.id, isActive: true });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    res.json({ success: true, data: employee });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateEmployee = async (req, res) => {
  try {
    const { firstName, lastName, role, department, phone, email, employmentType, joiningDate, status } = req.body;

    const employee = await Employee.findOne({ _id: req.params.id, isActive: true });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    if (firstName) employee.firstName = firstName;
    if (lastName) employee.lastName = lastName;
    if (firstName || lastName) {
      employee.fullName = `${employee.firstName} ${employee.lastName}`;
    }
    if (role) employee.role = role;
    if (department) employee.department = department;
    if (phone) employee.phone = phone;
    if (email && email !== employee.email) {
      const existing = await Employee.findOne({ email });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Email already in use' });
      }
      employee.email = email;
    }
    if (employmentType) employee.employmentType = employmentType;
    if (joiningDate) employee.joiningDate = joiningDate;
    if (status) employee.status = status;

    await employee.save();

    await createAuditLog({
      req,
      action: 'UPDATE',
      module: 'EMPLOYEE',
      resourceType: 'Employee',
      resourceId: employee._id,
      description: `Updated employee ${employee.employeeCode}`,
      severity: 'INFO'
    });

    res.json({ success: true, message: 'Employee updated successfully', data: employee });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findOne({ _id: req.params.id, isActive: true });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    employee.isActive = false;
    await employee.save();
    
    await createAuditLog({
      req,
      action: 'DELETE',
      module: 'EMPLOYEE',
      resourceType: 'Employee',
      resourceId: employee._id,
      description: `Deleted employee ${employee.employeeCode}`,
      severity: 'WARNING'
    });
    
    res.json({ success: true, message: 'Employee deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getEmployeeStats = async (req, res) => {
  try {
    const totalEmployees = await Employee.countDocuments({ isActive: true });
    const directors = await Employee.countDocuments({ role: 'Director', isActive: true });
    
    // Using Salesperson, Engineer, and Service as field roles per the UI prompt logic
    const fieldRoles = ['Salesperson', 'Engineer', 'Service'];
    const fieldTeam = await Employee.countDocuments({ role: { $in: fieldRoles }, isActive: true });

    // Assuming we have no expense claims module yet.
    const expenseClaimsPending = 0;

    res.json({
      success: true,
      data: {
        totalEmployees,
        directors,
        fieldTeam,
        expenseClaimsPending
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const exportEmployees = async (req, res) => {
  try {
    const employees = await Employee.find({ isActive: true }).sort({ createdAt: -1 });
    let csvStr = "Employee Code,Employee Name,Role,Department,Phone,Email,Present Days,Leave Days,Overtime Hours\n";
    employees.forEach(e => {
      csvStr += `"${e.employeeCode}","${e.fullName}","${e.role}","${e.department}","${e.phone}","${e.email}",${e.presentDays},${e.leaveDays},${e.overtimeHours}\n`;
    });
    res.header('Content-Type', 'text/csv');
    res.attachment('employees.csv');
    res.send(csvStr);

    await createAuditLog({
      req,
      action: 'EXPORT',
      module: 'EMPLOYEE',
      description: 'Exported employees list',
      severity: 'INFO'
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
