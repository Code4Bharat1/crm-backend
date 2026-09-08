import express from 'express';
import { getProductSalesReport, getQuotationConversionReport } from '../controllers/reportController.js';

const router = express.Router();

router.get('/product-sales', getProductSalesReport);
router.get('/quotation-conversion', getQuotationConversionReport);

export default router;
