import express from 'express';
import {
  createEmployee,
  getEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
  getEmployeeStats,
  exportEmployees,
} from '../controllers/employeeController.js';

const router = express.Router();

// Static routes must come before /:id
router.route('/stats').get(getEmployeeStats);
router.route('/export').get(exportEmployees);

// Dynamic/CRUD routes
router.route('/').get(getEmployees).post(createEmployee);
router.route('/:id')
  .get(getEmployeeById)
  .put(updateEmployee)
  .delete(deleteEmployee);

export default router;
