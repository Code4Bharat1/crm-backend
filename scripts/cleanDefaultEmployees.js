import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import Employee from '../src/models/Employee.js';
import User from '../src/models/User.js';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const empRes = await Employee.deleteMany({
    $or: [
      { email: { $regex: '@example\\.com$', $options: 'i' } },
      { employeeCode: { $in: ['EMP001', 'EMP003', 'EMP004', 'EMP005', 'EMP006', 'EMP007', 'EMP008', 'EMP009', 'EMP010', 'EMP011', 'EMP012'] } }
    ]
    
  });
  console.log(`Deleted ${empRes.deletedCount} default dummy employee records.`);

  const userRes = await User.deleteMany({
    email: { $regex: '@example\\.com$', $options: 'i' }
  });
  console.log(`Deleted ${userRes.deletedCount} default dummy user records.`);

  const remaining = await Employee.find({}, 'employeeCode fullName email role');
  console.log('Remaining real employees:', remaining);

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
