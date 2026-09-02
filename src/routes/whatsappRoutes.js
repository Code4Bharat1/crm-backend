import express from 'express';
import { handleWebhook, sendMessage, getConversations, getMessages } from '../controllers/whatsappController.js';

const router = express.Router();

// Webhook endpoint to receive WhatsApp messages/events
router.post('/webhook', handleWebhook);

// Internal API endpoint to trigger a WhatsApp message
router.post('/send-message', sendMessage);

// Internal API to fetch conversations
router.get('/conversations', getConversations);

// Internal API to fetch messages for a specific phone number
router.get('/messages/:phone', getMessages);

export default router;

