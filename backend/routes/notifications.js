const express = require('express');
const { Notification } = require('../models');
const { verifyToken } = require('../middleware/authMiddleware');
const router = express.Router();

/**
 * Notification Routes
 * 
 * All routes require authentication (verifyToken middleware)
 * Users can only access their own notifications
 */

// ==========================================
// GET /api/notifications - Get user's notifications
// ==========================================
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;
    const unreadOnly = req.query.unreadOnly === 'true';

    let query = { userId };
    if (unreadOnly) {
      query.isRead = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit);

    const unreadCount = await Notification.getUnreadCount(userId);

    res.json({
      success: true,
      notifications,
      unreadCount,
      count: notifications.length
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      error: 'Failed to fetch notifications',
      message: error.message
    });
  }
});

// ==========================================
// GET /api/notifications/unread-count - Get unread notification count
// ==========================================
router.get('/unread-count', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const unreadCount = await Notification.getUnreadCount(userId);

    res.json({
      success: true,
      unreadCount
    });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({
      error: 'Failed to fetch unread count',
      message: error.message
    });
  }
});

// ==========================================
// POST /api/notifications - Create a new notification
// ==========================================
router.post('/', verifyToken, async (req, res) => {
  try {
    const { type, title, message, metadata } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!type || !title || !message) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'type, title, and message are required'
      });
    }

    // Validate type
    const validTypes = ['success', 'error', 'warning', 'info'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: 'Invalid notification type',
        message: `Type must be one of: ${validTypes.join(', ')}`
      });
    }

    const notification = await Notification.createNotification(
      userId,
      type,
      title,
      message,
      metadata || {}
    );

    res.status(201).json({
      success: true,
      notification
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({
      error: 'Failed to create notification',
      message: error.message
    });
  }
});

// ==========================================
// PATCH /api/notifications/:id/read - Mark notification as read
// ==========================================
router.patch('/:id/read', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify notification belongs to user
    const notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json({
        error: 'Notification not found'
      });
    }

    if (notification.userId.toString() !== userId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only mark your own notifications as read'
      });
    }

    const updatedNotification = await Notification.markAsRead(id);

    res.json({
      success: true,
      notification: updatedNotification
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      error: 'Failed to mark notification as read',
      message: error.message
    });
  }
});

// ==========================================
// PATCH /api/notifications/mark-all-read - Mark all notifications as read
// ==========================================
router.patch('/mark-all-read', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await Notification.markAllAsRead(userId);

    res.json({
      success: true,
      message: 'All notifications marked as read',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      error: 'Failed to mark all notifications as read',
      message: error.message
    });
  }
});

// ==========================================
// DELETE /api/notifications/:id - Delete a notification
// ==========================================
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify notification belongs to user
    const notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json({
        error: 'Notification not found'
      });
    }

    if (notification.userId.toString() !== userId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only delete your own notifications'
      });
    }

    await Notification.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      error: 'Failed to delete notification',
      message: error.message
    });
  }
});

// ==========================================
// DELETE /api/notifications - Delete all notifications for user
// ==========================================
router.delete('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await Notification.deleteMany({ userId });

    res.json({
      success: true,
      message: 'All notifications deleted successfully',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error deleting all notifications:', error);
    res.status(500).json({
      error: 'Failed to delete all notifications',
      message: error.message
    });
  }
});

module.exports = router;

