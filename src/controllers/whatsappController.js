import Customer from '../models/Customer.js';
import Lead from '../models/Lead.js';
import WhatsAppMessage from '../models/whatsappMessageModel.js';
import { sendWhatsAppMessage, generateWhatsAppQR } from '../utils/whatsappService.js';
import {
    getWebClientStatus as fetchWebStatus,
    initWhatsAppWeb,
    disconnectWebClient as terminateWebClient
} from '../services/whatsappWebService.js';


/**
 * Helper to match Customer or Lead by phone number in MongoDB
 */
const findCustomerOrLeadByPhone = async (phone) => {
    if (!phone) return { customer: null, lead: null, displayName: phone };
    const digits = String(phone).replace(/[^\d]/g, '');
    const last10 = digits.slice(-10);

    let customer = null;
    let lead = null;

    if (last10.length >= 7) {
        customer = await Customer.findOne({
            $or: [
                { 'contactPerson.phone': { $regex: last10 } },
                { notes: { $regex: last10 } }
            ]
        }).lean();

        if (!customer) {
            lead = await Lead.findOne({
                $or: [
                    { notes: { $regex: last10 } },
                    { customerName: { $regex: last10 } }
                ]
            }).lean();
        }
    }

    const displayName = customer?.name || customer?.contactPerson?.name || lead?.customerName || null;
    return { customer, lead, displayName };
};

/**
 * Verification endpoint for Meta Cloud API Webhook (GET /api/whatsapp/webhook)
 * Meta calls this when you configure your Callback URL in Meta Developer App.
 */
export const verifyWebhook = (req, res) => {
    try {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || 'nexcore_whatsapp_verify_token_2026';

        if (mode === 'subscribe' && token === expectedToken) {
            console.log('✅ [Meta Cloud API] Webhook verified successfully with challenge:', challenge);
            return res.status(200).send(challenge);
        }

        console.warn('⚠️ [Meta Cloud API] Webhook verification failed. Token mismatch or bad mode:', { mode, token });
        return res.sendStatus(403);
    } catch (error) {
        console.error('Error during webhook verification:', error);
        return res.status(500).send(error.message);
    }
};

/**
 * Handle incoming webhooks from WhatsApp (Meta Cloud API & Vendor API)
 */
export const handleWebhook = async (req, res) => {
    try {
        const payload = req.body;

        // Meta requires an immediate 200 OK response
        res.status(200).send('EVENT_RECEIVED');

        // Case 1: Official Meta Cloud API Webhook
        if (payload.object === 'whatsapp_business_account' && Array.isArray(payload.entry)) {
            for (const entry of payload.entry) {
                for (const change of (entry.changes || [])) {
                    const value = change.value;
                    if (!value) continue;

                    // Handle incoming customer messages
                    if (Array.isArray(value.messages)) {
                        for (const msg of value.messages) {
                            const fromPhone = String(msg.from || '').replace(/[^\d]/g, '');
                            const contactProfile = (value.contacts || []).find(c => c.wa_id === fromPhone || c.wa_id === msg.from);
                            const senderName = contactProfile?.profile?.name || '';

                            let bodyText = '';
                            let mediaUrl = null;
                            let mediaType = null;

                            if (msg.type === 'text') {
                                bodyText = msg.text?.body || '';
                            } else if (msg.type === 'interactive') {
                                bodyText = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || '[Interactive Button]';
                            } else if (msg.type === 'button') {
                                bodyText = msg.button?.text || '[Button Click]';
                            } else if (['image', 'document', 'audio', 'video'].includes(msg.type)) {
                                mediaType = msg.type;
                                mediaUrl = msg[msg.type]?.id || null;
                                bodyText = msg[msg.type]?.caption || `[Attachment: ${msg.type}]`;
                            } else {
                                bodyText = `[Message: ${msg.type || 'Unknown'}]`;
                            }

                            const { customer, lead } = await findCustomerOrLeadByPhone(fromPhone);

                            await WhatsAppMessage.create({
                                phoneNumber: fromPhone,
                                senderName,
                                direction: 'Incoming',
                                body: bodyText || '[Empty Message]',
                                messageId: msg.id,
                                status: 'received',
                                mediaUrl,
                                mediaType,
                                customerId: customer?._id || null,
                                leadId: lead?._id || null,
                                rawPayload: msg
                            });

                            console.log(`📥 [Meta Cloud API] Saved incoming message from ${fromPhone} (${senderName || 'Customer'})`);
                        }
                    }

                    // Handle delivery/read status updates
                    if (Array.isArray(value.statuses)) {
                        for (const st of value.statuses) {
                            await WhatsAppMessage.updateOne(
                                { messageId: st.id },
                                { status: st.status }
                            );
                        }
                    }
                }
            }
            return;
        }

        // Case 2: Legacy / Vendor Gateway Webhook
        if (payload.message && payload.message.is_new_message) {
            const rawPhone = payload.contact?.phone_number || payload.phone_number;
            const phoneNumber = String(rawPhone || '').replace(/[^\d]/g, '');
            let bodyText = payload.message.body;
            let mediaUrl = null;
            let mediaType = null;

            if (payload.message.media) {
                mediaUrl = payload.message.media.link;
                mediaType = payload.message.media.type;
                bodyText = payload.message.media.caption || `[Media: ${mediaType}]`;
            }

            if (phoneNumber) {
                const { customer, lead } = await findCustomerOrLeadByPhone(phoneNumber);

                await WhatsAppMessage.create({
                    phoneNumber,
                    senderName: payload.contact?.name || '',
                    direction: 'Incoming',
                    body: bodyText || '[Empty Message]',
                    messageId: payload.message.whatsapp_message_id || payload.message.id,
                    status: 'received',
                    mediaUrl,
                    mediaType,
                    customerId: customer?._id || null,
                    leadId: lead?._id || null,
                    rawPayload: payload
                });
                console.log(`📥 [Vendor API] Saved incoming message from ${phoneNumber}`);
            }
        }
    } catch (error) {
        console.error('Webhook processing error:', error);
    }
};

