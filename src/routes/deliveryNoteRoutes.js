import express from 'express';
import {
  getDeliveryNotes, getDeliveryNoteById, createDeliveryNote, updateDeliveryNote,
  deleteDeliveryNote, markDelivered, createInvoiceFromDeliveryNote
} from '../controllers/deliveryNoteController.js';

const router = express.Router();

router.route('/').get(getDeliveryNotes).post(createDeliveryNote);
router.route('/:id').get(getDeliveryNoteById).put(updateDeliveryNote).delete(deleteDeliveryNote);
router.post('/:id/mark-delivered', markDelivered);
router.post('/:id/create-invoice', createInvoiceFromDeliveryNote);

export default router;
