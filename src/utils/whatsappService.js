import axios from 'axios';

/**
 * Send a WhatsApp message using Nexcore Alliance API
 * @param {Object} messageData - Payload containing phone_number, template_name, etc.
 * @returns {Promise<Object>} API response data
 */
export const sendWhatsAppMessage = async (messageData) => {
    const API_URL = process.env.WHATSAPP_API_URL;
    const VENDOR_UID = process.env.WHATSAPP_VENDOR_UID;
    const TOKEN = process.env.WHATSAPP_API_TOKEN;

    if (!API_URL || !VENDOR_UID || !TOKEN) {
        throw new Error('WhatsApp API credentials are not fully configured in environment variables.');
    }

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
        return response.data;
    } catch (error) {
        console.error('Error sending WhatsApp message:', error.response?.data || error.message);
        throw error;
    }
};
