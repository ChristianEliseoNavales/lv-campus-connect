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
      searchTerm,
      filterBy,
      department,
      action,
      startDate,
      endDate,
      userId
    } = req.query;

    // Validate and parse pagination params
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Build query object
    const query = {};

    // Department filter
    if (department) {
      query.department = department;
    }

    // Action filter (direct action match)
    if (action) {
      query.action = action;
    }

    // FilterBy support (for frontend filterBy parameter)
    if (filterBy && filterBy !== 'all') {
      switch (filterBy) {
        case 'user_actions':
          query.action = { $regex: '^USER_', $options: 'i' };
          break;
        case 'queue_actions':
          query.action = { $regex: '^QUEUE_', $options: 'i' };
          break;
        case 'settings_actions':
          query.$or = [
            { action: { $regex: 'SETTINGS', $options: 'i' } },
            { action: { $regex: 'CONFIG', $options: 'i' } }
          ];
          break;
        case 'failed_actions':
          query.success = false;
          break;
      }
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

    // Search filter (support both 'search' and 'searchTerm' for compatibility)
    const searchValue = search || searchTerm;
    if (searchValue && searchValue.trim()) {
      const searchRegex = { $regex: searchValue.trim(), $options: 'i' };
      // If filterBy already has $or, merge it; otherwise create new $or
      if (query.$or) {
        query.$and = [
          { $or: query.$or },
          {
            $or: [
              { actionDescription: searchRegex },
              { userName: searchRegex },
              { userEmail: searchRegex },
              { resourceName: searchRegex },
              { action: searchRegex }
            ]
          }
        ];
        delete query.$or;
      } else {
        query.$or = [
          { actionDescription: searchRegex },
          { userName: searchRegex },
          { userEmail: searchRegex },
          { resourceName: searchRegex },
          { action: searchRegex }
        ];
      }
    }

    // Get total count for pagination
    const totalCount = await AuditTrail.countDocuments(query);

    // Fetch audit logs with pagination
    const auditLogs = await AuditTrail.find(query)
      .populate('userId', 'name email role department')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limitNum);

    res.json({
      success: true,
      data: auditLogs,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        limit: limitNum
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


