import express from 'express';
import { getCompanySettings, updateCompanySettings } from '../controllers/companyController.js';
const router = express.Router();
router.route('/').get(getCompanySettings).put(updateCompanySettings);
export default router;
