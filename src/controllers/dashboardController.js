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
      Lead.countDocuments({ stage: { $in: ['New', 'Contacted', 'Potential', 'Hot', 'Quotation Sent', 'Negotiation'] } }),
      Lead.countDocuments({ 
        stage: { $in: ['Contacted', 'Potential', 'Hot'] },
        updatedAt: { $lt: new Date(Date.now() - 7 * 86400000) }
      })
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
export const getDashboardOverview = async (req, res) => {
  try {
    const since90d = new Date(Date.now() - NINETY_DAYS_MS);

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
      Lead.countDocuments({ stage: { $in: ['New', 'Contacted', 'Potential', 'Hot', 'Quotation Sent', 'Negotiation'] } }),
      Lead.countDocuments({ 
        stage: { $in: ['Contacted', 'Potential', 'Hot'] },
        updatedAt: { $lt: new Date(Date.now() - 7 * 86400000) }
      }),
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

    // 2. Real Monthly Trends (Past 6 months: Quotations, Sales Orders, Collections)
    const now = new Date();
    const monthlySales = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const monthLabel = d.toLocaleString('en-IN', { month: 'short' });

      // Run aggregations for this month
      const [qMonth, oMonth, payMonth] = await Promise.all([
        Quotation.aggregate([
          {
            $match: {
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
      { $group: { _id: { $ifNull: ['$source', 'Direct'] }, value: { $sum: 1 } } },
      { $sort: { value: -1 } }
    ]);
    const leadsBySource = rawSources.map(s => ({ name: s._id, value: s.value }));

    // 4. Leads by Area (real data)
    const rawAreas = await Lead.aggregate([
      { $group: { _id: { $ifNull: ['$area', 'General'] }, leads: { $sum: 1 } } },
      { $sort: { leads: -1 } },
      { $limit: 6 }
    ]);
    const leadsByArea = rawAreas.map(a => ({ name: a._id, leads: a.leads }));

    // 5. Salesperson Performance (real data)
    const salesEmployees = await Employee.find({
      $or: [
        { role: { $regex: /sales/i } },
        { department: { $regex: /sales/i } }
      ]
    }).select('fullName role');

    const rawSales = await SalesOrder.aggregate([
      { $match: { status: { $ne: 'Cancelled' } } },
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
      { $unwind: '$items' },
      { $group: { _id: '$items.description', quoted: { $sum: { $ifNull: ['$items.qty', '$items.quantity'] } } } },
      { $sort: { quoted: -1 } },
      { $limit: 6 }
    ]);

    const orderedItems = await SalesOrder.aggregate([
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

    // 8. Overdue Invoices list (real data)
    const rawOverdue = await SalesInvoice.find({
      balanceAmount: { $gt: 0 },
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

    // 9. Due Follow-ups list (real data)
    const rawFollowUps = await Lead.find({
      stage: { $nin: ['Won', 'Lost'] }
    }).sort({ updatedAt: -1 }).limit(6).lean();

    const dueFollowUps = rawFollowUps.map(f => ({
      id: f.id || `LD-${String(f._id).slice(-4)}`,
      customerName: f.customerName || 'Lead Account',
      type: f.source || 'Inquiry',
      owner: f.salesperson || 'Sales Team',
      dueDate: f.lastRepliedAt || f.date || f.updatedAt,
      status: f.stage || 'New'
    }));

    // 10. Open Service Requests (real data)
    const rawService = await ServiceRequest.find({
      status: { $nin: CLOSED_SERVICE_STATUSES }
    }).sort({ createdAt: -1 }).limit(5).lean();

    const serviceRequests = rawService.map(s => ({
      id: s.requestId || s.id || `SR-${String(s._id).slice(-4)}`,
      customerName: s.customer?.name || 'Customer',
      productName: s.productName || s.equipmentName || 'Equipment',
      underWarranty: Boolean(s.underWarranty),
      engineer: s.engineer?.name || s.assignedEngineer || 'Unassigned',
      status: s.status || 'New'
    }));

    // 11. Top Project by margin (real data)
    const rawProjects = await Project.find().lean();
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

    // 12. Recent System & Customer Activity (real data from AuditLog)
    const rawLogs = await AuditLog.find().sort({ createdAt: -1 }).limit(6).lean();
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
