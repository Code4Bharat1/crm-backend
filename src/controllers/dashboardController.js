import Lead from '../models/Lead.js';
import Quotation from '../models/Quotation.js';
import SalesOrder from '../models/SalesOrder.js';
import SalesInvoice from '../models/SalesInvoice.js';
import ProformaInvoice from '../models/ProformaInvoice.js';
import DeliveryNote from '../models/DeliveryNote.js';
import Project from '../models/Project.js';
import ServiceRequest from '../models/ServiceRequest.js';
import Product from '../models/Product.js';
import Employee from '../models/Employee.js';
import AuditLog from '../models/AuditLog.js';
import Customer from '../models/Customer.js';
import FollowUp from '../models/FollowUp.js';
import { generateFollowUps } from '../utils/followUpEngine.js';
import { getPeriodRange, monthsBetween } from '../utils/periodRange.js';

const OPEN_QUOTATION_STATUSES = ['Draft', 'Sent', 'Viewed'];
const PENDING_DELIVERY_STATUSES = ['Confirmed', 'In Progress', 'Partially Delivered'];
const CLOSED_SERVICE_STATUSES = ['Resolved', 'Closed', 'Completed'];
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * GET /api/dashboard/kpis
 * Returns KPI numbers aggregated from real MongoDB collections.
 */
export const getDashboardKpis = async (req, res) => {
  try {
    const since90d = new Date(Date.now() - NINETY_DAYS_MS);
    const startOfToday = new Date(new Date().setHours(0, 0, 0, 0));
    await generateFollowUps();

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
      totalProducts,
      pendingFollowUps,
      overdueFollowUps
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
            openService: { $sum: { $cond: [{ $in: ['$status', CLOSED_SERVICE_STATUSES] }, 0, 1] } },
            serviceRevenue: { $sum: '$serviceCharges' },
          },
        },
      ]),

      Product.countDocuments({ $expr: { $lt: ['$stock', '$minStock'] } }),
      Product.countDocuments(),
      FollowUp.countDocuments({ status: 'Pending' }),
      FollowUp.countDocuments({ status: 'Pending', dueDate: { $lt: startOfToday } }),
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
      totalProducts,
      pendingFollowUps,
      overdueFollowUps
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error computing dashboard KPIs', error: error.message });
  }
};

/**
 * GET /api/dashboard/overview
 * Returns the complete dashboard payload populated 100% with real database records:
 * KPIs, Monthly sales charts, Leads by Source & Area, Sales by Person, Overdue invoices,
 * Pending follow-ups, Open service tickets, Best margin project, Order-to-Cash chain, and Recent activity.
 */
// Resolves the "period" query param into a concrete date range.
// null return means "no restriction" (matches the old, always-global behavior).
const resolvePeriodRange = (period, now) => {
  if (period === 'This month') {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
  }
  if (period === 'This quarter') {
    const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
    return { start: new Date(now.getFullYear(), qStartMonth, 1), end: now };
  }
  if (typeof period === 'string' && period.startsWith('FY')) {
    // Indian fiscal year: Apr 1 - Mar 31.
    const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return { start: new Date(fyStartYear, 3, 1), end: now };
  }
  return null;
};

