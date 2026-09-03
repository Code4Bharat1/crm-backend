import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import CompanySettings from '../models/CompanySettings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, '../../uploads/company');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// GET /api/company — fetch settings (create defaults if none exist)
export const getCompanySettings = async (req, res) => {
  try {
    let settings = await CompanySettings.findOne();
    if (!settings) {
      settings = await CompanySettings.create({});
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching company settings', error: error.message });
  }
};

// PUT /api/company — update settings
export const updateCompanySettings = async (req, res) => {
  try {
    let settings = await CompanySettings.findOne();
    if (!settings) {
      settings = new CompanySettings(req.body);
    } else {
      const updates = { ...req.body };
      if (updates.address) {
        settings.address = { ...(settings.address ? settings.address.toObject() : {}), ...updates.address };
        delete updates.address;
      }
      if (updates.bankDetails) {
        settings.bankDetails = { ...(settings.bankDetails ? settings.bankDetails.toObject() : {}), ...updates.bankDetails };
        delete updates.bankDetails;
      }
      Object.assign(settings, updates);
    }
    await settings.save();
    res.json(settings);
  } catch (error) {
    res.status(400).json({ message: 'Error updating company settings', error: error.message });
  }
};

// POST /api/company/upload — upload media (logo, signature, stamp)
export const uploadCompanyMedia = async (req, res) => {
  try {
    const { image, type = 'media' } = req.body;

    if (!image) {
      return res.status(400).json({ message: 'No image data provided' });
    }

    // Match base64 data uri: data:image/png;base64,....
    const matches = image.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ message: 'Invalid image format. Must be base64 data URI.' });
    }

    let ext = matches[1].toLowerCase();
    if (ext === 'svg+xml') ext = 'svg';
    if (ext === 'jpeg') ext = 'jpg';

    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // Limit to 5MB
    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ message: 'File size exceeds 5MB limit' });
    }

    const safeType = ['logo', 'signature', 'stamp'].includes(type) ? type : 'media';
    const filename = `${safeType}-${Date.now()}.${ext}`;
    const filePath = path.join(uploadDir, filename);

    await fs.promises.writeFile(filePath, buffer);

    const relativeUrl = `/uploads/company/${filename}`;
    res.json({
      success: true,
      url: relativeUrl,
      filename,
      type: safeType,
    });
  } catch (error) {
    console.error('Error uploading company media:', error);
    res.status(500).json({ message: 'Failed to upload media', error: error.message });
  }
};
