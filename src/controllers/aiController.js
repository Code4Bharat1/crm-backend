import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import { GoogleGenerativeAI } from '@google/generative-ai';
import nodemailer from 'nodemailer';
import Email from '../models/Email.js';
import Lead from '../models/Lead.js';
import { generateWithRetry } from '../utils/geminiRetry.js';

const fetchLatestEmail = async (boxName = 'INBOX') => {
    const config = {
        imap: {
            user: process.env.EMAIL_ID,
            password: process.env.EMAIL_PASSWORD,
            host: 'imap.gmail.com',
            port: 993,
            tls: true,
            tlsOptions: { rejectUnauthorized: false },
            authTimeout: 30000,
            connTimeout: 30000
        }
    };

    try {
        const connection = await imaps.connect(config);
        await connection.openBox(boxName);
        
        // Search for all emails (just UIDs first to be fast)
        const searchCriteria = ['ALL'];
        const fetchOptions = { bodies: [''] }; // minimal fetch
        const results = await connection.search(searchCriteria, fetchOptions);
        
        if (!results || results.length === 0) {
            connection.end();
            return null;
        }

        // Get the UID of the latest email
        const lastUid = results[results.length - 1].attributes.uid;

        // Fetch the full body for this specific latest email
        const lastEmailResult = await connection.search([['UID', lastUid]], {
            bodies: ['HEADER', 'TEXT', ''],
            markSeen: true
        });
        
        const latestEmail = lastEmailResult[0];
        const allParts = latestEmail.parts.find(part => part.which === '');
        const id = latestEmail.attributes.uid;
        const idHeader = "Imap-Id: "+id+"\r\n";
        const mail = await simpleParser(idHeader + allParts.body);
        connection.end();
        
        const direction = boxName === 'INBOX' ? 'Incoming' : 'Outgoing';
        const uniqueUid = boxName === 'INBOX' ? lastUid.toString() : `sent-${lastUid.toString()}`;

        const emailData = {
            uid: uniqueUid,
            mailbox: process.env.EMAIL_ID,
            from: mail.from?.text || 'Unknown',
            subject: mail.subject || 'No Subject',
            text: mail.text || 'No Body',
            date: mail.date || new Date(),
            direction: direction
        };

        // Save or update in MongoDB to ensure it persists for the Email page
        await Email.findOneAndUpdate(
            { uid: uniqueUid },
            { $set: emailData },
            { upsert: true, returnDocument: 'after' }
        );
        
        return emailData;

    } catch (error) {
        console.error(`Error fetching email from ${boxName}:`, error);
        return null;
    }
};

export const extractLead = async (req, res) => {
    try {
        // Initialize Gemini
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        
        const email = await fetchLatestEmail();
        
        if (!email) {
            return res.status(404).json({ message: "No new unread emails found." });
        }

        // Using gemini-flash-latest to resolve 404 with newer API keys
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
        const prompt = `
You are an AI assistant that extracts structured lead information from emails.
Email from: ${email.from}
Date: ${email.date}
Subject: ${email.subject}
Body:
${email.text}

Extract the following information in strict JSON format:
- customer: Company name (string, infer from email or domain if possible)
- contactPerson: Name of contact (string)
- product: Product they need (string)
- quantity: Quantity required (string)
- expectedValue: Budget or expected value (string)
- expectedDate: Expected date for delivery/follow-up (string)
- area: Area/Location (string)
- suggestedStage: Stage like 'Potential', 'Qualified' (string)
- suggestedPriority: 'High', 'Medium', 'Low' (string)
- suggestedFollowUp: Suggested date to follow up (string)
- requirementSummary: A 2-sentence summary (string)

Return ONLY valid JSON.
`;

        const result = await generateWithRetry(model, prompt);
        let text = result.response.text();
        
        // Remove markdown formatting if present
        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        
        const leadData = JSON.parse(text);
        
        res.json({ email, lead: leadData });

    } catch (error) {
        console.error("Error processing AI lead extraction:", error);
        res.status(500).json({ message: "Internal server error while extracting lead", error: error.message });
    }
};

export const extractLeadFromText = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: "Email object is required" });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
        const prompt = `
You are an AI assistant that extracts structured lead information from emails.
Email from: ${email.customerName || 'Unknown'}
Date: ${email.date || new Date().toISOString()}
Subject: ${email.subject || 'No Subject'}
Body:
${email.fullText || email.preview || ''}

Extract the following information in strict JSON format:
- customer: Company name (string, infer from email or domain if possible)
- contactPerson: Name of contact (string)
- product: Product they need (string)
- quantity: Quantity required (string)
- expectedValue: Budget or expected value (string)
- expectedDate: Expected date for delivery/follow-up (string)
- area: Area/Location (string)
- suggestedStage: Stage like 'Potential', 'Qualified' (string)
- suggestedPriority: 'High', 'Medium', 'Low' (string)
- suggestedFollowUp: Suggested date to follow up (string)
- requirementSummary: A 2-sentence summary (string)

Return ONLY valid JSON.
`;

        const result = await generateWithRetry(model, prompt);
        let text = result.response.text();
        
        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        
        const leadData = JSON.parse(text);
        
        res.json({ lead: leadData });

    } catch (error) {
        console.error("Error processing AI lead extraction from text:", error);
        res.status(500).json({ message: "Internal server error while extracting lead", error: error.message });
    }
};

