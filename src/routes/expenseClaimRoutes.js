import express from 'express';
import { getExpenseClaims, exportExpenseClaims } from '../controllers/expenseClaimController.js';

const router = express.Router();

router.route('/export').get(exportExpenseClaims);
router.route('/').get(getExpenseClaims);

export default router;
