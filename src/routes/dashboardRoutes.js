import express from 'express';
import { getDashboardKpis, getDashboardOverview } from '../controllers/dashboardController.js';

const router = express.Router();

router.get('/kpis', getDashboardKpis);
router.get('/overview', getDashboardOverview);

export default router;
