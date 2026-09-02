import express from 'express';
const router = express.Router();
import * as aiController from '../controllers/aiController.js';

// Route to fetch latest email and extract lead info
router.post('/extract-lead', aiController.extractLead);

// Route to extract lead from provided text
router.post('/extract-lead-from-text', aiController.extractLeadFromText);

// Route to fetch latest email
router.get('/fetch-email', aiController.fetchEmail);

// Route to get all fetched emails
router.get('/emails', aiController.getEmails);

// Route to mark email as read
router.put('/emails/:uid/read', aiController.markEmailAsRead);

// Route to send follow-up
router.post('/emails/:uid/follow-up', aiController.sendFollowUpEmail);

export default router;