export const fetchEmail = async (req, res) => {
    try {
        const inboxEmail = await fetchLatestEmail('INBOX');
        const sentEmail  = await fetchLatestEmail('[Gmail]/Sent Mail');

        const fetchedEmails = [inboxEmail, sentEmail].filter(Boolean);

        if (fetchedEmails.length === 0) {
            return res.status(404).json({ message: "No new emails found." });
        }

        // --- Auto-progress leads for incoming emails ---
        // If the sender already has a "Contacted" lead, advance it to "Potential"
        const progressions = [];
        for (const email of fetchedEmails) {
            if (email.direction !== 'Incoming') continue;

            // Extract sender email address
            const contactMatch = (email.from || '').match(/<([^>]+)>/);
            const contact      = contactMatch ? contactMatch[1] : email.from;
            const customerName = (email.from || '').split('<')[0].trim() || email.from;

            // Find a Contacted lead matching this sender
            const existingLead = await Lead.findOne({
                stage: 'Contacted',
                $or: [
                    { notes: { $regex: new RegExp(contact.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } },
                    { customerName: { $regex: new RegExp(`^${customerName.trim()}$`, 'i') } }
                ]
            }).sort({ updatedAt: -1 });

            if (existingLead) {
                existingLead.stage = 'Potential';
                existingLead.notes = (existingLead.notes || '') +
                    `\n\n[Auto-Progressed] Customer sent a new message.` +
                    `\nSubject: "${email.subject}"` +
                    `\nStage advanced: Contacted → Potential on ${new Date().toLocaleString()}.`;
                await existingLead.save();
                progressions.push({
                    customerName,
                    prevStage: 'Contacted',
                    nextStage: 'Potential'
                });
                console.log(`[Lead Auto-Progress] ${customerName}: Contacted → Potential`);
            }
        }

        res.json({ emails: fetchedEmails, progressions });
    } catch (error) {
        console.error("Error fetching email:", error);
        res.status(500).json({ message: "Internal server error while fetching email", error: error.message });
    }
};


export const getEmails = async (req, res) => {
    try {
        const emails = await Email.find().sort({ date: -1 });
        res.json(emails);
    } catch (error) {
        console.error("Error retrieving emails:", error);
        res.status(500).json({ message: "Error retrieving emails", error: error.message });
    }
};

export const markEmailAsRead = async (req, res) => {
    const { uid } = req.params;
    
    // We only connect to Gmail if it's an actual IMAP UID (numeric string), 
    // but since we also generate mock UIDs sometimes on frontend, let's make sure it's valid for IMAP
    // If it's a mock email (e.g. starts with 'email-'), we just skip the IMAP part
    if (uid.startsWith('email-')) {
        return res.json({ message: "Mock email marked as read" });
    }

    try {
        await Email.findOneAndUpdate({ uid: uid.toString() }, { $set: { read: true } });
    } catch (err) {
        console.error("Error updating DB read status:", err);
    }

    const config = {
        imap: {
            user: process.env.EMAIL_ID,
            password: process.env.EMAIL_PASSWORD,
            host: 'imap.gmail.com',
            port: 993,
            tls: true,
            tlsOptions: { rejectUnauthorized: false },
            authTimeout: 30000,
            connTimeout: 30000
        }
    };

    try {
        const connection = await imaps.connect(config);
        await connection.openBox('INBOX');
        
        await connection.addFlags(uid, ['\\Seen']);
        connection.end();

        res.json({ message: "Email marked as read in Gmail" });
    } catch (error) {
        console.error("Error marking email as read in Gmail:", error);
        res.status(500).json({ message: "Error marking email as read in Gmail", error: error.message });
    }
};

export const sendFollowUpEmail = async (req, res) => {
    const { uid } = req.params;

    try {
        const emailRecord = await Email.findOne({ uid: uid.toString() });
        if (!emailRecord) {
            return res.status(404).json({ message: "Email not found in database" });
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_ID,
                pass: process.env.EMAIL_PASSWORD
            }
        });

        const recipient = emailRecord.from.match(/<([^>]+)>/)?.[1] || emailRecord.from;
        
        const mailOptions = {
            from: process.env.EMAIL_ID,
            to: recipient,
            subject: `Re: ${emailRecord.subject.replace(/^(Re:\s*)+/i, '')}`,
            html: `<strong>Hi,</strong><br/><br/>Just following up on my previous email. Please let me know if you need any further assistance regarding your query.<br/><br/>Best regards,<br/>Sales Team`
        };

        await transporter.sendMail(mailOptions);

        await Email.findOneAndUpdate({ uid: uid.toString() }, { $set: { followedUp: true } });

        res.json({ message: "Follow-up email sent successfully" });
    } catch (error) {
        console.error("Error sending follow-up email:", error);
        res.status(500).json({ message: "Error sending follow-up email", error: error.message });
    }
};
