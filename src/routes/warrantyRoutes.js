import express from 'express';
import {
  getWarranties,
  getWarranty,
  createWarranty,
  updateWarranty,
  deleteWarranty,
  checkSerialWarranty,
  renewWarrantyAMC
} from '../controllers/warrantyController.js';

const router = express.Router();

router.get('/check/:serialNo', checkSerialWarranty);

router.route('/')
  .get(getWarranties)
  .post(createWarranty);

router.route('/:id')
  .get(getWarranty)
  .put(updateWarranty)
  .delete(deleteWarranty);

router.post('/:id/renew-amc', renewWarrantyAMC);

export default router;