/**
 * Trigger outbound WhatsApp message (free-form or template)
 */
export const sendMessage = async (req, res) => {
    try {
        const {
            phone_number,
            template_name,
            template_language = 'en',
            message_body,
            ...dynamicFields
        } = req.body;

        if (!phone_number) {
            return res.status(400).json({ error: 'phone_number is required' });
        }

        let result;
        const TEMPLATE_DESCRIPTIONS = {
            'quotation_shared': 'Dear Customer, we have shared your quotation. Kindly review and let us know if you have any questions.',
            'payment_reminder': 'Dear Customer, this is a gentle payment reminder regarding your pending invoice. Please share transaction details if settled.',
            'engineer_visit': 'Dear Customer, our service engineer visit has been scheduled. Our team will contact you shortly.',
            'dispatch_details': 'Dear Customer, your order has been dispatched. Dispatch and tracking details will follow.',
            'warranty_renewal': 'Dear Customer, your warranty / AMC is due for renewal. Please contact our support team.'
        };
        const templateDefaultText = template_name ? (TEMPLATE_DESCRIPTIONS[template_name] || `[Template: ${template_name}]`) : '';
        const bodyToSave = message_body || templateDefaultText;

        if (message_body && !template_name) {
            const outboundPayload = {
                phone_number,
                message_body,
                message: message_body,
                body: message_body,
                text: message_body,
                type: 'text'
            };
            result = await sendWhatsAppMessage(outboundPayload);
        } else if (template_name) {
            const outboundTemplatePayload = {
                phone_number,
                template_name,
                template_language,
                message_body: bodyToSave,
                message: bodyToSave,
                body: bodyToSave,
                text: bodyToSave,
                ...dynamicFields
            };
            result = await sendWhatsAppMessage(outboundTemplatePayload);
        } else {
            return res.status(400).json({ error: 'Either template_name or message_body is required' });
        }


        const { customer, lead } = await findCustomerOrLeadByPhone(phone_number);

        // Save outgoing message to DB
        const saved = await WhatsAppMessage.create({
            phoneNumber: String(phone_number).replace(/[^\d]/g, ''),
            direction: 'Outgoing',
            body: bodyToSave,
            status: 'sent',
            customerId: customer?._id || null,
            leadId: lead?._id || null,
            rawPayload: result
        });

        res.status(200).json({
            success: true,
            message: 'WhatsApp message sent successfully',
            data: {
                messageRecord: saved,
                gatewayResponse: result
            }
        });
    } catch (error) {
        console.error('Error sending WhatsApp message:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            error: error.response?.data || error.message
        });
    }
};

/**
 * Get all unique conversations (linked with real Customer/Lead names where possible)
 */
export const getConversations = async (req, res) => {
    try {
        const conversations = await WhatsAppMessage.aggregate([
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: '$phoneNumber',
                    lastMessage: { $first: '$$ROOT' },
                    senderName: { $first: '$senderName' },
                    totalMessages: { $sum: 1 },
                    unreadCount: {
                        $sum: {
                            $cond: [{ $eq: ['$direction', 'Incoming'] }, 1, 0]
                        }
                    }
                }
            },
            { $sort: { 'lastMessage.createdAt': -1 } }
        ]);

        const formatted = await Promise.all(conversations.map(async (c) => {
            const { customer, lead, displayName } = await findCustomerOrLeadByPhone(c._id);
            const title = displayName || c.senderName || c._id;
            return {
                id: c._id,
                name: title,
                phone: c._id,
                senderName: c.senderName || '',
                customer: customer ? { id: customer._id, name: customer.name } : null,
                lead: lead ? { id: lead._id, name: lead.customerName } : null,
                contacts: [{ name: title, phone: c._id }],
                lastMessage: c.lastMessage,
                unreadCount: c.unreadCount
            };
        }));

        // Provide default test contact if no conversations exist yet
        const defaultPhone = process.env.WHATSAPP_TEST_PHONE_NUMBER || '15559637917';
        if (defaultPhone && !formatted.some(c => c.id === defaultPhone)) {
            const { displayName } = await findCustomerOrLeadByPhone(defaultPhone);
            formatted.push({
                id: defaultPhone,
                name: displayName || 'Test Contact',
                phone: defaultPhone,
                contacts: [{ name: displayName || 'Test Contact', phone: defaultPhone }],
                lastMessage: null,
                unreadCount: 0
            });
        }

        res.status(200).json({ success: true, data: formatted });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Get message history for a specific phone number
 */
