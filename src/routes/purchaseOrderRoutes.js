import express from 'express';
import {
  getPurchaseOrders, getPurchaseOrderById, createPurchaseOrder, updatePurchaseOrder,
  deletePurchaseOrder, markReceived
} from '../controllers/purchaseOrderController.js';
const router = express.Router();
router.route('/').get(getPurchaseOrders).post(createPurchaseOrder);
router.route('/:id').get(getPurchaseOrderById).put(updatePurchaseOrder).delete(deletePurchaseOrder);
router.post('/:id/mark-received', markReceived);
export default router;
