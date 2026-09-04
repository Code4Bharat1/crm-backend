import Lead from '../models/Lead.js';
import SalesDocument from '../models/SalesDocument.js';

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
