import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import { GoogleGenerativeAI } from '@google/generative-ai';
import nodemailer from 'nodemailer';
import Email from '../models/Email.js';
import Lead from '../models/Lead.js';
import { generateWithRetry } from '../utils/geminiRetry.js';

const fetchRecentEmailsFromBox = async (boxName = 'INBOX', limit = 10) => {
    if (!process.env.EMAIL_ID || !process.env.EMAIL_PASSWORD) {
        console.warn(`[IMAP] Skipping ${boxName}: EMAIL_ID or EMAIL_PASSWORD not configured.`);
        return [];
    }

    const config = {
        imap: {
            user: process.env.EMAIL_ID,
            password: process.env.EMAIL_PASSWORD,
            host: 'imap.gmail.com',
            port: 993,
            tls: true,
            tlsOptions: { rejectUnauthorized: false },
            authTimeout: 20000,
            connTimeout: 20000
        }
    };

    let connection = null;

    try {
        connection = await imaps.connect(config);

        // Crucial: Attach error listener to prevent unhandled 'error' events on socket ECONNRESET from crashing the Node process
        connection.on('error', (err) => {
            console.error(`[IMAP Socket Error] ${boxName}:`, err?.message || err);
        });

        await connection.openBox(boxName);

        const searchCriteria = ['ALL'];
        const results = await connection.search(searchCriteria, { bodies: [''] });

        if (!results || results.length === 0) {
            return [];
        }

        const recentResults = results.slice(-limit);
        const uids = recentResults.map(r => r.attributes.uid);
        const range = uids[0] + ':' + uids[uids.length - 1];

        const messages = await connection.search([['UID', range]], {
            bodies: ['HEADER', 'TEXT', ''],
            markSeen: false
        });

        const emailList = [];
        for (const msg of messages) {
            try {
                const allParts = msg.parts.find(p => p.which === '');
                const id = msg.attributes.uid;
                const idHeader = "Imap-Id: " + id + "\r\n";
                const mail = await simpleParser(idHeader + (allParts?.body || ''));

                const direction = boxName === 'INBOX' ? 'Incoming' : 'Outgoing';
                const uniqueUid = boxName === 'INBOX' ? id.toString() : `sent-${id.toString()}`;

                const toText = mail.to?.text || (mail.to?.value?.[0]?.address) || '';

                const emailData = {
                    uid: uniqueUid,
                    mailbox: process.env.EMAIL_ID,
                    from: mail.from?.text || 'Unknown',
                    to: toText,
                    subject: mail.subject || 'No Subject',
                    text: mail.text || 'No Body',
                    date: mail.date || new Date(),
                    direction: direction
                };

                await Email.findOneAndUpdate(
                    { uid: uniqueUid },
                    { $set: emailData },
                    { upsert: true, returnDocument: 'after' }
                );

                emailList.push(emailData);
            } catch (itemErr) {
                console.error(`[IMAP] Error processing message UID ${msg?.attributes?.uid} in ${boxName}:`, itemErr.message || itemErr);
            }
        }

        return emailList;

    } catch (error) {
        console.error(`Error fetching emails from ${boxName}:`, error.message || error);
        return [];
    } finally {
        if (connection) {
            try {
                connection.end();
            } catch (closeErr) {
                // Suppress socket close errors
            }
        }
    }
};

