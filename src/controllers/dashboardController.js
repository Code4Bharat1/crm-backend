import Lead from '../models/Lead.js';
import Quotation from '../models/Quotation.js';
import SalesOrder from '../models/SalesOrder.js';
import SalesInvoice from '../models/SalesInvoice.js';
import Project from '../models/Project.js';
import ServiceRequest from '../models/ServiceRequest.js';
import Product from '../models/Product.js';

const OPEN_QUOTATION_STATUSES = ['Draft', 'Sent', 'Viewed'];
const PENDING_DELIVERY_STATUSES = ['Confirmed', 'In Progress', 'Partially Delivered'];
const OPEN_SERVICE_STATUSES = ['Completed', 'Closed'];
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * GET /api/dashboard/kpis
 * Aggregates the executive-dashboard KPI cards straight from MongoDB —
 * one round trip per collection, run in parallel.
 */
export const getDashboardKpis = async (req, res) => {
  try {
    const since90d = new Date(Date.now() - NINETY_DAYS_MS);

    const [
      totalLeads,
      newLeads,
      hotLeads,
      potentialLeads,
      lostLeads,
      wonLeads,
      quotationAgg,
      orderAgg,
      invoiceAgg,
      paymentAgg,
      projectAgg,
      serviceAgg,
      stockAlerts,
    ] = await Promise.all([
      Lead.countDocuments(),
      Lead.countDocuments({ stage: 'New' }),
      Lead.countDocuments({ stage: 'Hot' }),
      Lead.countDocuments({ stage: 'Potential' }),
      Lead.countDocuments({ stage: 'Lost' }),
      Lead.countDocuments({ stage: 'Won' }),

      Quotation.aggregate([
        { $match: { status: { $in: OPEN_QUOTATION_STATUSES } } },
        { $group: { _id: null, count: { $sum: 1 }, value: { $sum: '$grandTotal' } } },
      ]),

      SalesOrder.aggregate([
        {
          $group: {
            _id: null,
            confirmedOrders: { $sum: { $cond: [{ $ne: ['$status', 'Cancelled'] }, 1, 0] } },
            orderValue: { $sum: { $cond: [{ $ne: ['$status', 'Cancelled'] }, '$grandTotal', 0] } },
            pendingDeliveries: { $sum: { $cond: [{ $in: ['$status', PENDING_DELIVERY_STATUSES] }, 1, 0] } },
          },
        },
      ]),

      SalesInvoice.aggregate([
        {
          $group: {
            _id: null,
            outstanding: { $sum: '$balanceAmount' },
            overdue: { $sum: { $cond: [{ $eq: ['$status', 'Overdue'] }, '$balanceAmount', 0] } },
          },
        },
      ]),

      SalesInvoice.aggregate([
        { $unwind: '$payments' },
        { $match: { 'payments.date': { $gte: since90d } } },
        { $group: { _id: null, total: { $sum: '$payments.amount' } } },
      ]),

      Project.aggregate([
        {
          $addFields: { costTotal: { $sum: '$costs.amount' } },
        },
        {
          $group: {
            _id: null,
            activeProjects: { $sum: { $cond: [{ $ne: ['$status', 'Completed'] }, 1, 0] } },
            projectRevenue: { $sum: '$revenue' },
            projectProfit: { $sum: { $subtract: ['$revenue', '$costTotal'] } },
          },
        },
      ]),

      ServiceRequest.aggregate([
        {
          $group: {
            _id: null,
            openService: { $sum: { $cond: [{ $in: ['$status', OPEN_SERVICE_STATUSES] }, 0, 1] } },
            serviceRevenue: { $sum: '$serviceCharges' },
          },
        },
      ]),

      Product.countDocuments({ $expr: { $lt: ['$stock', '$minStock'] } }),
    ]);

    const q = quotationAgg[0] || { count: 0, value: 0 };
    const o = orderAgg[0] || { confirmedOrders: 0, orderValue: 0, pendingDeliveries: 0 };
    const inv = invoiceAgg[0] || { outstanding: 0, overdue: 0 };
    const pay = paymentAgg[0] || { total: 0 };
    const proj = projectAgg[0] || { activeProjects: 0, projectRevenue: 0, projectProfit: 0 };
    const svc = serviceAgg[0] || { openService: 0, serviceRevenue: 0 };

    res.json({
      totalLeads,
      newLeads,
      hotLeads,
      potentialLeads,
      lostLeads,
      wonLeads,
      openQuotations: q.count,
      openQuotationValue: q.value,
      confirmedOrders: o.confirmedOrders,
      orderValue: o.orderValue,
      pendingDeliveries: o.pendingDeliveries,
      outstanding: inv.outstanding,
      overdue: inv.overdue,
      paymentsReceived: pay.total,
      activeProjects: proj.activeProjects,
      projectProfit: proj.projectProfit,
      projectRevenue: proj.projectRevenue,
      openService: svc.openService,
      serviceRevenue: svc.serviceRevenue,
      stockAlerts,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error computing dashboard KPIs', error: error.message });
  }
};
