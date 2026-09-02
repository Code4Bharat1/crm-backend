import { sendWhatsAppMessage } from '../utils/whatsappService.js';
import WhatsAppMessage from '../models/whatsappMessageModel.js';

/**
 * Handle incoming webhooks from WhatsApp
 */
export const handleWebhook = async (req, res) => {
    try {
        const payload = req.body;
        
        console.log('--- WhatsApp Webhook Received ---');
        
        // Acknowledge receipt to avoid WhatsApp resending the webhook
        res.status(200).send('EVENT_RECEIVED');
        
        if (payload.message && payload.message.is_new_message) {
            const phoneNumber = payload.contact?.phone_number;
            let bodyText = payload.message.body;
            let mediaUrl = null;
            let mediaType = null;

            if (payload.message.media) {
                mediaUrl = payload.message.media.link;
                mediaType = payload.message.media.type;
                bodyText = payload.message.media.caption || `[Media: ${mediaType}]`;
            }

            if (phoneNumber) {
                await WhatsAppMessage.create({
                    phoneNumber,
                    direction: 'Incoming',
                    body: bodyText || '[Empty Message]',
                    messageId: payload.message.whatsapp_message_id,
                    status: 'received',
                    mediaUrl,
                    mediaType
                });
                console.log(`Saved incoming message from ${phoneNumber}`);
            }
        }
    } catch (error) {
        console.error('Webhook handling error:', error);
        // Do not send 500 back to WhatsApp if we already sent 200, 
        // but if it failed before the 200, we might need to (though we moved the 200 up).
    }
};

/**
 * Endpoint to test sending a WhatsApp message
 */
export const sendMessage = async (req, res) => {
    try {
        const {
            phone_number,
            template_name,
            template_language = 'en',
            message_body, // Changed from text_message
            ...dynamicFields
        } = req.body;

        if (!phone_number) {
            return res.status(400).json({ error: 'phone_number is required' });
        }

        let result;
        let bodyToSave = template_name ? `[Template: ${template_name}]` : message_body;

        if (message_body && !template_name) {
             // Nexcore API expects message_body for free-form text, but just in case, we send aliases.
             const outboundPayload = {
                 phone_number,
                 message_body: message_body,
                 message: message_body,
                 body: message_body,
                 text: message_body,
                 type: "text"
             };
             console.log("Sending free-form text payload to Nexcore:", outboundPayload);
             result = await sendWhatsAppMessage(outboundPayload);
        } else if (template_name) {
            const outboundTemplatePayload = {
                phone_number,
                template_name,
                template_language,
                // INJECT A DUMMY MESSAGE BODY! 
                // Nexcore's Laravel validation seems to demand 'message_body' even for templates.
                message_body: "template_message",
                ...dynamicFields
            };
            console.log("Sending template payload to Nexcore:", outboundTemplatePayload);
            result = await sendWhatsAppMessage(outboundTemplatePayload);
        } else {
             return res.status(400).json({ error: 'Either template_name or text_message is required' });
        }
        
        // Save outgoing message to DB
        await WhatsAppMessage.create({
            phoneNumber: phone_number,
            direction: 'Outgoing',
            body: bodyToSave,
            status: 'sent'
        });

        res.status(200).json({
            success: true,
            message: 'WhatsApp message triggered successfully',
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.response?.data || error.message
        });
    }
};

/**
 * Get a list of unique conversations (phone numbers)
 */
export const getConversations = async (req, res) => {
    try {
        const conversations = await WhatsAppMessage.aggregate([
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: "$phoneNumber",
                    lastMessage: { $first: "$$ROOT" }
                }
            },
            { $sort: { "lastMessage.createdAt": -1 } }
        ]);

        let formatted = conversations.map(c => ({
            id: c._id,
            name: c._id, // Ideally, we look up the customer name from DB here.
            contacts: [{ name: c._id, phone: c._id }],
            lastMessage: c.lastMessage
        }));

        // Inject default test phone number from .env if provided
        const defaultPhone = process.env.WHATSAPP_TEST_PHONE_NUMBER;
        if (defaultPhone && !formatted.some(c => c.id === defaultPhone)) {
            formatted.push({
                id: defaultPhone,
                name: "Test Contact",
                contacts: [{ name: "Test Contact", phone: defaultPhone }],
                lastMessage: null
            });
        }


        res.status(200).json({ success: true, data: formatted });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Get all messages for a specific phone number
 */
export const getMessages = async (req, res) => {
    try {
        const { phone } = req.params;
        const messages = await WhatsAppMessage.find({ phoneNumber: phone }).sort({ createdAt: 1 });
        
        const formatted = messages.map(m => ({
            id: m._id.toString(),
            preview: m.body,
            date: m.createdAt.toISOString(),
            channel: "WhatsApp",
            direction: m.direction
        }));

        res.status(200).json({ success: true, data: formatted });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
