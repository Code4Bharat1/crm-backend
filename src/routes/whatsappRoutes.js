import express from 'express';
import {
  verifyWebhook,
  handleWebhook,
  sendMessage,
  getConversations,
  getMessages,
  getWhatsAppQR,
  getWhatsAppConfig,
  simulateIncomingMessage
} from '../controllers/whatsappController.js';

const router = express.Router();

// Meta Cloud API Webhook Verification (GET) & Event Handler (POST)
router.get('/webhook', verifyWebhook);
router.post('/webhook', handleWebhook);

// Outbound Messaging & Chat History
router.post('/send-message', sendMessage);
router.get('/conversations', getConversations);
router.get('/messages/:phone', getMessages);

// Scan QR Code & Click-to-Chat Link Generation
router.get('/qr', getWhatsAppQR);

// Webhook & Integration Configuration status
router.get('/config', getWhatsAppConfig);

// Simulate incoming message (for development/testing and demo)
router.post('/simulate-incoming', simulateIncomingMessage);

export default router;
