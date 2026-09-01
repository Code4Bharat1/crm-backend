import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Email from '../models/Email.js';

const fetchLatestEmail = async () => {
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
        
        const emailData = {
            uid: lastUid.toString(),
            mailbox: process.env.EMAIL_ID,
            from: mail.from?.text || 'Unknown',
            subject: mail.subject || 'No Subject',
            text: mail.text || 'No Body',
            date: mail.date || new Date()
        };

        // Save or update in MongoDB to ensure it persists for the Email page
        await Email.findOneAndUpdate(
            { uid: lastUid.toString() },
            { $set: emailData },
            { upsert: true, returnDocument: 'after' }
        );
        
        return emailData;

    } catch (error) {
        console.error("Error fetching email:", error);
        throw error;
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

        const result = await model.generateContent(prompt);
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

export const fetchEmail = async (req, res) => {
    try {
        const email = await fetchLatestEmail();
        if (!email) {
            return res.status(404).json({ message: "No new unread emails found." });
        }
        res.json(email);
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
