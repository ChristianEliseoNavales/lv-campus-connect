const { validationResult } = require('express-validator');
const AuditTrail = require('../models/AuditTrail');

// GET /api/audit - Get audit trail with pagination, filtering, and search
async function getAuditTrail(req, res, next) {
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
}

// POST /api/audit - Create new audit log entry
async function createAuditLog(req, res, next) {
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
}

// GET /api/audit/stats - Get audit trail statistics
async function getAuditStats(req, res, next) {
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
}

// GET /api/audit/user/:userId - Get audit trail for specific user
async function getUserAuditTrail(req, res, next) {
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
}

module.exports = {
  getAuditTrail,
  createAuditLog,
  getAuditStats,
  getUserAuditTrail
};