export const getDashboardOverview = async (req, res) => {
  try {
    const since90d = new Date(Date.now() - NINETY_DAYS_MS);
    const startOfToday = new Date(new Date().setHours(0, 0, 0, 0));
    const periodRange = getPeriodRange(req.query.period);
    await generateFollowUps();

    const periodRange = resolvePeriodRange(req.query.period, now);
    const salesperson = req.query.salesperson && req.query.salesperson !== 'All' ? req.query.salesperson : null;
    const area = req.query.area && req.query.area !== 'All' ? req.query.area : null;

    // Reusable $match fragments. Each is only applied to models that actually
    // carry the relevant field — invoices/projects/service/products have no
    // salesperson or area dimension, so those two filters legitimately don't
    // affect them (that's a real data limitation, not a bug).
    const dateMatch = (field) => (periodRange ? { [field]: { $gte: periodRange.start, $lte: periodRange.end } } : {});
    const spMatch = (field = 'salesperson') => (salesperson ? { [field]: salesperson } : {});
    const areaMatch = area ? { area } : {};

    // 1. KPI aggregations
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
      totalProducts,
      pendingFollowUps,
      overdueFollowUps,
      proformaCount,
      deliveryCount,
      invoiceCount
    ] = await Promise.all([
      Lead.countDocuments({ ...dateMatch('createdAt'), ...spMatch(), ...areaMatch }),
      Lead.countDocuments({ stage: 'New', ...dateMatch('createdAt'), ...spMatch(), ...areaMatch }),
      Lead.countDocuments({ stage: 'Hot', ...dateMatch('createdAt'), ...spMatch(), ...areaMatch }),
      Lead.countDocuments({ stage: 'Potential', ...dateMatch('createdAt'), ...spMatch(), ...areaMatch }),
      Lead.countDocuments({ stage: 'Lost', ...dateMatch('createdAt'), ...spMatch(), ...areaMatch }),
      Lead.countDocuments({ stage: 'Won', ...dateMatch('createdAt'), ...spMatch(), ...areaMatch }),

      Quotation.aggregate([
        { $match: { status: { $in: OPEN_QUOTATION_STATUSES }, ...dateMatch('date'), ...spMatch() } },
        { $group: { _id: null, count: { $sum: 1 }, value: { $sum: '$grandTotal' } } },
      ]),

      SalesOrder.aggregate([
        { $match: { ...dateMatch('date'), ...spMatch() } },
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
        { $match: { ...dateMatch('date') } },
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
        { $match: { 'payments.date': periodRange ? { $gte: periodRange.start, $lte: periodRange.end } : { $gte: since90d } } },
        { $group: { _id: null, total: { $sum: '$payments.amount' } } },
      ]),

      Project.aggregate([
        { $match: { ...dateMatch('start') } },
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
        { $match: { ...dateMatch('createdAt') } },
        {
          $group: {
            _id: null,
            openService: { $sum: { $cond: [{ $in: ['$status', CLOSED_SERVICE_STATUSES] }, 0, 1] } },
            serviceRevenue: { $sum: '$serviceCharges' },
          },
        },
      ]),

      Product.countDocuments({ $expr: { $lt: ['$stock', '$minStock'] } }),
      Product.countDocuments(),
      FollowUp.countDocuments({ status: 'Pending', ...dateMatch('dueDate'), ...spMatch('owner') }),
      FollowUp.countDocuments({ status: 'Pending', dueDate: { $lt: startOfToday }, ...spMatch('owner') }),
      ProformaInvoice.countDocuments(),
      DeliveryNote.countDocuments(),
      SalesInvoice.countDocuments()
    ]);

    const q = quotationAgg[0] || { count: 0, value: 0 };
    const o = orderAgg[0] || { confirmedOrders: 0, orderValue: 0, pendingDeliveries: 0 };
    const inv = invoiceAgg[0] || { outstanding: 0, overdue: 0 };
    const pay = paymentAgg[0] || { total: 0 };
    const proj = projectAgg[0] || { activeProjects: 0, projectRevenue: 0, projectProfit: 0 };
    const svc = serviceAgg[0] || { openService: 0, serviceRevenue: 0 };

    const kpis = {
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
      totalProducts,
      pendingFollowUps,
      overdueFollowUps
    };

    // 2. Real Monthly Trends (Quotations, Sales Orders, Collections) — the
    // requested period's own months when one was recognized, otherwise the
    // trailing 6 months anchored to now (unchanged default behavior).
    const now = new Date();
    const monthEntries = periodRange
      ? monthsBetween(periodRange.start, periodRange.end)
      : Array.from({ length: 6 }, (_, idx) => {
          const d = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1);
          return { year: d.getFullYear(), month: d.getMonth() };
        });
    const monthlySales = [];
    for (const { year: mYear, month: mMonth } of monthEntries) {
      const d = new Date(mYear, mMonth, 1);
      const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const monthLabel = d.toLocaleString('en-IN', { month: 'short' });

      // Run aggregations for this month
      const [qMonth, oMonth, payMonth] = await Promise.all([
        Quotation.aggregate([
          {
            $match: {
              ...spMatch(),
              $or: [
                { date: { $gte: startOfMonth, $lte: endOfMonth } },
                { createdAt: { $gte: startOfMonth, $lte: endOfMonth } }
              ]
            }
          },
          { $group: { _id: null, total: { $sum: '$grandTotal' } } }
        ]),
        SalesOrder.aggregate([
          {
            $match: {
              status: { $ne: 'Cancelled' },
              ...spMatch(),
              $or: [
                { date: { $gte: startOfMonth, $lte: endOfMonth } },
                { createdAt: { $gte: startOfMonth, $lte: endOfMonth } }
              ]
            }
          },
          { $group: { _id: null, total: { $sum: '$grandTotal' } } }
        ]),
        SalesInvoice.aggregate([
          { $unwind: '$payments' },
          { $match: { 'payments.date': { $gte: startOfMonth, $lte: endOfMonth } } },
          { $group: { _id: null, total: { $sum: '$payments.amount' } } }
        ])
      ]);

      monthlySales.push({
        month: monthLabel,
        quotations: qMonth[0]?.total || 0,
        sales: oMonth[0]?.total || 0,
        collections: payMonth[0]?.total || 0
      });
    }

    // 3. Leads by Source (real data)
    const rawSources = await Lead.aggregate([
      { $match: { ...dateMatch('createdAt'), ...spMatch(), ...areaMatch } },
      { $group: { _id: { $ifNull: ['$source', 'Direct'] }, value: { $sum: 1 } } },
      { $sort: { value: -1 } }
    ]);
    const leadsBySource = rawSources.map(s => ({ name: s._id, value: s.value }));

    // 4. Leads by Area (real data) -- deliberately NOT filtered by `area` itself:
    // this chart's whole purpose is to show the area breakdown, so narrowing it to
    // one area would collapse it to a single bar instead of a comparison.
    const rawAreas = await Lead.aggregate([
      { $match: { ...dateMatch('createdAt'), ...spMatch() } },
      { $group: { _id: { $ifNull: ['$area', 'General'] }, leads: { $sum: 1 } } },
      { $sort: { leads: -1 } },
      { $limit: 6 }
    ]);
    const leadsByArea = rawAreas.map(a => ({ name: a._id, leads: a.leads }));

    // 5. Salesperson Performance (real data) -- not filtered by `salesperson` itself,
    // same reasoning as Leads by Area above (it's the per-person comparison).
    const salesEmployees = await Employee.find({
      $or: [
        { role: { $regex: /sales/i } },
        { department: { $regex: /sales/i } }
      ]
    }).select('fullName role');

    const rawSales = await SalesOrder.aggregate([
      { $match: { status: { $ne: 'Cancelled' }, ...dateMatch('date') } },
      { $group: { _id: '$salesperson', achieved: { $sum: '$grandTotal' } } }
    ]);
    const salesMap = new Map();
    rawSales.forEach(s => salesMap.set(s._id, s.achieved));

    const salesByPerson = salesEmployees.map(emp => {
      const achievedAmount = salesMap.get(emp.fullName) || 0;
      return {
        name: emp.fullName,
        target: 15, // target in Lakhs
        achieved: Math.round((achievedAmount / 100000) * 10) / 10
      };
    });

    // 6. Product-wise Quotations vs Orders (real data)
    const quotedItems = await Quotation.aggregate([
      { $match: { ...dateMatch('date'), ...spMatch() } },
      { $unwind: '$items' },
      { $group: { _id: '$items.description', quoted: { $sum: { $ifNull: ['$items.qty', '$items.quantity'] } } } },
      { $sort: { quoted: -1 } },
      { $limit: 6 }
    ]);

    const orderedItems = await SalesOrder.aggregate([
      { $match: { ...dateMatch('date'), ...spMatch() } },
      { $unwind: '$items' },
      { $group: { _id: '$items.description', sold: { $sum: { $ifNull: ['$items.qty', '$items.quantity'] } } } }
    ]);
    const orderedMap = new Map();
    orderedItems.forEach(item => orderedMap.set(item._id, item.sold));

    const productSales = quotedItems.map(item => ({
      name: item._id?.length > 18 ? item._id.slice(0, 16) + '…' : item._id,
      quoted: item.quoted,
      sold: orderedMap.get(item._id) || 0
    }));

    // 7. Order-To-Cash Chain (real counts)
    const orderToCash = {
      leads: totalLeads,
      quotations: q.count,
      proformas: proformaCount,
      orders: o.confirmedOrders,
      deliveries: deliveryCount,
      invoices: invoiceCount,
      payments: pay.total
    };

    // 8. Overdue Invoices list (real data) -- no salesperson/area dimension on invoices,
    // so only the Period filter (on invoice date) applies here.
    const rawOverdue = await SalesInvoice.find({
      balanceAmount: { $gt: 0 },
      ...dateMatch('date'),
      $or: [
        { status: 'Overdue' },
        { dueDate: { $lt: now } }
      ]
    }).sort({ dueDate: 1 }).limit(5).lean();

    const overdueInvoices = rawOverdue.map(i => ({
      id: i.invoiceNo || i.id || `INV-${String(i._id).slice(-4)}`,
      customerName: i.customer?.name || i.customerName || 'Client',
      dueDate: i.dueDate,
      total: i.grandTotal || 0,
      received: i.receivedAmount || 0,
      balance: i.balanceAmount || 0,
      status: i.status || 'Overdue'
    }));

    // 9. Due Follow-ups list -- real rows from the Follow-up Engine (generateFollowUps already ran above)
    const rawFollowUps = await FollowUp.find({ status: 'Pending', ...dateMatch('dueDate'), ...spMatch('owner') }).sort({ dueDate: 1 }).limit(6).lean();

    const dueFollowUps = rawFollowUps.map(f => ({
      id: String(f._id),
      customerName: f.customerName,
      type: f.type,
      owner: f.owner,
      dueDate: f.dueDate,
      status: f.dueDate < startOfToday ? 'Overdue' : 'Pending'
    }));

    // 10. Open Service Requests (real data) -- no salesperson/area dimension on service
    // requests, so only the Period filter applies here.
    const rawService = await ServiceRequest.find({
      status: { $nin: CLOSED_SERVICE_STATUSES },
      ...dateMatch('createdAt'),
    }).sort({ createdAt: -1 }).limit(5).lean();

    const serviceRequests = rawService.map(s => ({
      id: s.requestId || s.id || `SR-${String(s._id).slice(-4)}`,
      customerName: s.customer?.name || 'Customer',
      productName: s.productName || s.equipmentName || 'Equipment',
      underWarranty: Boolean(s.underWarranty),
      engineer: s.engineer?.name || s.assignedEngineer || 'Unassigned',
      status: s.status || 'New'
    }));

    // 11. Top Project by margin (real data) -- no salesperson/area dimension on
    // projects, so only the Period filter (project start date) applies here.
    const rawProjects = await Project.find({ ...dateMatch('start') }).lean();
    let topProject = null;
    if (rawProjects.length > 0) {
      rawProjects.forEach(p => {
        const costTotal = (p.costs || []).reduce((acc, c) => acc + (c.amount || 0), 0);
        p.profit = (p.revenue || 0) - costTotal;
        p.margin = p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0;
      });
      rawProjects.sort((a, b) => b.profit - a.profit);
      const best = rawProjects[0];
      topProject = {
        name: best.name,
        customerName: best.customer?.name || 'Enterprise Client',
        margin: best.margin,
        revenue: best.revenue || 0
      };
    }

    // 12. Recent System & Customer Activity (real data from AuditLog) —
    // scoped to the requested period when one was recognized, otherwise the
    // latest 6 entries overall (unchanged default behavior).
    const rawLogs = periodRange
      ? await AuditLog.find({ createdAt: { $gte: periodRange.start, $lte: periodRange.end } }).sort({ createdAt: -1 }).limit(20).lean()
      : await AuditLog.find().sort({ createdAt: -1 }).limit(6).lean();
    const recentActivity = rawLogs.map(l => ({
      id: l._id.toString(),
      kind: l.module === 'AUTHENTICATION' ? 'Auth' : l.module === 'EMPLOYEE' ? 'Staff' : l.module === 'ATTENDANCE' ? 'Attendance' : 'Event',
      title: `${l.action} ${l.resourceType || ''} ${l.resourceId || ''}`.trim(),
      detail: l.description,
      by: l.userName || 'System',
      at: l.createdAt,
      severity: l.severity === 'CRITICAL' ? 'danger' : l.severity === 'WARNING' ? 'warning' : 'info'
    }));

    res.json({
      success: true,
      data: {
        kpis,
        monthlySales,
        leadsBySource,
        leadsByArea,
        salesByPerson,
        productSales,
        orderToCash,
        overdueInvoices,
        dueFollowUps,
        serviceRequests,
        topProject,
        recentActivity
      }
    });
  } catch (error) {
    console.error('Error in getDashboardOverview:', error);
    res.status(500).json({ success: false, message: 'Server error loading dashboard overview', error: error.message });
  }
};
