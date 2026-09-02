import express from 'express';
import {
  getQuotations, getQuotationById, createQuotation, updateQuotation, deleteQuotation,
  convertToProforma, convertToSalesOrder
} from '../controllers/quotationController.js';
const router = express.Router();
router.route('/').get(getQuotations).post(createQuotation);
router.route('/:id').get(getQuotationById).put(updateQuotation).delete(deleteQuotation);
router.post('/:id/convert-to-proforma', convertToProforma);
router.post('/:id/convert-to-so', convertToSalesOrder);
export default router;
