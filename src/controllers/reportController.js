import Quotation from '../models/Quotation.js';
import SalesOrder from '../models/SalesOrder.js';
import SalesInvoice from '../models/SalesInvoice.js';

// GET /api/reports/product-sales -- quoted vs ordered vs invoiced quantity
// and value per product/line-item description, across all three document
// types. Nothing else in the app currently rolls this up.
export const getProductSalesReport = async (req, res) => {
  try {
    const pipeline = (Model) => Model.aggregate([
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.description',
          qty: { $sum: { $ifNull: ['$items.qty', '$items.quantity', 0] } },
          value: { $sum: { $ifNull: ['$items.totalAmount', 0] } },
        },
      },
    ]);

    const [quoted, ordered, invoiced] = await Promise.all([
      pipeline(Quotation),
      pipeline(SalesOrder),
      pipeline(SalesInvoice),
    ]);

    const byProduct = new Map();
    const merge = (rows, prefix) => {
      rows.forEach((r) => {
        const name = r._id || 'Unspecified';
        if (!byProduct.has(name)) {
          byProduct.set(name, { name, quotedQty: 0, quotedValue: 0, orderedQty: 0, orderedValue: 0, invoicedQty: 0, invoicedValue: 0 });
        }
        const row = byProduct.get(name);
        row[`${prefix}Qty`] = r.qty;
        row[`${prefix}Value`] = r.value;
      });
    };
    merge(quoted, 'quoted');
    merge(ordered, 'ordered');
    merge(invoiced, 'invoiced');

    const rows = Array.from(byProduct.values())
      .map((r) => ({
        ...r,
        conversionRate: r.quotedQty > 0 ? Math.round((r.orderedQty / r.quotedQty) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.quotedValue - a.quotedValue);

    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Error building product sales report', error: error.message });
  }
};

// GET /api/reports/quotation-conversion -- per-quotation funnel status plus
// summary conversion stats, grouped by salesperson.
export const getQuotationConversionReport = async (req, res) => {
  try {
    const quotations = await Quotation.find()
      .select('quotationNo date customer salesperson status grandTotal convertedToSalesOrder convertedToProforma')
      .sort({ date: -1 });

    const rows = quotations.map((q) => ({
      quotationNo: q.quotationNo,
      date: q.date,
      customerName: q.customer?.name || 'Customer',
      salesperson: q.salesperson || 'Unassigned',
      status: q.status,
      grandTotal: q.grandTotal,
      converted: !!q.convertedToSalesOrder,
      convertedToSalesOrder: q.convertedToSalesOrder || '',
    }));

    const bySalesperson = new Map();
    rows.forEach((r) => {
      const key = r.salesperson;
      if (!bySalesperson.has(key)) {
        bySalesperson.set(key, { salesperson: key, quotations: 0, converted: 0, quotedValue: 0, convertedValue: 0 });
      }
      const s = bySalesperson.get(key);
      s.quotations += 1;
      s.quotedValue += r.grandTotal || 0;
      if (r.converted) {
        s.converted += 1;
        s.convertedValue += r.grandTotal || 0;
      }
    });
    const summary = Array.from(bySalesperson.values())
      .map((s) => ({ ...s, conversionRate: s.quotations > 0 ? Math.round((s.converted / s.quotations) * 1000) / 10 : 0 }))
      .sort((a, b) => b.quotedValue - a.quotedValue);

    res.json({ rows, summary });
  } catch (error) {
    res.status(500).json({ message: 'Error building quotation conversion report', error: error.message });
  }
};
