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
  getTodayStatus
} from '../controllers/attendanceController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Static routes
router.route('/summary').get(getAttendanceSummary);
router.route('/stats').get(getAttendanceStats);

// Punch routes
router.route('/punch-in').post(protect, punchIn);
router.route('/punch-out').post(protect, punchOut);
router.route('/today').get(protect, getTodayStatus);

// Dynamic routes
router.route('/')
  .get(getAttendance)
  .post(createAttendance);

router.route('/:id')
  .put(updateAttendance)
  .delete(deleteAttendance);

export default router;
