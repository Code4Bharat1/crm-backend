import axios from 'axios';
import { isWebClientConnected, sendWebMessage } from '../services/whatsappWebService.js';

/**
 * Send a WhatsApp message using WhatsApp Web Client, Meta Cloud API, or Nexcore Alliance Gateway
 * @param {Object} messageData - Payload containing phone_number, message_body / text, template_name, etc.
 * @returns {Promise<Object>} API response data
 */
export const sendWhatsAppMessage = async (messageData) => {
    const cleanPhone = String(messageData.phone_number || '').replace(/[^\d]/g, '');

    // 0. Check if WhatsApp Web Client (whatsapp-web.js) is active and connected
    if (isWebClientConnected()) {
        const text = messageData.message_body || messageData.message || messageData.body || messageData.text || '';
        try {
            console.log('📱 Sending message via WhatsApp Web Client (whatsapp-web.js) to:', cleanPhone);
            const webResult = await sendWebMessage(cleanPhone, text);
            return {
                provider: 'whatsapp_web_js',
                ...webResult
            };
        } catch (webErr) {
            console.error('⚠️ WhatsApp Web Client send error:', webErr.message);
            // Do not fall back to third-party vendor gateway when user is intentionally using WhatsApp Web!
            throw webErr;
        }
    }


    // 1. Check for official Meta Cloud API configuration
    const META_TOKEN = process.env.WHATSAPP_CLOUD_API_TOKEN || process.env.META_WHATSAPP_TOKEN;
    const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;


    if (META_TOKEN && PHONE_NUMBER_ID) {
        try {
            const metaEndpoint = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;
            let metaPayload;

            if (messageData.template_name) {
                metaPayload = {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: cleanPhone,
                    type: 'template',
                    template: {
                        name: messageData.template_name,
                        language: { code: messageData.template_language || 'en' }
                    }
                };
            } else {
                metaPayload = {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: cleanPhone,
                    type: 'text',
                    text: {
                        preview_url: false,
                        body: messageData.message_body || messageData.message || messageData.body || messageData.text || ''
                    }
                };
            }

            console.log('Sending message via Meta Cloud API:', { to: cleanPhone, type: metaPayload.type });
            const response = await axios.post(metaEndpoint, metaPayload, {
                headers: {
                    'Authorization': `Bearer ${META_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });
            return {
                provider: 'meta_cloud_api',
                ...response.data
            };
        } catch (error) {
            console.error('Meta Cloud API send error:', error.response?.data || error.message);
            throw error;
        }
    }

    // 2. Nexcore Vendor Gateway
    const API_URL = process.env.WHATSAPP_API_URL;
    const VENDOR_UID = process.env.WHATSAPP_VENDOR_UID;
    const TOKEN = process.env.WHATSAPP_API_TOKEN;

    if (API_URL && VENDOR_UID && TOKEN) {
        const endpoint = `${API_URL}/${VENDOR_UID}/contact/send-message`;
        try {
            const response = await axios.post(
                endpoint,
                messageData,
                {
                    headers: {
                        'Authorization': `Bearer ${TOKEN}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            return {
                provider: 'nexcore_gateway',
                ...response.data
            };
        } catch (error) {
            const errData = error.response?.data;
            const errMsg = errData?.message || error.message;
            console.error('Nexcore Gateway send error:', errData || error.message);
            throw new Error(`WhatsApp Gateway Error (${errMsg}). If you have scanned your phone, please wait a moment for WhatsApp Web to finish syncing.`);
        }

    }

    // 3. Fallback: Log simulated delivery if in test mode
    console.warn('⚠️ No active WhatsApp gateway credentials. Simulated delivery to:', cleanPhone);
    return {
        provider: 'simulated_dev',
        status: 'simulated',
        phone: cleanPhone,
        message: 'WhatsApp API credentials not configured; message saved locally to DB.'
    };
};

/**
 * Generate a WhatsApp Scan QR code & Click-to-Chat deep link
 * @param {string} phone - Target business WhatsApp phone number
 * @param {string} prefilledMessage - Message automatically placed in chat
 */
export const generateWhatsAppQR = (phone, prefilledMessage = 'Hello Nexcore, I would like to inquire about your automation products and solutions.') => {
    const rawNumber = String(phone || process.env.WHATSAPP_BUSINESS_PHONE_NUMBER || process.env.WHATSAPP_TEST_PHONE_NUMBER || '919850011223').replace(/[^\d]/g, '');
    const encodedText = encodeURIComponent(prefilledMessage);
    const chatUrl = `https://wa.me/${rawNumber}?text=${encodedText}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(chatUrl)}&margin=10`;

    return {
        phoneNumber: rawNumber,
        chatUrl,
        qrCodeUrl,
        prefilledMessage
    };
};
