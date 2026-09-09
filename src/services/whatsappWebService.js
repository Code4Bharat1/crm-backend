import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode';
import WhatsAppMessage from '../models/whatsappMessageModel.js';
import Customer from '../models/Customer.js';
import Lead from '../models/Lead.js';

let client = null;
let isInitializing = false;
let qrCodeDataUrl = null;
let rawQrString = null;
let clientStatus = 'DISCONNECTED'; // 'DISCONNECTED' | 'INITIALIZING' | 'QR_READY' | 'AUTHENTICATED' | 'CONNECTED'
let lastStatusUpdate = new Date();

/**
 * Match Customer or Lead by phone number (last 10 digits)
 */
const findLeadOrCustomer = async (phone) => {
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
 * Initialize WhatsApp Web Client with LocalAuth session persistence
 */
export const initWhatsAppWeb = () => {
    if (client || isInitializing) {
        console.log(`[WhatsApp-Web] Client already running or initializing (status: ${clientStatus})`);
        return;
    }

    isInitializing = true;
    clientStatus = 'INITIALIZING';
    lastStatusUpdate = new Date();
    console.log('🤖 [WhatsApp-Web] Initializing WhatsApp Web Client...');

    try {
        client = new Client({
            authStrategy: new LocalAuth({
                dataPath: './.wwebjs_auth'
            }),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ]
            }
        });

        // Event: QR Code emitted by WhatsApp Web for linking
        client.on('qr', async (qr) => {
            console.log('📱 [WhatsApp-Web] New QR Code generated. Scan via WhatsApp Linked Devices.');
            clientStatus = 'QR_READY';
            rawQrString = qr;
            lastStatusUpdate = new Date();
            try {
                qrCodeDataUrl = await qrcode.toDataURL(qr, { margin: 2, scale: 8 });
            } catch (err) {
                console.error('[WhatsApp-Web] QR code DataURL generation failed:', err);
            }
        });

        // Event: Authenticated successfully
        client.on('authenticated', () => {
            console.log('✅ [WhatsApp-Web] Client authenticated successfully');
            clientStatus = 'AUTHENTICATED';
            lastStatusUpdate = new Date();
        });

        // Event: Loading screen progress (syncing chats from phone)
        client.on('loading_screen', (percent, message) => {
            console.log(`⏳ [WhatsApp-Web] Syncing chats: ${percent}% (${message || 'Loading'})`);
            clientStatus = 'AUTHENTICATED';
            lastStatusUpdate = new Date();
        });

        // Event: Ready to send/receive messages
        client.on('ready', () => {
            console.log('🚀 [WhatsApp-Web] Client is READY to send and receive messages!');
            clientStatus = 'CONNECTED';
            isInitializing = false;
            qrCodeDataUrl = null;
            rawQrString = null;
            lastStatusUpdate = new Date();
        });


        // Event: Incoming WhatsApp message
        client.on('message', async (msg) => {
            try {
                // WhatsApp IDs format: "919850011223@c.us" or group "xxx@g.us"
                if (msg.from.includes('@g.us')) {
                    // Skip group messages by default to prevent noise in CRM
                    return;
                }

                const cleanPhone = String(msg.from || '').replace(/[^\d]/g, '');
                let bodyText = msg.body || '';

                if (msg.hasMedia && !bodyText) {
                    bodyText = `[Media: ${msg.type || 'Attachment'}]`;
                }

                const { customer, lead, displayName } = await findLeadOrCustomer(cleanPhone);
                const senderName = displayName || msg._data?.notifyName || cleanPhone;

                await WhatsAppMessage.create({
                    phoneNumber: cleanPhone,
                    senderName,
                    direction: 'Incoming',
                    body: bodyText || '[Empty Message]',
                    messageId: msg.id?.id || `wweb-${Date.now()}`,
                    status: 'received',
                    customerId: customer?._id || null,
                    leadId: lead?._id || null,
                    rawPayload: {
                        from: msg.from,
                        type: msg.type,
                        timestamp: msg.timestamp
                    }
                });

                console.log(`📥 [WhatsApp-Web] Saved message from ${cleanPhone} (${senderName}): "${bodyText}"`);
            } catch (err) {
                console.error('[WhatsApp-Web] Failed to process incoming message:', err);
            }
        });

        // Event: Authentication failure
        client.on('auth_failure', (msg) => {
            console.error('❌ [WhatsApp-Web] Authentication failure:', msg);
            clientStatus = 'DISCONNECTED';
            isInitializing = false;
            client = null;
            qrCodeDataUrl = null;
            rawQrString = null;
            lastStatusUpdate = new Date();
        });

        // Event: Disconnected or logged out
        client.on('disconnected', async (reason) => {
            console.warn('⚠️ [WhatsApp-Web] Client was disconnected:', reason);
            clientStatus = 'DISCONNECTED';
            isInitializing = false;
            try {
                if (client) {
                    await client.destroy();
                }
            } catch (destroyErr) {
                // Ignore background file lock unlinks on Windows
            }
            client = null;
            qrCodeDataUrl = null;
            rawQrString = null;
            lastStatusUpdate = new Date();
        });

        client.initialize().catch(err => {
            console.error('❌ [WhatsApp-Web] Initialization error:', err.message);
            clientStatus = 'DISCONNECTED';
            isInitializing = false;
            try {
                if (client) client.destroy();
            } catch (e) {}
            client = null;
            lastStatusUpdate = new Date();
        });
    } catch (err) {
        console.error('❌ [WhatsApp-Web] Setup exception:', err.message);
        clientStatus = 'DISCONNECTED';
        isInitializing = false;
        client = null;
    }

};

