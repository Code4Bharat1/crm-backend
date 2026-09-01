import express from 'express';
import { getCustomers, createCustomer, getCustomerById } from '../controllers/customerController.js';
// import { protect } from '../middleware/authMiddleware.js'; // Un-comment to protect routes
const router = express.Router();

router.route('/').get(getCustomers).post(createCustomer);
router.route('/:id').get(getCustomerById);

export default router;
