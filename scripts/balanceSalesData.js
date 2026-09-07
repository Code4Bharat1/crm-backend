import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import connectDB from '../src/config/db.js';
import Lead from '../src/models/Lead.js';
import Quotation from '../src/models/Quotation.js';
import SalesOrder from '../src/models/SalesOrder.js';
import Customer from '../src/models/Customer.js';

async function run() {
  await connectDB();
  console.log('Distributing realistic sales data between both salespeople...');

  await Lead.updateMany(
    { id: { $in: ['LD-1002', 'LD-1005', 'LD-1006'] } },
    { $set: { salesperson: 'raj fsdafdsfd' } }
  );

  await Quotation.updateOne(
    { quotationNo: 'QT-2026-002' },
    { $set: { salesperson: 'raj fsdafdsfd' } }
  );

  await SalesOrder.updateOne(
    { soNo: 'SO-2026-002' },
    { $set: { salesperson: 'raj fsdafdsfd' } }
  );

  await Customer.updateMany(
    { id: { $in: ['CUST-002', 'CUST-005'] } },
    { $set: { salesPerson: 'raj fsdafdsfd' } }
  );

  console.log('✅ Sales balance successfully updated!');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
