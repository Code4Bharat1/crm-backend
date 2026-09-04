import express from 'express';
import { getDashboardKpis } from '../controllers/dashboardController.js';

const router = express.Router();

router.get('/kpis', getDashboardKpis);

export default router;
