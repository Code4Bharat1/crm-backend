import mongoose from 'mongoose';

const whatsappMessageSchema = new mongoose.Schema(
  {
    phoneNumber: {
      type: String,
      required: true,
      index: true,
    },
    direction: {
      type: String,
      enum: ['Incoming', 'Outgoing'],
      required: true,
    },
    body: {
      type: String,
      required: true, // For templates, this could be the template name or preview text
    },
    messageId: {
      type: String, // from WhatsApp API
    },
    status: {
      type: String,
      default: 'sent', // sent, delivered, read, received
    },
    mediaUrl: {
      type: String,
    },
    mediaType: {
      type: String,
    }
  },
  { timestamps: true }
);

const WhatsAppMessage = mongoose.model('WhatsAppMessage', whatsappMessageSchema);

export default WhatsAppMessage;
