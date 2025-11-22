const mongoose = require('mongoose');

const auditTrailSchema = new mongoose.Schema({
  // User who performed the action
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  userName: {
    type: String,
    required: true,
    trim: true
  },
  userRole: {
    type: String,
    required: true
  },
  // Action details
  action: {
    type: String,
    required: true,
    enum: [
      // Authentication actions
      'LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'PASSWORD_CHANGE',
      // User management actions
      'USER_CREATE', 'USER_UPDATE', 'USER_DELETE', 'USER_ACTIVATE', 'USER_DEACTIVATE',
      // Queue management actions
      'QUEUE_CREATE', 'QUEUE_CALL', 'QUEUE_SERVE', 'QUEUE_COMPLETE', 'QUEUE_SKIP', 'QUEUE_CANCEL', 'QUEUE_REQUEUE_ALL', 'QUEUE_REQUEUE_SELECTED',
      // Service management actions
      'SERVICE_CREATE', 'SERVICE_UPDATE', 'SERVICE_DELETE', 'SERVICE_ACTIVATE', 'SERVICE_DEACTIVATE',
      // Window management actions
      'WINDOW_CREATE', 'WINDOW_UPDATE', 'WINDOW_DELETE', 'WINDOW_OPEN', 'WINDOW_CLOSE',
      // Settings actions
      'SETTINGS_UPDATE', 'SYSTEM_CONFIG_CHANGE',
      // Bulletin actions
      'BULLETIN_CREATE', 'BULLETIN_UPDATE', 'BULLETIN_DELETE', 'BULLETIN_PUBLISH', 'BULLETIN_UNPUBLISH',
      // FAQ actions
      'FAQ_CREATE', 'FAQ_UPDATE', 'FAQ_DELETE', 'FAQ_READ',
      // Rating actions
      'RATING_CREATE', 'RATING_UPDATE', 'RATING_DELETE', 'RATING_READ',
      // System actions
      'SYSTEM_BACKUP', 'SYSTEM_RESTORE', 'DATA_EXPORT', 'DATA_IMPORT',
      // Other actions
      'OTHER'
    ]
  },
  actionDescription: {
    type: String,
    required: true,
    trim: true
  },
  // Target resource information
  resourceType: {
    type: String,
    enum: ['User', 'Queue', 'Service', 'Window', 'Settings', 'Bulletin', 'FAQ', 'Rating', 'System', 'Other'],
    required: true
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: function() {
      return this.resourceType !== 'System' && this.resourceType !== 'Other';
    }
  },
  resourceName: {
    type: String,
    trim: true
  },
  // Request details
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    trim: true
  },
  requestMethod: {
    type: String,
    enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    required: true
  },
  requestUrl: {
    type: String,
    required: true,
    trim: true
  },
  // Response details
  statusCode: {
    type: Number,
    required: true
  },
  success: {
    type: Boolean,
    required: true
  },
  // Data changes (for update operations)
  oldValues: {
    type: mongoose.Schema.Types.Mixed
  },
  newValues: {
    type: mongoose.Schema.Types.Mixed
  },
  // Additional context
  department: {
    type: String,
    enum: ['MIS', 'Registrar', 'Admissions', 'HR']
  },
  sessionId: {
    type: String,
    trim: true
  },
  // Error information (if applicable)
  errorMessage: {
    type: String,
    trim: true
  },
  errorStack: {
    type: String,
    trim: true
  },
  // Severity level
  severity: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    default: 'LOW'
  },
  // Tags for categorization
  tags: [{
    type: String,
    trim: true
  }],
  // Additional metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes for better query performance
auditTrailSchema.index({ userId: 1, createdAt: -1 });
auditTrailSchema.index({ action: 1, createdAt: -1 });
auditTrailSchema.index({ resourceType: 1, resourceId: 1 });
auditTrailSchema.index({ department: 1, createdAt: -1 });
auditTrailSchema.index({ success: 1, createdAt: -1 });
auditTrailSchema.index({ severity: 1, createdAt: -1 });
auditTrailSchema.index({ createdAt: -1 }); // For general time-based queries
auditTrailSchema.index({ ipAddress: 1, createdAt: -1 });

// TTL index for automatic cleanup based on retention policy
auditTrailSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 }); // 1 year default

// Static method to log an action
auditTrailSchema.statics.logAction = async function(actionData) {
  try {
    const auditEntry = new this(actionData);
    await auditEntry.save();
    return auditEntry;
  } catch (error) {
    console.error('Failed to log audit action:', error);
    // Don't throw error to avoid breaking the main operation
    return null;
  }
};

// Static method to get audit trail for a user
auditTrailSchema.statics.getUserAuditTrail = function(userId, limit = 50, skip = 0) {
  return this.find({ userId })
    .populate('userId', 'name email role')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

// Static method to get audit trail for a resource
auditTrailSchema.statics.getResourceAuditTrail = function(resourceType, resourceId, limit = 50, skip = 0) {
  return this.find({ resourceType, resourceId })
    .populate('userId', 'name email role')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

// Static method to get audit trail by action type
auditTrailSchema.statics.getByAction = function(action, limit = 50, skip = 0) {
  return this.find({ action })
    .populate('userId', 'name email role')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

// Static method to get audit trail by department
auditTrailSchema.statics.getByDepartment = function(department, limit = 50, skip = 0) {
  return this.find({ department })
    .populate('userId', 'name email role')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

// Static method to get failed actions
auditTrailSchema.statics.getFailedActions = function(limit = 50, skip = 0) {
  return this.find({ success: false })
    .populate('userId', 'name email role')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

// Static method to get high severity actions
auditTrailSchema.statics.getHighSeverityActions = function(limit = 50, skip = 0) {
  return this.find({ severity: { $in: ['HIGH', 'CRITICAL'] } })
    .populate('userId', 'name email role')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

// Static method to get audit statistics
auditTrailSchema.statics.getStatistics = async function(startDate, endDate) {
  const matchStage = {};
  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = new Date(startDate);
    if (endDate) matchStage.createdAt.$lte = new Date(endDate);
  }

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalActions: { $sum: 1 },
        successfulActions: { $sum: { $cond: ['$success', 1, 0] } },
        failedActions: { $sum: { $cond: ['$success', 0, 1] } },
        actionsByType: {
          $push: {
            action: '$action',
            count: 1
          }
        },
        actionsByUser: {
          $push: {
            userId: '$userId',
            userEmail: '$userEmail',
            count: 1
          }
        }
      }
    }
  ]);

  return stats[0] || {
    totalActions: 0,
    successfulActions: 0,
    failedActions: 0,
    actionsByType: [],
    actionsByUser: []
  };
};

module.exports = mongoose.model('AuditTrail', auditTrailSchema);