export const getMessages = async (req, res) => {
    try {
        const cleanPhone = String(req.params.phone || '').replace(/[^\d]/g, '');
        const last10 = cleanPhone.slice(-10);

        const messages = await WhatsAppMessage.find({
            $or: [
                { phoneNumber: cleanPhone },
                { phoneNumber: { $regex: last10 } }
            ]
        }).sort({ createdAt: 1 });

        const formatted = messages.map(m => ({
            id: m._id.toString(),
            preview: m.body,
            date: m.createdAt.toISOString(),
            channel: 'WhatsApp',
            direction: m.direction,
            status: m.status,
            senderName: m.senderName || null,
            mediaUrl: m.mediaUrl || null,
            mediaType: m.mediaType || null
        }));

        res.status(200).json({ success: true, data: formatted });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * GET /api/whatsapp/qr
 * Generates dynamic Scan QR Code & click-to-chat deep link
 */
export const getWhatsAppQR = async (req, res) => {
    try {
        const phone = req.query.phone || process.env.WHATSAPP_BUSINESS_PHONE_NUMBER || process.env.WHATSAPP_TEST_PHONE_NUMBER || '919850011223';
        const message = req.query.message || 'Hello Nexcore Alliance, I would like to inquire about your automation products and solutions.';
        const qrData = generateWhatsAppQR(phone, message);

        res.json({
            success: true,
            data: qrData
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * GET /api/whatsapp/config
 * Returns Webhook URL, Verify Token, and credentials state for Meta Dashboard setup
 */
export const getWhatsAppConfig = async (req, res) => {
    try {
        const backendBase = process.env.BACKEND_URL || (req.get('host') ? `${req.protocol}://${req.get('host')}` : 'https://api-crm.nexcorealliance.com');
        const webhookUrl = `${backendBase}/api/whatsapp/webhook`;
        const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'nexcore_whatsapp_verify_token_2026';
        const businessPhone = process.env.WHATSAPP_BUSINESS_PHONE_NUMBER || process.env.WHATSAPP_TEST_PHONE_NUMBER || '15559637917';
        const qr = generateWhatsAppQR(businessPhone);

        res.json({
            success: true,
            data: {
                webhookUrl,
                verifyToken,
                businessPhone,
                hasMetaToken: Boolean(process.env.WHATSAPP_CLOUD_API_TOKEN || process.env.META_WHATSAPP_TOKEN),
                hasPhoneNumberId: Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID),
                hasVendorConfig: Boolean(process.env.WHATSAPP_API_URL && process.env.WHATSAPP_VENDOR_UID),
                qr
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * POST /api/whatsapp/simulate-incoming
 * Simulates a customer scanning QR & sending a WhatsApp inquiry into the CRM
 */
export const simulateIncomingMessage = async (req, res) => {
    try {
        const { phone_number, message, sender_name } = req.body;
        const cleanPhone = String(phone_number || process.env.WHATSAPP_TEST_PHONE_NUMBER || '919850011223').replace(/[^\d]/g, '');
        const text = message || 'Hello Nexcore, I scanned your QR code and would like a quote for Omron Photoelectric Sensors and VFD panels.';
        const name = sender_name || 'Bharat Forge - Sunil Jagtap';

        const { customer, lead } = await findCustomerOrLeadByPhone(cleanPhone);

        const savedMsg = await WhatsAppMessage.create({
            phoneNumber: cleanPhone,
            senderName: name,
            direction: 'Incoming',
            body: text,
            messageId: `sim-qr-${Date.now()}`,
            status: 'received',
            customerId: customer?._id || null,
            leadId: lead?._id || null,
            rawPayload: { source: 'simulated_qr_scan', timestamp: new Date() }
        });

        res.json({
            success: true,
            message: `Simulated incoming WhatsApp message from ${name} (${cleanPhone})`,
            data: savedMsg
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * GET /api/whatsapp/web-client/status
 * Get connection status and live QR code of whatsapp-web.js client
 */
export const getWebClientStatus = (req, res) => {
    try {
        const statusData = fetchWebStatus();
        res.json({
            success: true,
            data: statusData
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * POST /api/whatsapp/web-client/start
 * Trigger initialization of whatsapp-web.js client (emits QR code)
 */
export const startWebClient = (req, res) => {
    try {
        initWhatsAppWeb();
        const statusData = fetchWebStatus();
        res.json({
            success: true,
            message: 'WhatsApp Web client initialization initiated. Please retrieve QR code.',
            data: statusData
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * POST /api/whatsapp/web-client/disconnect
 * Log out and tear down active whatsapp-web.js session
 */
export const disconnectWebClient = async (req, res) => {
    try {
        const result = await terminateWebClient();
        res.json({
            success: true,
            message: 'WhatsApp Web client disconnected successfully.',
            data: result
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

