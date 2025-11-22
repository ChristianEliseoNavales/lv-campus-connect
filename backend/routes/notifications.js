const express = require('express');
const { verifyToken } = require('../middleware/authMiddleware');
const notificationsController = require('../controllers/notificationsController');
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
router.get('/', verifyToken, notificationsController.getNotifications);

// ==========================================
// GET /api/notifications/unread-count - Get unread notification count
// ==========================================
router.get('/unread-count', verifyToken, notificationsController.getUnreadCount);

// ==========================================
// POST /api/notifications - Create a new notification
// ==========================================
router.post('/', verifyToken, notificationsController.createNotification);

// ==========================================
// PATCH /api/notifications/:id/read - Mark notification as read
// ==========================================
router.patch('/:id/read', verifyToken, notificationsController.markNotificationAsRead);

// ==========================================
// PATCH /api/notifications/mark-all-read - Mark all notifications as read
// ==========================================
router.patch('/mark-all-read', verifyToken, notificationsController.markAllNotificationsAsRead);

// ==========================================
// DELETE /api/notifications/:id - Delete a notification
// ==========================================
router.delete('/:id', verifyToken, notificationsController.deleteNotification);

// ==========================================
// DELETE /api/notifications - Delete all notifications for user
// ==========================================
router.delete('/', verifyToken, notificationsController.deleteAllNotifications);

module.exports = router;

