/**
 * Wipes every business/transactional collection and reduces Users/Employees
 * down to exactly one admin account, for a clean-slate go-live.
 *
 * Backs up every collection (including the ones being kept) to JSON files
 * before deleting anything -- this is destructive and there is no undo
 * beyond that backup.
 *
 * Intentionally NOT wiped: CompanySettings, Role -- these are app
 * configuration (branding, permission setup), not business/dummy data.
 *
 * Usage: node scripts/resetToSingleAdmin.js <backup-dir>
 */
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import connectDB from '../src/config/db.js';

import User from '../src/models/User.js';
import Employee from '../src/models/Employee.js';
import RefreshToken from '../src/models/RefreshToken.js';
import CompanySettings from '../src/models/CompanySettings.js';
import Role from '../src/models/Role.js';

import Attendance from '../src/models/Attendance.js';
import AuditLog from '../src/models/AuditLog.js';
import BankTransaction from '../src/models/BankTransaction.js';
import Customer from '../src/models/Customer.js';
import DeliveryNote from '../src/models/DeliveryNote.js';
import Email from '../src/models/Email.js';
import ExpenseClaim from '../src/models/ExpenseClaim.js';
import FollowUp from '../src/models/FollowUp.js';
import Lead from '../src/models/Lead.js';
import Notification from '../src/models/Notification.js';
import Product from '../src/models/Product.js';
import ProformaInvoice from '../src/models/ProformaInvoice.js';
import Project from '../src/models/Project.js';
import PurchaseOrder from '../src/models/PurchaseOrder.js';
import Quotation from '../src/models/Quotation.js';
import SalesDocument from '../src/models/SalesDocument.js';
import SalesInvoice from '../src/models/SalesInvoice.js';
import SalesOrder from '../src/models/SalesOrder.js';
import SerialNumber from '../src/models/SerialNumber.js';
import ServiceRequest from '../src/models/ServiceRequest.js';
import Supplier from '../src/models/Supplier.js';
import Warranty from '../src/models/Warranty.js';
import WhatsAppMessage from '../src/models/whatsappMessageModel.js';

const ADMIN_EMAIL = 'admin@gmail.com';
const BACKUP_DIR = process.argv[2];

const WIPE_MODELS = {
  Attendance, AuditLog, BankTransaction, Customer, DeliveryNote, Email,
  ExpenseClaim, FollowUp, Lead, Notification, Product, ProformaInvoice,
  Project, PurchaseOrder, Quotation, SalesDocument, SalesInvoice, SalesOrder,
  SerialNumber, ServiceRequest, Supplier, Warranty, WhatsAppMessage,
};

// Backed up regardless, even though User/Employee/RefreshToken/CompanySettings/Role aren't fully wiped.
const BACKUP_ONLY_MODELS = { User, Employee, RefreshToken, CompanySettings, Role };

async function run() {
  if (!BACKUP_DIR) {
    console.error('Usage: node scripts/resetToSingleAdmin.js <backup-dir>');
    process.exit(1);
  }

  await connectDB();
  console.log('Connected to MongoDB.\n');

  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  console.log('=== 1. Backing up every collection ===');
  for (const [name, Model] of Object.entries({ ...BACKUP_ONLY_MODELS, ...WIPE_MODELS })) {
    const docs = await Model.find().lean();
    fs.writeFileSync(path.join(BACKUP_DIR, `${name}.json`), JSON.stringify(docs, null, 2));
    console.log(`  backed up ${name}: ${docs.length} doc(s)`);
  }

  console.log('\n=== 2. Locating the admin to keep ===');
  const adminUser = await User.findOne({ email: ADMIN_EMAIL });
  if (!adminUser) {
    console.error(`No User found with email ${ADMIN_EMAIL} -- aborting. Nothing has been deleted.`);
    process.exit(1);
  }
  const adminEmployee = await Employee.findOne({ email: ADMIN_EMAIL });
  console.log(`  keeping User ${adminUser.email} (${adminUser._id})`);
  console.log(`  keeping Employee ${adminEmployee ? `${adminEmployee.email} (${adminEmployee._id})` : '(none found -- only the User will remain)'}`);

  console.log('\n=== 3. Wiping business/transactional collections ===');
  for (const [name, Model] of Object.entries(WIPE_MODELS)) {
    const res = await Model.deleteMany({});
    console.log(`  ${name}: ${res.deletedCount} deleted`);
  }

  console.log('\n=== 4. Reducing Users/Employees to the one admin ===');
  const userRes = await User.deleteMany({ _id: { $ne: adminUser._id } });
  console.log(`  Users: ${userRes.deletedCount} deleted, 1 kept`);
  const empFilter = adminEmployee ? { _id: { $ne: adminEmployee._id } } : {};
  const empRes = await Employee.deleteMany(empFilter);
  console.log(`  Employees: ${empRes.deletedCount} deleted, ${adminEmployee ? 1 : 0} kept`);

  console.log('\n=== 5. Clearing sessions (everyone logs in fresh, including the admin) ===');
  const rtRes = await RefreshToken.deleteMany({});
  console.log(`  RefreshTokens: ${rtRes.deletedCount} deleted`);

  if (adminEmployee) {
    adminEmployee.presentDays = 0;
    adminEmployee.leaveDays = 0;
    adminEmployee.overtimeHours = 0;
    await adminEmployee.save();
    if (!adminUser.employeeId) {
      adminUser.employeeId = adminEmployee._id;
      await adminUser.save();
    }
  }

  console.log('\nDone. CompanySettings and Role documents were left untouched (configuration, not business data).');
  process.exit(0);
}

run().catch((err) => {
  console.error('Fatal error -- some steps may be incomplete:', err);
  process.exit(1);
});
