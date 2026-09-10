import mongoose from 'mongoose';
import Notification from '../models/Notification.js';

// GET /api/notifications
export const getNotifications = async (req, res) => {
  try {
    const { recipient, recipientEmail, role, unread, limit = 50, type } = req.query;
    const query = {};

    const user = req.user;
    const roleStr = (user?.role || '').toLowerCase().trim();
    const isAdmin = roleStr === 'admin' || roleStr === 'director' || roleStr === 'admin manager';

    // Non-admin employees strictly see only their own assignments
    if (user && !isAdmin) {
      const userConditions = [
        { recipient: { $regex: `^${user.name.trim()}$`, $options: 'i' } }
      ];
      if (user.email) {
        userConditions.push({ recipientEmail: user.email.toLowerCase().trim() });
      }
      userConditions.push({ recipient: 'all' });
      query.$or = userConditions;
    } else {
      if (recipient && recipientEmail) {
        query.$or = [
          { recipient: { $regex: recipient.trim(), $options: 'i' } },
          { recipientEmail: recipientEmail.toLowerCase().trim() },
          { recipient: 'all' }
        ];
      } else if (recipient) {
        query.$or = [
          { recipient: { $regex: recipient.trim(), $options: 'i' } },
          { recipient: 'all' }
        ];
      } else if (recipientEmail) {
        query.$or = [
          { recipientEmail: recipientEmail.toLowerCase().trim() },
          { recipient: 'all' }
        ];
      }
    }

    if (type) {
      query.type = type;
    }

    if (role) {
      query.recipientRole = { $regex: role, $options: 'i' };
    }

    if (unread === 'true') {
      query.read = false;
    }

    const notifications = await Notification.find(query)
      .sort({ at: -1 })
      .limit(Number(limit));

    const unreadCount = await Notification.countDocuments({ ...query, read: false });

    res.json({
      success: true,
      notifications,
      unreadCount
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications', error: error.message });
  }
};

// PATCH /api/notifications/:id/read
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    let query = {};
    if (mongoose.isValidObjectId(id)) {
      query = { _id: id };
    } else {
      query = { $or: [{ id: id }, { _id: id }] };
    }

    const notification = await Notification.findOneAndUpdate(
      query,
      { $set: { read: true } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.json({ success: true, notification });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ success: false, message: 'Failed to update notification', error: error.message });
  }
};

// PATCH /api/notifications/mark-all-read
export const markAllAsRead = async (req, res) => {
  try {
    const { recipient } = req.body || {};
    const user = req.user;
    const roleStr = (user?.role || '').toLowerCase().trim();
    const isAdmin = roleStr === 'admin' || roleStr === 'director' || roleStr === 'admin manager';
    const query = { read: false };

    if (user && !isAdmin) {
      query.$or = [
        { recipient: { $regex: `^${user.name.trim()}$`, $options: 'i' } },
        ...(user.email ? [{ recipientEmail: user.email.toLowerCase().trim() }] : []),
        { recipient: 'all' }
      ];
    } else if (recipient) {
      query.$or = [
        { recipient: { $regex: `^${recipient.trim()}$`, $options: 'i' } },
        { recipient: 'all' }
      ];
    }

    await Notification.updateMany(query, { $set: { read: true } });
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ success: false, message: 'Failed to update notifications', error: error.message });
  }
};

// GET /api/notifications/unread-count
export const getUnreadCount = async (req, res) => {
  try {
    const { recipient } = req.query;
    const user = req.user;
    const roleStr = (user?.role || '').toLowerCase().trim();
    const isAdmin = roleStr === 'admin' || roleStr === 'director' || roleStr === 'admin manager';
    const query = { read: false };

    if (user && !isAdmin) {
      query.$or = [
        { recipient: { $regex: `^${user.name.trim()}$`, $options: 'i' } },
        ...(user.email ? [{ recipientEmail: user.email.toLowerCase().trim() }] : []),
        { recipient: 'all' }
      ];
    } else if (recipient) {
      query.$or = [
        { recipient: { $regex: recipient, $options: 'i' } },
        { recipient: 'all' }
      ];
    }
    const count = await Notification.countDocuments(query);
    res.json({ success: true, unreadCount: count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ success: false, message: 'Failed to get unread count', error: error.message });
  }
};

// POST /api/notifications
export const createNotification = async (req, res) => {
  try {
    const notification = new Notification(req.body);
    await notification.save();
    res.status(201).json({ success: true, notification });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(400).json({ success: false, message: 'Failed to create notification', error: error.message });
  }
};
