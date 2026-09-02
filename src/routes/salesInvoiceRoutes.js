import express from 'express';
import {
  getInvoices, getInvoiceById, createInvoice, updateInvoice, deleteInvoice,
  recordPayment, checkOverdue
} from '../controllers/salesInvoiceController.js';
const router = express.Router();
router.route('/').get(getInvoices).post(createInvoice);
router.get('/check-overdue', checkOverdue);
router.route('/:id').get(getInvoiceById).put(updateInvoice).delete(deleteInvoice);
router.post('/:id/record-payment', recordPayment);
export default router;
