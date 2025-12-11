const express = require('express');
const { verifyToken } = require('../middleware/authMiddleware');
const notificationsController = require('../controllers/notificationsController');
const asyncHandler = require('../middleware/asyncHandler');
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
router.get('/', verifyToken, asyncHandler(notificationsController.getNotifications));

// ==========================================
// GET /api/notifications/unread-count - Get unread notification count
// ==========================================
router.get('/unread-count', verifyToken, asyncHandler(notificationsController.getUnreadCount));

// ==========================================
// POST /api/notifications - Create a new notification
// ==========================================
router.post('/', verifyToken, asyncHandler(notificationsController.createNotification));

// ==========================================
// PATCH /api/notifications/:id/read - Mark notification as read
// ==========================================
router.patch('/:id/read', verifyToken, asyncHandler(notificationsController.markNotificationAsRead));

// ==========================================
// PATCH /api/notifications/mark-all-read - Mark all notifications as read
// ==========================================
router.patch('/mark-all-read', verifyToken, asyncHandler(notificationsController.markAllNotificationsAsRead));

// ==========================================
// DELETE /api/notifications/:id - Delete a notification
// ==========================================
router.delete('/:id', verifyToken, asyncHandler(notificationsController.deleteNotification));

// ==========================================
// DELETE /api/notifications - Delete all notifications for user
// ==========================================
router.delete('/', verifyToken, asyncHandler(notificationsController.deleteAllNotifications));

module.exports = router;