const fetchLatestEmail = async (boxName = 'INBOX') => {
    const list = await fetchRecentEmailsFromBox(boxName, 1);
    return list.length > 0 ? list[list.length - 1] : null;
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
        const inboxEmails = await fetchRecentEmailsFromBox('INBOX', 5);
        const sentEmails  = await fetchRecentEmailsFromBox('[Gmail]/Sent Mail', 10);

        const fetchedEmails = [...inboxEmails, ...sentEmails];

        if (fetchedEmails.length === 0) {
            return res.status(404).json({ message: "No new emails found." });
        }

        const progressions = [];

        // --- 1. Process OUTGOING emails (replies sent from Gmail) ---
        // Advance leads from "New" to "Contacted"
        for (const email of sentEmails) {
            const toMatch = (email.to || '').match(/<([^>]+)>/);
            const recipient = (toMatch ? toMatch[1] : email.to || '').trim().toLowerCase();
            const recipientName = (email.to || '').split('<')[0].replace(/["']/g, '').trim();

            if (!recipient || recipient === (process.env.EMAIL_ID || '').toLowerCase()) continue;

            const cleanSubject = (email.subject || '').replace(/^(Re:\s*|Fwd:\s*|re:\s*|fwd:\s*)+/i, '').trim();

            // Find matching incoming email by sender or clean subject
            const matchedIncoming = await Email.findOne({
                direction: 'Incoming',
                $or: [
                    { from: { $regex: new RegExp(recipient.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } },
                    ...(cleanSubject ? [{ subject: { $regex: new RegExp(`^${cleanSubject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }] : [])
                ]
            });

            // Find existing lead
            let existingLead = null;
            if (matchedIncoming) {
                existingLead = await Lead.findOne({ sourceEmailId: matchedIncoming.uid });
            }
            if (!existingLead) {
                existingLead = await Lead.findOne({
                    $or: [
                        { customerEmail: { $regex: new RegExp(`^${recipient}$`, 'i') } },
                        { notes: { $regex: new RegExp(recipient.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } },
                        ...(recipientName ? [{ customerName: { $regex: new RegExp(`^${recipientName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }] : [])
                    ]
                }).sort({ updatedAt: -1 });
            }

            if (existingLead) {
                if (existingLead.stage === 'New') {
                    const prevStage = existingLead.stage;
                    existingLead.stage = 'Contacted';
                    existingLead.customerEmail = existingLead.customerEmail || recipient;
                    existingLead.lastRepliedAt = email.date || new Date();
                    existingLead.notes = (existingLead.notes || '') +
                        `\n\n[Replied via Gmail] Reply sent to ${recipient} on ${new Date(email.date || Date.now()).toLocaleString()}.\nSubject: "${email.subject}"`;
                    await existingLead.save();

                    progressions.push({
                        id: existingLead.id,
                        customerName: existingLead.customerName,
                        prevStage,
                        nextStage: 'Contacted',
                        type: 'outgoing_reply',
                        replyDate: email.date
                    });
                    console.log(`[Lead Auto-Progress] ${existingLead.customerName} (${existingLead.id}): New → Contacted (Gmail Reply)`);
                } else if (!existingLead.notes?.includes(email.subject)) {
                    existingLead.lastRepliedAt = email.date || new Date();
                    existingLead.notes = (existingLead.notes || '') +
                        `\n\n[Replied via Gmail] Additional reply sent to ${recipient} on ${new Date(email.date || Date.now()).toLocaleString()}.\nSubject: "${email.subject}"`;
                    await existingLead.save();
                }
            } else if (matchedIncoming) {
                // Customer sent inquiry, we replied in Gmail before lead was generated: create directly at Contacted stage!
                const newLead = new Lead({
                    id: `LD-${Math.floor(Math.random() * 9000) + 1000}`,
                    customerName: recipientName || matchedIncoming.from.split('<')[0].replace(/["']/g, '').trim() || 'Unknown Customer',
                    source: 'Email Inquiry',
                    stage: 'Contacted',
                    priority: 'Medium',
                    value: 0,
                    salesperson: 'System AI',
                    area: 'Online',
                    notes: `Requirement: Inquiry via Email (${matchedIncoming.subject})\n\n[Replied via Gmail] Reply sent to ${recipient} on ${new Date(email.date || Date.now()).toLocaleString()}.\nSubject: "${email.subject}"`,
                    sourceEmailId: matchedIncoming.uid,
                    customerEmail: recipient,
                    lastRepliedAt: email.date || new Date()
                });
                await newLead.save();
                progressions.push({
                    id: newLead.id,
                    customerName: newLead.customerName,
                    prevStage: 'New',
                    nextStage: 'Contacted',
                    type: 'outgoing_reply',
                    replyDate: email.date
                });
                console.log(`[Lead Auto-Created] ${newLead.customerName} (${newLead.id}): Created at Contacted (Gmail Reply)`);
            }
        }

        // --- 2. Process INCOMING emails: Advance leads from Contacted -> Potential ---
        for (const email of inboxEmails) {
            const contactMatch = (email.from || '').match(/<([^>]+)>/);
            const contact      = (contactMatch ? contactMatch[1] : email.from || '').trim().toLowerCase();
            const customerName = (email.from || '').split('<')[0].replace(/["']/g, '').trim() || email.from;

            const existingLead = await Lead.findOne({
                stage: 'Contacted',
                $or: [
                    { customerEmail: { $regex: new RegExp(`^${contact}$`, 'i') } },
                    { notes: { $regex: new RegExp(contact.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } },
                    { customerName: { $regex: new RegExp(`^${customerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }
                ]
            }).sort({ updatedAt: -1 });

            if (existingLead) {
                // Only advance to Potential if the incoming email was received AFTER our reply was sent!
                if (existingLead.lastRepliedAt && new Date(email.date) <= new Date(existingLead.lastRepliedAt)) {
                    continue;
                }

                existingLead.stage = 'Potential';
                existingLead.notes = (existingLead.notes || '') +
                    `\n\n[Auto-Progressed] Customer sent a new message.` +
                    `\nSubject: "${email.subject}"` +
                    `\nStage advanced: Contacted → Potential on ${new Date().toLocaleString()}.`;
                await existingLead.save();
                progressions.push({
                    id: existingLead.id,
                    customerName: existingLead.customerName,
                    prevStage: 'Contacted',
                    nextStage: 'Potential',
                    type: 'incoming_reply'
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

export const syncGmail = fetchEmail;


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

    if (!process.env.EMAIL_ID || !process.env.EMAIL_PASSWORD) {
        return res.json({ message: "Email marked as read locally (IMAP not configured)" });
    }

    const config = {
        imap: {
            user: process.env.EMAIL_ID,
            password: process.env.EMAIL_PASSWORD,
            host: 'imap.gmail.com',
            port: 993,
            tls: true,
            tlsOptions: { rejectUnauthorized: false },
            authTimeout: 20000,
            connTimeout: 20000
        }
    };

    let connection = null;
    try {
        connection = await imaps.connect(config);
        connection.on('error', (err) => {
            console.error("IMAP connection error in markEmailAsRead:", err?.message || err);
        });
        await connection.openBox('INBOX');
        await connection.addFlags(uid, ['\\Seen']);

        res.json({ message: "Email marked as read in Gmail" });
    } catch (error) {
        console.error("Error marking email as read in Gmail:", error.message || error);
        res.status(500).json({ message: "Error marking email as read in Gmail", error: error.message });
    } finally {
        if (connection) {
            try {
                connection.end();
            } catch (closeErr) {}
        }
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

export const sendDirectEmail = async (req, res) => {
    try {
        const { to, subject, message, leadId, targetStage, emailType } = req.body;

        if (!to || !subject || !message) {
            return res.status(400).json({ message: "Recipient (to), subject, and message are required." });
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_ID,
                pass: process.env.EMAIL_PASSWORD
            }
        });

        const mailOptions = {
            from: process.env.EMAIL_ID,
            to: to.trim(),
            subject: subject.trim(),
            text: message,
            html: `<div>${message.replace(/\n/g, '<br/>')}</div><br/><br/><em>Sent from Sales Team</em>`
        };

        await transporter.sendMail(mailOptions);
        const sentDate = new Date();
        const sentUid = `sent-web-${Date.now()}`;

        // Save email record in MongoDB
        const emailRecord = new Email({
            uid: sentUid,
            mailbox: process.env.EMAIL_ID,
            from: process.env.EMAIL_ID,
            to: to.trim(),
            subject: subject.trim(),
            text: message,
            date: sentDate,
            direction: 'Outgoing',
            read: true,
            followedUp: true
        });
        await emailRecord.save();

        // Update matching lead
        let updatedLead = null;
        if (leadId) {
            updatedLead = await Lead.findOne({ id: leadId });
        }
        if (!updatedLead) {
            updatedLead = await Lead.findOne({
                $or: [
                    { customerEmail: { $regex: new RegExp(`^${to.trim()}$`, 'i') } },
                    { notes: { $regex: new RegExp(to.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } }
                ]
            });
        }

        if (updatedLead) {
            const prevStage = updatedLead.stage;
            
            // Map stage from targetStage or emailType
            let newStage = targetStage;
            if (!newStage) {
                if (emailType === 'quotation' || (subject && subject.toLowerCase().includes('quotation'))) {
                    newStage = 'Quotation Sent';
                } else if (emailType === 'meeting' || (subject && subject.toLowerCase().includes('meeting'))) {
                    newStage = 'Potential';
                } else {
                    newStage = 'Contacted';
                }
            }

            updatedLead.stage = newStage;
            updatedLead.customerEmail = updatedLead.customerEmail || to.trim();
            updatedLead.lastRepliedAt = sentDate;
            updatedLead.notes = (updatedLead.notes || '') +
                `\n\n[Sent from CRM (${emailType || 'Direct Email'})] Outgoing email sent to ${to.trim()} on ${sentDate.toLocaleString()}.\nLead stage moved to: ${newStage}.\nSubject: "${subject.trim()}"\nMessage:\n${message}`;
            await updatedLead.save();

            return res.json({
                success: true,
                message: `Email sent to ${to} successfully!`,
                lead: updatedLead,
                prevStage,
                stage: updatedLead.stage
            });
        }

        return res.json({
            success: true,
            message: `Email sent to ${to} successfully!`,
            email: emailRecord
        });

    } catch (error) {
        console.error("Error sending direct email:", error);
        res.status(500).json({ message: "Failed to send email", error: error.message });
    }
};

