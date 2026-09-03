
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import connectDB from '../src/config/db.js';

// Collections to clean (transient/test business records)
const COLLECTIONS_TO_CLEAN = [
  'projects',
  'servicerequests',
  'warranties',
  'quotations',
  'salesinvoices',
  'salesorders',
  'deliverynotes',
  'proformainvoices',
  'purchaseorders',
  'customers',
  'serialnumbers',
  'products',
  'suppliers',
  'leads',
  'whatsappmessages',
  'emails',
  'expenseclaims',
  'salesdocuments'
];

async function cleanDummyData() {
  await connectDB();
  console.log('Connected to MongoDB. Beginning cleanup of test and dummy data...\n');

  const summary = {};

  for (const collName of COLLECTIONS_TO_CLEAN) {
    try {
      const exists = await mongoose.connection.db.listCollections({ name: collName }).hasNext();
      if (exists) {
        const countBefore = await mongoose.connection.db.collection(collName).countDocuments();
        if (countBefore > 0) {
          const res = await mongoose.connection.db.collection(collName).deleteMany({});
          summary[collName] = { countBefore, deleted: res.deletedCount };
          console.log(`🧹 Cleaned [${collName}]: removed ${res.deletedCount} test record(s).`);
        } else {
          summary[collName] = { countBefore: 0, deleted: 0 };
          console.log(`ℹ️ [${collName}] was already empty.`);
        }
      }
    } catch (err) {
      console.error(`❌ Error cleaning [${collName}]:`, err.message);
    }
  }

  // Verify preserved collections
  console.log('\n🔒 PRESERVED ESSENTIAL COLLECTIONS:');
  const userCount = await mongoose.connection.db.collection('users').countDocuments();
  const empCount = await mongoose.connection.db.collection('employees').countDocuments();
  const companyCount = await mongoose.connection.db.collection('companysettings').countDocuments();
  const attendanceCount = await mongoose.connection.db.collection('attendances').countDocuments();

  console.log(`- Users: ${userCount} active users`);
  console.log(`- Employees: ${empCount} employees`);
  console.log(`- Company Settings: ${companyCount} active settings (logo, signature, stamp preserved)`);
  console.log(`- Attendance: ${attendanceCount} records`);

  console.log('\n✅ All dummy and test data successfully cleaned!');
  process.exit(0);
}

cleanDummyData().catch(err => {
  console.error('Fatal error during cleanup:', err);
  process.exit(1);
});
