import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import Quotation from '../src/models/Quotation.js';

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const quotations = await Quotation.aggregate([
    {
      $group: {
        _id: { $trim: { input: { $ifNull: ['$salesperson', 'Unassigned'] } } },
        quotationCount: { $sum: 1 },
        totalQuoted: { $sum: '$grandTotal' },
        confirmedCount: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $in: [{ $toLower: '$status' }, ['accepted', 'confirmed']] },
                  { $gt: [{ $strLenCP: { $ifNull: ['$convertedToSalesOrder', ''] } }, 0] },
                  { $gt: [{ $strLenCP: { $ifNull: ['$convertedToProforma', ''] } }, 0] }
                ]
              },
              1,
              0
            ]
          }
        },
        confirmedAmount: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $in: [{ $toLower: '$status' }, ['accepted', 'confirmed']] },
                  { $gt: [{ $strLenCP: { $ifNull: ['$convertedToSalesOrder', ''] } }, 0] },
                  { $gt: [{ $strLenCP: { $ifNull: ['$convertedToProforma', ''] } }, 0] }
                ]
              },
              '$grandTotal',
              0
            ]
          }
        }
      }
    }
  ]);

  console.log('Quotation aggregation result with robust converted check:');
  console.log(JSON.stringify(quotations, null, 2));

  process.exit(0);
}

check().catch(console.error);