/**
 * Wait for client to reach READY state if it is currently AUTHENTICATED
 */
export const waitForReady = async (timeoutMs = 25000) => {
    if (clientStatus === 'CONNECTED') return true;
    if (clientStatus !== 'AUTHENTICATED') return false;

    console.log('⏳ [WhatsApp-Web] Authenticated, waiting for chat synchronization (READY event)...');
    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            console.warn('⚠️ [WhatsApp-Web] Sync timed out waiting for ready event.');
            if (client?.info) {
                clientStatus = 'CONNECTED';
                return resolve(true);
            }
            resolve(false);
        }, timeoutMs);

        const onReady = () => {
            clearTimeout(timer);
            clientStatus = 'CONNECTED';
            resolve(true);
        };

        if (client) {
            client.once('ready', onReady);
        } else {
            clearTimeout(timer);
            resolve(false);
        }
    });
};

/**
 * Send an outbound message using the active WhatsApp Web Client
 * @param {string} phoneNumber - Target phone number
 * @param {string} text - Message body
 */
export const sendWebMessage = async (phoneNumber, text) => {
    if (!client) {
        throw new Error('WhatsApp Web Client is not initialized. Please click "Link Phone" to scan the QR code.');
    }

    // If currently authenticated and syncing, wait for ready
    if (clientStatus === 'AUTHENTICATED') {
        console.log('⏳ [WhatsApp-Web] Waiting for initial chat sync before sending...');
        const ready = await waitForReady(25000);
        if (!ready && !client?.info) {
            throw new Error('WhatsApp Web is still syncing your chats with the phone. Please wait 10 seconds and click Send again.');
        }
    }

    if (clientStatus !== 'CONNECTED' && !client?.info) {
        throw new Error(`WhatsApp Web Client is not connected (current status: ${clientStatus}). Please link your phone.`);
    }

    const clean = String(phoneNumber || '').replace(/[^\d]/g, '');
    const chatId = `${clean}@c.us`;

    console.log(`📤 [WhatsApp-Web] Sending message to ${chatId}: "${text}"`);
    const sent = await client.sendMessage(chatId, text);
    return {
        provider: 'whatsapp_web_js',
        id: sent.id?.id,
        to: clean,
        body: text,
        timestamp: sent.timestamp
    };
};

/**
 * Check if the WhatsApp Web client is currently ready or authenticated
 */
export const isWebClientConnected = () => {
    return client !== null && (clientStatus === 'CONNECTED' || clientStatus === 'AUTHENTICATED');
};


/**
 * Get current client status and QR code
 */
export const getWebClientStatus = () => {
    return {
        status: clientStatus,
        isConnected: clientStatus === 'CONNECTED',
        qrCodeUrl: qrCodeDataUrl,
        rawQrString,
        lastUpdated: lastStatusUpdate
    };
};

/**
 * Disconnect and destroy the current session
 */
export const disconnectWebClient = async () => {
    if (client) {
        try {
            console.log('🔌 [WhatsApp-Web] Logging out and destroying client...');
            await client.logout().catch(() => {});
            await client.destroy().catch(() => {});
        } catch (e) {
            console.error('[WhatsApp-Web] Error during client disconnect:', e.message);
        }
        client = null;
        isInitializing = false;
        clientStatus = 'DISCONNECTED';
        qrCodeDataUrl = null;
        rawQrString = null;
        lastStatusUpdate = new Date();
    }
    return { success: true, status: 'DISCONNECTED' };
};

