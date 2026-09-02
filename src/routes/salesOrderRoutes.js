import express from 'express';
import {
  getSalesOrders, getSalesOrderById, createSalesOrder, updateSalesOrder, deleteSalesOrder,
  createDeliveryNoteFromSO, createInvoiceFromSO, createPurchaseOrderFromSO
} from '../controllers/salesOrderController.js';
const router = express.Router();
router.route('/').get(getSalesOrders).post(createSalesOrder);
router.route('/:id').get(getSalesOrderById).put(updateSalesOrder).delete(deleteSalesOrder);
router.post('/:id/create-delivery-note', createDeliveryNoteFromSO);
router.post('/:id/create-invoice', createInvoiceFromSO);
router.post('/:id/create-purchase-order', createPurchaseOrderFromSO);
export default router;
