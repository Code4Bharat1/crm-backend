import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

async function updateAdmin() {
  await mongoose.connect(process.env.MONGODB_URI);
  const userCol = mongoose.connection.db.collection('users');
  const empCol = mongoose.connection.db.collection('employees');

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('123456', salt);

  // 1. Ensure employee record exists for admin@gmail.com
  let adminEmp = await empCol.findOne({ email: 'admin@gmail.com' });
  if (!adminEmp) {
    const emp001 = await empCol.findOne({ employeeCode: 'EMP001' });
    if (emp001) {
      await empCol.updateOne(
        { _id: emp001._id },
        { $set: { email: 'admin@gmail.com', fullName: 'Admin' } }
      );
      adminEmp = emp001;
    } else {
      const res = await empCol.insertOne({
        employeeCode: 'EMP001',
        firstName: 'System',
        lastName: 'Admin',
        fullName: 'Admin',
        role: 'Admin',
        department: 'Management',
        email: 'admin@gmail.com',
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
    }
  }

  // 2. Set admin@gmail.com in users collection with password 123456 and role Admin
  let adminUser = await userCol.findOne({ email: 'admin@gmail.com' });
  if (adminUser) {
    await userCol.updateOne(
      { _id: adminUser._id },
      { $set: { password: hashedPassword, role: 'Admin', name: 'Admin', employeeId: adminEmp._id } }
    );
    console.log('Updated existing user admin@gmail.com with password 123456');
  } else {
    // Check if admin@nexcore.com exists and update or create admin@gmail.com
    const nexcoreAdmin = await userCol.findOne({ email: 'admin@nexcore.com' });
    if (nexcoreAdmin) {
      await userCol.updateOne(
        { _id: nexcoreAdmin._id },
        { $set: { email: 'admin@gmail.com', password: hashedPassword, role: 'Admin', name: 'Admin', employeeId: adminEmp._id } }
      );
      console.log('Updated admin@nexcore.com to admin@gmail.com with password 123456');
    } else {
      await userCol.insertOne({
        name: 'Admin',
        email: 'admin@gmail.com',
        password: hashedPassword,
        role: 'Admin',
        employeeId: adminEmp._id,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('Created admin@gmail.com with password 123456');
    }
  }

  // Also ensure backup user exists if needed
  const check = await userCol.findOne({ email: 'admin@gmail.com' });
  const isMatch = await bcrypt.compare('123456', check.password);
  console.log('Verification: admin@gmail.com password match 123456 =', isMatch, 'Role =', check.role);

  process.exit(0);
}

updateAdmin();
