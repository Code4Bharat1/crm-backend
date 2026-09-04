import express from 'express';
import { getLeads, createLead, contactLeadByEmailId, progressLeadByContact, updateLeadStage, getDocuments, createDocument, getDocumentById } from '../controllers/salesController.js';

const router = express.Router();

router.route('/leads')
  .get(getLeads)
  .post(createLead);

// Must be before /leads/:id to avoid conflict
router.patch('/leads/by-email/:emailId', contactLeadByEmailId);
router.patch('/leads/progress-by-contact', progressLeadByContact);
router.patch('/leads/:id/stage', updateLeadStage);

router.route('/documents')
  .get(getDocuments)
  .post(createDocument);

router.route('/documents/:id')
  .get(getDocumentById);

export default router;
