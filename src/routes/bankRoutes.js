import express from 'express';
import {
  getBankTransactions,
  getBankStatus,
  addBankTransaction,
  syncHdfcTransactions,
  reconcileTransaction,
  dismissTransaction,
  deleteBankTransaction,
} from '../controllers/bankController.js';

const router = express.Router();

router.get('/status', getBankStatus);
router.route('/transactions').get(getBankTransactions).post(addBankTransaction);
router.post('/sync', syncHdfcTransactions);
router.post('/transactions/:id/reconcile', reconcileTransaction);
router.post('/transactions/:id/dismiss', dismissTransaction);
router.delete('/transactions/:id', deleteBankTransaction);

export default router;
