import CompanySettings from '../models/CompanySettings.js';

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
      Object.assign(settings, req.body);
    }
    await settings.save();
    res.json(settings);
  } catch (error) {
    res.status(400).json({ message: 'Error updating company settings', error: error.message });
  }
};
