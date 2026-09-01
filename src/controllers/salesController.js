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
    const newLead = new Lead(req.body);
    const savedLead = await newLead.save();
    res.status(201).json(savedLead);
  } catch (error) {
    res.status(400).json({ message: 'Error creating lead', error: error.message });
  }
};

// --- SALES DOCUMENTS ---

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
