import express from 'express';
import {
  createAttendance,
  getAttendance,
  updateAttendance,
  deleteAttendance,
  getAttendanceSummary,
  getAttendanceStats,
  punchIn,
  punchOut,
  getTodayStatus,
  getWeekendPolicy,
  updateWeekendPolicy
} from '../controllers/attendanceController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Static routes
router.route('/summary').get(protect, getAttendanceSummary);
router.route('/stats').get(protect, getAttendanceStats);

// Punch routes
router.route('/punch-in').post(protect, punchIn);
router.route('/punch-out').post(protect, punchOut);
router.route('/today').get(protect, getTodayStatus);

// Dynamic routes
router.route('/')
  .get(protect, getAttendance)
  .post(protect, createAttendance);

// Weekend policy routes (Admin, HR, Manager)
router.route('/weekend-policy')
  .get(protect, getWeekendPolicy)
  .put(protect, updateWeekendPolicy);

router.route('/:id')
  .put(updateAttendance)
  .delete(deleteAttendance);

export default router;
