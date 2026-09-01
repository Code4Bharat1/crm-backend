import express from 'express';
const router = express.Router();
import * as aiController from '../controllers/aiController.js';

// Route to fetch latest email and extract lead info
router.post('/extract-lead', aiController.extractLead);

// Route to fetch latest email
router.get('/fetch-email', aiController.fetchEmail);

// Route to get all fetched emails
router.get('/emails', aiController.getEmails);

export default router;
