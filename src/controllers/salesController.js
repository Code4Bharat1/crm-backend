import Lead from '../models/Lead.js';
import SalesDocument from '../models/SalesDocument.js';
import Employee from '../models/Employee.js';
import SalesOrder from '../models/SalesOrder.js';
import Quotation from '../models/Quotation.js';
import Customer from '../models/Customer.js';
import { convertLeadToCustomer, WON_STAGE } from '../utils/leadConversion.js';

// --- LEADS ---

export const getLeads = async (req, res) => {
  try {
    const leads = await Lead.find().sort({ createdAt: -1 });
    res.json(leads);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching leads' });
  }
};

export const createLead = async (req, res) => {
  try {
    const { customerName, source, sourceEmailId } = req.body;

    // 1. Exact dedup: same email UID already created a lead
    if (sourceEmailId) {
      const byEmail = await Lead.findOne({ sourceEmailId });
      if (byEmail) {
        return res.status(409).json({
          message: 'A lead from this email already exists.',
          duplicate: true,
          lead: byEmail
        });
      }
    }

    // 2. Fuzzy dedup: same customerName + source within the last 24 hours
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await Lead.findOne({
      customerName: { $regex: new RegExp(`^${customerName?.trim()}$`, 'i') },
      source,
      createdAt: { $gte: since }
    });
    if (recent) {
      return res.status(409).json({
        message: `A lead for "${customerName}" was already created in the last 24 hours.`,
        duplicate: true,
        lead: recent
      });
    }

    const newLead = new Lead(req.body);
    const savedLead = await newLead.save();

    // A lead can be filed straight at "Won" (e.g. repeat order logged after the fact).
    if (savedLead.stage === WON_STAGE) {
      const conversion = await convertLeadToCustomer(savedLead).catch(err => {
        console.error(`[Lead ${savedLead.id}] Auto-conversion failed:`, err.message);
        return null;
      });
      if (conversion) {
        return res.status(201).json({
          ...savedLead.toObject(),
          conversion: { customer: conversion.customer, created: conversion.created },
        });
      }
    }

    res.status(201).json(savedLead);
  } catch (error) {
    res.status(400).json({ message: 'Error creating lead', error: error.message });
  }
};

/**
 * PATCH /api/sales/leads/by-email/:emailId
 * Finds the lead created from a given email and promotes it to "Contacted".
 * If no lead exists for this email yet, creates one at "Contacted" stage.
 */
export const contactLeadByEmailId = async (req, res) => {
  try {
    const { emailId } = req.params;
    const { customerName, contact, subject, notes } = req.body;

    // Try to find an existing lead tied to this email
    let lead = await Lead.findOne({ sourceEmailId: emailId });

    if (lead) {
      // Promote existing lead to Contacted
      lead.stage = 'Contacted';
      lead.notes = (lead.notes || '') + `\n\n[Follow-up sent] Reply sent to ${contact} on ${new Date().toLocaleString()}.`;
      await lead.save();
      return res.json({ updated: true, lead });
    }

    // No existing lead — create a fresh Contacted lead
    const newLead = new Lead({
      id: `LD-${Math.floor(Math.random() * 9000) + 1000}`,
      customerName: customerName || 'Unknown Customer',
      source: 'Email Inquiry',
      stage: 'Contacted',
      priority: 'Medium',
      value: 0,
      salesperson: 'System AI',
      area: 'Online',
      notes: notes || `Follow-up sent to ${contact}.\nOriginal Subject: ${subject}`,
      sourceEmailId: emailId,
    });
    const saved = await newLead.save();
    return res.status(201).json({ updated: false, lead: saved });

  } catch (error) {
    res.status(500).json({ message: 'Error updating lead stage', error: error.message });
  }
};

// Stage progression map for incoming customer emails
const NEXT_STAGE = {
  'New':       'New',        // not yet replied — stay New
  'Contacted': 'Potential',  // we replied, they emailed again → Potential
  'Potential': 'Potential',  // already progressed, keep
};

/**
 * PATCH /api/sales/leads/progress-by-contact
 * Called when a NEW incoming email arrives from a customer.
 * If they already have a lead at "Contacted", advance it to "Potential".
 * Body: { contact: "email@address.com", customerName, subject }
 */
