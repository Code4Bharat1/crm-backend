import express from 'express';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  createNotification
} from '../controllers/notificationController.js';
import { optionalProtect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .get(optionalProtect, getNotifications)
  .post(optionalProtect, createNotification);

router.get('/unread-count', optionalProtect, getUnreadCount);
router.patch('/mark-all-read', optionalProtect, markAllAsRead);
router.patch('/:id/read', optionalProtect, markAsRead);

export default router;
