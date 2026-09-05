import express from 'express';
import {
  getCustomers, createCustomer, getCustomerById, updateCustomer, deleteCustomer, getCustomerLedger
} from '../controllers/customerController.js';

const router = express.Router();

router.route('/')
  .get(getCustomers)
  .post(createCustomer);

// Must be before /:id to avoid being swallowed as a customer id
router.get('/ledger', getCustomerLedger);

router.route('/:id')
  .get(getCustomerById)
  .put(updateCustomer)
  .delete(deleteCustomer);

export default router;
