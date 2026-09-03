import express from 'express';
import { getCompanySettings, updateCompanySettings, uploadCompanyMedia } from '../controllers/companyController.js';

const router = express.Router();

router.route('/')
  .get(getCompanySettings)
  .put(updateCompanySettings);

router.post('/upload', uploadCompanyMedia);

export default router;
