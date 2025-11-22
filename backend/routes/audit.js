const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const { verifyToken, requireSuperAdmin, checkApiAccess } = require('../middleware/authMiddleware');
const auditController = require('../controllers/auditController');

// Note: requireSuperAdmin middleware is now imported from authMiddleware.js

// Validation middleware for audit log creation
const validateAuditLog = [
  body('action')
    .isIn([
      'LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'PASSWORD_CHANGE',
      'USER_CREATE', 'USER_UPDATE', 'USER_DELETE', 'USER_ACTIVATE', 'USER_DEACTIVATE',
      'QUEUE_CREATE', 'QUEUE_CALL', 'QUEUE_SERVE', 'QUEUE_COMPLETE', 'QUEUE_SKIP', 'QUEUE_CANCEL',
      'SERVICE_CREATE', 'SERVICE_UPDATE', 'SERVICE_DELETE', 'SERVICE_ACTIVATE', 'SERVICE_DEACTIVATE',
      'WINDOW_CREATE', 'WINDOW_UPDATE', 'WINDOW_DELETE', 'WINDOW_OPEN', 'WINDOW_CLOSE',
      'SETTINGS_UPDATE', 'SYSTEM_CONFIG_CHANGE',
      'BULLETIN_CREATE', 'BULLETIN_UPDATE', 'BULLETIN_DELETE', 'BULLETIN_PUBLISH', 'BULLETIN_UNPUBLISH',
      'FAQ_CREATE', 'FAQ_UPDATE', 'FAQ_DELETE', 'FAQ_READ',
      'RATING_CREATE', 'RATING_UPDATE', 'RATING_DELETE', 'RATING_READ',
      'SYSTEM_BACKUP', 'SYSTEM_RESTORE', 'DATA_EXPORT', 'DATA_IMPORT',
      'OTHER'
    ])
    .withMessage('Invalid action type'),
  body('actionDescription')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Action description must be between 1 and 500 characters'),
  body('resourceType')
    .isIn(['User', 'Queue', 'Service', 'Window', 'Settings', 'Bulletin', 'FAQ', 'Rating', 'System', 'Other'])
    .withMessage('Invalid resource type'),
  body('department')
    .optional()
    .isIn(['MIS', 'Registrar', 'Admissions', 'HR'])
    .withMessage('Invalid department')
];

// GET /api/audit - Get audit trail with pagination, filtering, and search
router.get('/', verifyToken, checkApiAccess, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().isString().withMessage('Search must be a string'),
  query('department').optional().isIn(['MIS', 'Registrar', 'Admissions', 'HR']).withMessage('Invalid department'),
  query('action').optional().isString().withMessage('Action must be a string'),
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO date'),
  query('userId').optional().isMongoId().withMessage('User ID must be a valid MongoDB ObjectId')
], auditController.getAuditTrail);

// POST /api/audit - Create new audit log entry
router.post('/', validateAuditLog, auditController.createAuditLog);

// GET /api/audit/stats - Get audit trail statistics
router.get('/stats', verifyToken, checkApiAccess, [
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO date')
], auditController.getAuditStats);

// GET /api/audit/user/:userId - Get audit trail for specific user
router.get('/user/:userId', verifyToken, checkApiAccess, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], auditController.getUserAuditTrail);

module.exports = router;
