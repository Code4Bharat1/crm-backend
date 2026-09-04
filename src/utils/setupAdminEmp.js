import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';

async function setupAdminEmp() {
  await mongoose.connect(process.env.MONGODB_URI);
  const userCol = mongoose.connection.db.collection('users');
  const empCol = mongoose.connection.db.collection('employees');
  
  let adminEmp = await empCol.findOne({ email: 'admin@nexcore.com' });
  if (!adminEmp) {
    const res = await empCol.insertOne({
      employeeCode: 'EMP001',
      firstName: 'System',
      lastName: 'Admin',
      fullName: 'System Administrator',
      role: 'Admin',
      department: 'Executive Management',
      email: 'admin@nexcore.com',
      phone: '+91 99999 00000',
      status: 'Active',
      isActive: true,
      presentDays: 28,
      leaveDays: 0,
      overtimeHours: 5,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    adminEmp = { _id: res.insertedId };
    console.log('Created Admin Employee with ID:', res.insertedId);
  }

  await userCol.updateOne(
    { email: 'admin@nexcore.com' },
    { $set: { employeeId: adminEmp._id } }
  );

  console.log('Linked admin user to employeeId:', adminEmp._id);
  process.exit(0);
}

setupAdminEmp();
