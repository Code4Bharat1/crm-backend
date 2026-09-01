import express from 'express';
import { getLeads, createLead, getDocuments, createDocument, getDocumentById } from '../controllers/salesController.js';

const router = express.Router();

router.route('/leads')
  .get(getLeads)
  .post(createLead);

router.route('/documents')
  .get(getDocuments)
  .post(createDocument);

router.route('/documents/:id')
  .get(getDocumentById);

export default router;
