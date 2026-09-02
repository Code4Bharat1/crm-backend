import express from 'express';
import {
  getProformas, getProformaById, createProforma, updateProforma, deleteProforma,
  recordAdvance, convertToSalesOrder
} from '../controllers/proformaController.js';
const router = express.Router();
router.route('/').get(getProformas).post(createProforma);
router.route('/:id').get(getProformaById).put(updateProforma).delete(deleteProforma);
router.post('/:id/record-advance', recordAdvance);
router.post('/:id/convert-to-so', convertToSalesOrder);
export default router;