export const progressLeadByContact = async (req, res) => {
  try {
    const { contact, customerName, subject } = req.body;
    if (!contact) return res.status(400).json({ message: 'contact is required' });

    // Find the most recent lead for this sender email that is at "Contacted" stage
    const lead = await Lead.findOne({
      stage: 'Contacted',
      $or: [
        { notes: { $regex: new RegExp(contact.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } },
        { customerName: { $regex: new RegExp(`^${(customerName || '').trim()}$`, 'i') } }
      ]
    }).sort({ updatedAt: -1 });

    if (!lead) {
      // No Contacted lead found — nothing to advance
      return res.json({ progressed: false, message: 'No Contacted lead found for this sender' });
    }

    const nextStage = NEXT_STAGE[lead.stage] || lead.stage;
    if (nextStage === lead.stage) {
      return res.json({ progressed: false, message: `Lead already at ${lead.stage}` });
    }

    const prevStage = lead.stage;
    lead.stage = nextStage;
    lead.notes = (lead.notes || '') +
      `\n\n[Stage Progressed] Customer sent a new message (Subject: "${subject || 'N/A'}").` +
      `\nStage advanced: ${prevStage} → ${nextStage} on ${new Date().toLocaleString()}.`;
    await lead.save();

    return res.json({ progressed: true, prevStage, nextStage, lead });

  } catch (error) {
    res.status(500).json({ message: 'Error progressing lead stage', error: error.message });
  }
};

/**
 * PATCH /api/sales/leads/:id/stage
 * Updates a lead's stage directly (e.g., to "Quotation Sent", "Contacted", etc.)
 */
export const updateLeadStage = async (req, res) => {
  try {
    const { id } = req.params;
    const { stage } = req.body;

    if (!stage) {
      return res.status(400).json({ message: 'Stage is required' });
    }

    const lead = await Lead.findOne({ id });
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    const prevStage = lead.stage;
    lead.stage = stage;
    lead.notes = (lead.notes || '') + `\n\n[Stage Updated] Stage changed from ${prevStage} to ${stage} on ${new Date().toLocaleString()}.`;
    await lead.save();

    // Moving into Won auto-creates (or links) the matching customer record — once per lead.
    if (stage === WON_STAGE && prevStage !== WON_STAGE) {
      try {
        const { customer, created, alreadyConverted } = await convertLeadToCustomer(lead);
        return res.json({
          success: true,
          message: created
            ? `Lead stage updated to ${stage} — customer ${customer.id} created.`
            : `Lead stage updated to ${stage} — linked to existing customer ${customer.id}.`,
          lead,
          prevStage,
          stage,
          conversion: { customer, created, alreadyConverted },
        });
      } catch (convErr) {
        // The stage change itself succeeded; report the conversion failure without losing it.
        console.error(`[Lead ${lead.id}] Auto-conversion failed:`, convErr.message);
        return res.json({
          success: true,
          message: `Lead stage updated to ${stage}, but customer creation failed: ${convErr.message}`,
          lead,
          prevStage,
          stage,
          conversion: null,
        });
      }
    }

    return res.json({
      success: true,
      message: `Lead stage updated to ${stage}`,
      lead,
      prevStage,
      stage
    });
  } catch (error) {
    console.error('Error updating lead stage:', error);
    res.status(500).json({ message: 'Error updating lead stage', error: error.message });
  }
};

export const getDocuments = async (req, res) => {
  try {
    const { type } = req.query; // filter by Quotation, Sales Order, Invoice
    const query = type ? { type } : {};
    const docs = await SalesDocument.find(query).sort({ date: -1 });
    res.json(docs);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching documents' });
  }
};

export const createDocument = async (req, res) => {
  try {
    const newDoc = new SalesDocument(req.body);
    const savedDoc = await newDoc.save();
    res.status(201).json(savedDoc);
  } catch (error) {
    res.status(400).json({ message: 'Error creating document', error: error.message });
  }
};

export const getDocumentById = async (req, res) => {
  try {
    const doc = await SalesDocument.findOne({ id: req.params.id });
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * GET /api/sales/performance
 * Computes live, authentic salesperson performance metrics from real MongoDB collections.
 */
export const getSalesPerformance = async (req, res) => {
  try {
    // 1. Fetch sales employees
    let employees = await Employee.find({
      $or: [
        { role: { $regex: /sales/i } },
        { department: { $regex: /sales/i } }
      ]
    }).lean();

    if (!employees || employees.length === 0) {
      employees = await Employee.find({ isActive: true }).lean();
    }

    // 2. Aggregate confirmed sales orders grouped by salesperson
    const salesOrders = await SalesOrder.aggregate([
      { $match: { status: { $ne: 'Cancelled' } } },
      {
        $group: {
          _id: { $trim: { input: { $ifNull: ['$salesperson', 'Unassigned'] } } },
          totalAchieved: { $sum: '$grandTotal' },
          orderCount: { $sum: 1 }
        }
      }
    ]);
    const ordersMap = new Map();
    salesOrders.forEach(o => {
      if (o._id) ordersMap.set(o._id.trim().toLowerCase(), o);
    });

    // 3. Aggregate quotations grouped by salesperson
    const quotations = await Quotation.aggregate([
      {
        $group: {
          _id: { $trim: { input: { $ifNull: ['$salesperson', 'Unassigned'] } } },
          quotationCount: { $sum: 1 },
          totalQuoted: { $sum: '$grandTotal' }
        }
      }
    ]);
    const quotationsMap = new Map();
    quotations.forEach(q => {
      if (q._id) quotationsMap.set(q._id.trim().toLowerCase(), q);
    });

    // 4. Aggregate leads grouped by salesperson
    const leads = await Lead.aggregate([
      {
        $group: {
          _id: { $trim: { input: { $ifNull: ['$salesperson', 'Unassigned'] } } },
          totalLeads: { $sum: 1 },
          wonLeads: { $sum: { $cond: [{ $eq: ['$stage', 'Won'] }, 1, 0] } }
        }
      }
    ]);
    const leadsMap = new Map();
    leads.forEach(l => {
      if (l._id) leadsMap.set(l._id.trim().toLowerCase(), l);
    });

    // 5. Aggregate managed accounts by salesperson
    const customerAccounts = await Customer.aggregate([
      {
        $group: {
          _id: { $trim: { input: { $ifNull: ['$salesPerson', 'Unassigned'] } } },
          customerCount: { $sum: 1 }
        }
      }
    ]);
    const customersMap = new Map();
    customerAccounts.forEach(c => {
      if (c._id) customersMap.set(c._id.trim().toLowerCase(), c.customerCount);
    });

    // 6. Build per-salesperson metrics
    const salespeople = employees.map(emp => {
      const nameKey = (emp.fullName || '').trim().toLowerCase();
      
      const orderData = ordersMap.get(nameKey) || { totalAchieved: 0, orderCount: 0 };
      const quoteData = quotationsMap.get(nameKey) || { quotationCount: 0, totalQuoted: 0 };
      const leadData = leadsMap.get(nameKey) || { totalLeads: 0, wonLeads: 0 };
      const clientCount = customersMap.get(nameKey) || 0;

      // Commercial target in INR: Persisted on Employee record or role-based default
      const target = emp.target ?? (emp.role?.toLowerCase().includes('senior') ? 2500000 : 1500000);
      const achieved = orderData.totalAchieved || 0;
      const pct = target > 0 ? Math.round((achieved / target) * 100) : 0;

      return {
        id: emp._id,
        name: emp.fullName,
        code: emp.employeeCode || `CT${String(emp._id).slice(-3)}`,
        role: emp.role,
        department: emp.department || 'Sales',
        target,
        achieved,
        pct,
        leads: leadData.totalLeads,
        wonLeads: leadData.wonLeads,
        quotations: quoteData.quotationCount,
        quotationValue: quoteData.totalQuoted,
        orders: orderData.orderCount,
        customers: clientCount
      };
    });

    // 7. Calculate overall summary
    const totalTarget = salespeople.reduce((acc, s) => acc + s.target, 0);
    const totalAchieved = salespeople.reduce((acc, s) => acc + s.achieved, 0);
    const aboveTarget = salespeople.filter(s => s.achieved >= s.target).length;
    const totalLeads = salespeople.reduce((acc, s) => acc + s.leads, 0);
    const totalWonLeads = salespeople.reduce((acc, s) => acc + s.wonLeads, 0);
    const totalQuotations = salespeople.reduce((acc, s) => acc + s.quotations, 0);

    const teamComparison = salespeople.map(s => ({
      name: s.name,
      target: s.target / 100000,
      achieved: Math.round((s.achieved / 100000) * 10) / 10,
      leads: s.leads,
      wonLeads: s.wonLeads,
      quotations: s.quotations,
      pct: s.pct
    }));

    res.json({
      success: true,
      data: {
        summary: {
          salespeopleCount: salespeople.length,
          totalTarget,
          totalAchieved,
          aboveTarget,
          totalLeads,
          totalWonLeads,
          totalQuotations
        },
        salespeople,
        teamComparison
      }
    });
  } catch (error) {
    console.error('Error in getSalesPerformance:', error);
    res.status(500).json({ success: false, message: 'Server error computing sales performance', error: error.message });
  }
};

/**
 * PATCH /api/sales/performance/target/:id
 * Allows Admin and Manager to set or update a salesperson's target.
 */
export const updateSalespersonTarget = async (req, res) => {
  try {
    const { id } = req.params;
    const { target } = req.body;

    const numTarget = Number(target);
    if (isNaN(numTarget) || numTarget < 0) {
      return res.status(400).json({ success: false, message: 'Invalid target amount. Must be a valid positive number.' });
    }

    if (req.user) {
      const r = (req.user.role || '').toLowerCase();
      const isAllowed = r.includes('admin') || r.includes('director') || r.includes('manager');
      if (!isAllowed) {
        return res.status(403).json({ success: false, message: 'Permission denied: Only Admins and Managers can set sales targets.' });
      }
    }

    let employee = null;
    if (id && id.match(/^[0-9a-fA-F]{24}$/)) {
      employee = await Employee.findByIdAndUpdate(
        id,
        { $set: { target: numTarget } },
        { new: true }
      );
    }

    if (!employee) {
      employee = await Employee.findOneAndUpdate(
        { $or: [{ employeeCode: id }, { fullName: id }] },
        { $set: { target: numTarget } },
        { new: true }
      );
    }

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Salesperson not found' });
    }

    res.json({
      success: true,
      message: `Target for ${employee.fullName} updated to ₹${(numTarget >= 1e5 ? (numTarget / 1e5).toFixed(1) + ' Lakhs' : numTarget.toLocaleString('en-IN'))}`,
      employee: {
        id: employee._id,
        name: employee.fullName,
        target: employee.target
      }
    });
  } catch (error) {
    console.error('Error updating salesperson target:', error);
    res.status(500).json({ success: false, message: 'Server error updating target', error: error.message });
  }
};


