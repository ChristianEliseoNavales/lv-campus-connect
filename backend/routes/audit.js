const express = require('express');
const router = express.Router();
const AuditTrail = require('../models/AuditTrail');
const { body, query, validationResult } = require('express-validator');
const { verifyToken, requireSuperAdmin, checkApiAccess } = require('../middleware/authMiddleware');

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
      'SYSTEM_BACKUP', 'SYSTEM_RESTORE', 'DATA_EXPORT', 'DATA_IMPORT',
      'OTHER'
    ])
    .withMessage('Invalid action type'),
  body('actionDescription')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Action description must be between 1 and 500 characters'),
  body('resourceType')
    .isIn(['User', 'Queue', 'Service', 'Window', 'Settings', 'Bulletin', 'Rating', 'System', 'Other'])
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
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const {
      page = 1,
      limit = 20,
      search,
      department,
      action,
      startDate,
      endDate,
      userId
    } = req.query;

    // Build query object
    const query = {};

    // Department filter
    if (department) {
      query.department = department;
    }

    // Action filter
    if (action) {
      query.action = action;
    }

    // User filter
    if (userId) {
      query.userId = userId;
    }

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Search filter (search in actionDescription, userName, userEmail, resourceName)
    if (search) {
      query.$or = [
        { actionDescription: { $regex: search, $options: 'i' } },
        { userName: { $regex: search, $options: 'i' } },
        { userEmail: { $regex: search, $options: 'i' } },
        { resourceName: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get total count for pagination
    const totalCount = await AuditTrail.countDocuments(query);

    // Fetch audit logs with pagination
    const auditLogs = await AuditTrail.find(query)
      .populate('userId', 'name email role department')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.json({
      success: true,
      data: auditLogs,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        limit: parseInt(limit),
        hasNextPage,
        hasPrevPage
      }
    });

  } catch (error) {
    console.error('Error fetching audit trail:', error);
    res.status(500).json({
      error: 'Failed to fetch audit trail',
      message: error.message
    });
  }
});

// POST /api/audit - Create new audit log entry
router.post('/', validateAuditLog, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const auditData = {
      ...req.body,
      // Extract user info from request (set by auth middleware)
      userId: req.user?._id || req.body.userId,
      userEmail: req.user?.email || req.body.userEmail,
      userName: req.user?.name || req.body.userName,
      userRole: req.user?.role || req.body.userRole,
      // Extract request info
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      requestMethod: req.method,
      requestUrl: req.originalUrl,
      // Default success status
      statusCode: 200,
      success: true
    };

    // Use the static method to safely log the action
    const auditEntry = await AuditTrail.logAction(auditData);

    if (auditEntry) {
      res.status(201).json({
        success: true,
        message: 'Audit log created successfully',
        data: auditEntry
      });
    } else {
      res.status(500).json({
        error: 'Failed to create audit log'
      });
    }

  } catch (error) {
    console.error('Error creating audit log:', error);
    res.status(500).json({
      error: 'Failed to create audit log',
      message: error.message
    });
  }
});

// GET /api/audit/stats - Get audit trail statistics
router.get('/stats', verifyToken, checkApiAccess, [
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO date')
], async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const stats = await AuditTrail.getStatistics(startDate, endDate);

    res.json({
      success: true,
      data: stats[0] || {
        totalActions: 0,
        successfulActions: 0,
        failedActions: 0,
        actionsByType: [],
        actionsByUser: []
      }
    });

  } catch (error) {
    console.error('Error fetching audit statistics:', error);
    res.status(500).json({
      error: 'Failed to fetch audit statistics',
      message: error.message
    });
  }
});

// GET /api/audit/user/:userId - Get audit trail for specific user
router.get('/user/:userId', verifyToken, checkApiAccess, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const auditLogs = await AuditTrail.getUserAuditTrail(userId, parseInt(limit), skip);
    const totalCount = await AuditTrail.countDocuments({ userId });

    const totalPages = Math.ceil(totalCount / parseInt(limit));

    res.json({
      success: true,
      data: auditLogs,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        limit: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });

  } catch (error) {
    console.error('Error fetching user audit trail:', error);
    res.status(500).json({
      error: 'Failed to fetch user audit trail',
      message: error.message
    });
  }
});

module.exports = router;
