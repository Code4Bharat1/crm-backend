import express from 'express';
import {
  getInvoices, getInvoiceById, createInvoice, updateInvoice, deleteInvoice,
  recordPayment, checkOverdue, getPaymentsLedger
} from '../controllers/salesInvoiceController.js';
const router = express.Router();
router.route('/').get(getInvoices).post(createInvoice);
router.get('/check-overdue', checkOverdue);
// Must be before /:id to avoid being swallowed as an invoice id
router.get('/payments-ledger', getPaymentsLedger);
router.route('/:id').get(getInvoiceById).put(updateInvoice).delete(deleteInvoice);
router.post('/:id/record-payment', recordPayment);
export default router;
