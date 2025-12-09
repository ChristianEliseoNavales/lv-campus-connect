const mongoose = require('mongoose');
const { AuditTrail } = require('../models');

/**
 * Audit Service for logging all admin actions
 * Provides centralized audit logging functionality
 */
class AuditService {

  /**
   * Log an audit trail entry
   * @param {Object} params - Audit parameters
   * @param {Object} params.user - User object from authentication
   * @param {string} params.action - Action type (CREATE, UPDATE, DELETE, etc.)
   * @param {string} params.actionDescription - Human-readable description
   * @param {string} params.resourceType - Type of resource (User, Queue, Service, etc.)
   * @param {string} params.resourceId - ID of the affected resource
   * @param {string} params.resourceName - Name/identifier of the resource
   * @param {Object} params.req - Express request object
   * @param {number} params.statusCode - HTTP status code
   * @param {boolean} params.success - Whether the operation succeeded
   * @param {Object} params.oldValues - Previous values (for updates)
   * @param {Object} params.newValues - New values (for creates/updates)
   * @param {string} params.errorMessage - Error message if failed
   * @param {string} params.severity - Severity level (LOW, MEDIUM, HIGH, CRITICAL)
   * @param {Array} params.tags - Additional tags for categorization
   * @param {Object} params.metadata - Additional metadata
   */
  static async logAction({
    user,
    action,
    actionDescription,
    resourceType,
    resourceId = null,
    resourceName = null,
    req,
    statusCode,
    success,
    oldValues = null,
    newValues = null,
    errorMessage = null,
    severity = 'LOW',
    tags = [],
    metadata = {}
  }) {
    try {
      // Skip audit logging in development mode with DEV_BYPASS_AUTH
      if (process.env.DEV_BYPASS_AUTH === 'true') {
        console.log('🔓 DEV_BYPASS_AUTH: Skipping audit logging in development mode');
        return null;
      }

      // Extract user information
      const userId = user?._id || user?.id;
      const userEmail = user?.email || 'unknown@system.local';
      const userName = user?.name || 'Unknown User';
      const userRole = user?.role || 'unknown';

      // Extract request information
      const ipAddress = req?.ip || req?.connection?.remoteAddress || 'unknown';
      const userAgent = req?.get('User-Agent') || 'unknown';
      const requestMethod = req?.method || 'unknown';
      const requestUrl = req?.originalUrl || req?.url || 'unknown';

      // Determine department/office based on user role (supports both old and new role formats)
      let department = user?.office;

      // If office is not set, try to extract from combined role format
      if (!department && userRole) {
        // New format: "MIS Super Admin", "Registrar Admin", etc.
        if (userRole.includes('MIS')) department = 'MIS';
        else if (userRole.includes('Registrar')) department = 'Registrar';
        else if (userRole.includes('Admissions')) department = 'Admissions';
        else if (userRole.includes('Senior Management')) department = 'HR';
        // Old format fallback
        else if (userRole === 'super_admin') department = 'MIS';
        else if (userRole === 'registrar_admin') department = 'Registrar';
        else if (userRole === 'admissions_admin') department = 'Admissions';
        else if (userRole === 'senior_management_admin') department = 'HR';
      }

      // If still no department, set to null (will be excluded from audit data)
      // This prevents "Unknown" from being saved which is not in the enum
      if (!department) {
        department = null;
      }

      // Create audit trail entry
      const auditData = {
        userId,
        userEmail,
        userName,
        userRole,
        action,
        actionDescription,
        resourceType,
        resourceId,
        resourceName,
        ipAddress,
        userAgent,
        requestMethod,
        requestUrl,
        statusCode,
        success,
        oldValues,
        newValues,
        department,
        errorMessage,
        severity,
        tags,
        metadata
      };

      // Remove null/undefined values to keep the document clean
      // BUT preserve required fields (userId is conditionally required - optional for LOGIN_FAILED)
      // For LOGIN_FAILED actions, userId can be undefined/null
      const conditionallyRequiredFields = action === 'LOGIN_FAILED'
        ? ['userEmail', 'userName', 'userRole', 'action', 'actionDescription', 'resourceType', 'ipAddress', 'requestMethod', 'requestUrl', 'statusCode', 'success']
        : ['userId', 'userEmail', 'userName', 'userRole', 'action', 'actionDescription', 'resourceType', 'ipAddress', 'requestMethod', 'requestUrl', 'statusCode', 'success'];

      Object.keys(auditData).forEach(key => {
        if ((auditData[key] === null || auditData[key] === undefined) && !conditionallyRequiredFields.includes(key)) {
          delete auditData[key];
        }
      });

      // For LOGIN_FAILED actions without userId, explicitly set it to null/undefined
      if (action === 'LOGIN_FAILED' && !userId) {
        delete auditData.userId;
      }

      // Check if database is connected before attempting to save
      if (mongoose.connection.readyState !== 1) {
        console.warn('⚠️  Database not connected, skipping audit log save');
        return null;
      }

      const auditEntry = new AuditTrail(auditData);
      await auditEntry.save();

      console.log(`📝 Audit logged: ${action} by ${userName} (${userRole}) on ${resourceType}`);

      return auditEntry;

    } catch (error) {
      // Don't let audit logging failures break the main operation
      console.error('❌ Audit logging failed:', error);
      return null;
    }
  }

  /**
   * Log authentication events
   * Accepts either a user object OR userId/email separately
   */
  static async logAuth({ user, userId, email, action, req, success, errorMessage = null, metadata = {} }) {
    // Handle both user object and separate userId/email parameters
    const userObj = user || {
      _id: userId,
      id: userId,
      email: email || 'unknown@system.local',
      name: email || 'Unknown User',
      role: metadata?.role || 'unknown'
    };

    return this.logAction({
      user: userObj,
      action,
      actionDescription: `User ${action.toLowerCase()}`,
      resourceType: 'System',
      req,
      statusCode: success ? 200 : 401,
      success,
      errorMessage,
      severity: success ? 'LOW' : 'MEDIUM',
      tags: ['authentication'],
      metadata
    });
  }

  /**
   * Log CRUD operations
   */
  static async logCRUD({ user, action, resourceType, resourceId, resourceName, req, success, oldValues, newValues, errorMessage = null }) {
    // For 'Other' resourceType, use 'OTHER' action directly (not OTHER_CREATE, etc.)
    // since the AuditTrail enum only has 'OTHER' as a valid value
    const isOtherResourceType = resourceType === 'Other';

    const actionMap = isOtherResourceType
      ? {
          'CREATE': 'OTHER',
          'READ': 'OTHER',
          'UPDATE': 'OTHER',
          'DELETE': 'OTHER'
        }
      : {
          'CREATE': `${resourceType.toUpperCase()}_CREATE`,
          'READ': `${resourceType.toUpperCase()}_READ`,
          'UPDATE': `${resourceType.toUpperCase()}_UPDATE`,
          'DELETE': `${resourceType.toUpperCase()}_DELETE`
        };

    const actionDescriptions = {
      'CREATE': `Created ${resourceType}`,
      'READ': `Viewed ${resourceType}`,
      'UPDATE': `Updated ${resourceType}`,
      'DELETE': `Deleted ${resourceType}`
    };

    return this.logAction({
      user,
      action: actionMap[action] || action,
      actionDescription: actionDescriptions[action] || `${action} ${resourceType}`,
      resourceType,
      resourceId,
      resourceName,
      req,
      statusCode: success ? (action === 'CREATE' ? 201 : 200) : 500,
      success,
      oldValues,
      newValues,
      errorMessage,
      severity: action === 'DELETE' ? 'HIGH' : 'LOW',
      tags: ['crud']
    });
  }

  /**
   * Log queue operations
   */
  static async logQueue({ user, action, queueId, queueNumber, department, req, success, metadata = {}, errorMessage = null, resourceType = 'Queue' }) {
    // For bulk operations (requeue-all, requeue-selected), use Window as resourceType if queueId is actually a windowId
    const isBulkOperation = action === 'QUEUE_REQUEUE_ALL' || action === 'QUEUE_REQUEUE_SELECTED';

    // If queueId is null but we have windowId in metadata, use Window as resourceType
    const hasWindowId = metadata.windowId || metadata.window;
    const shouldUseWindow = (isBulkOperation && queueId && !queueNumber) || (!queueId && hasWindowId);

    // If no queueId and no windowId, use System resourceType to avoid validation error
    const finalResourceType = shouldUseWindow ? 'Window' : (!queueId && !hasWindowId ? 'System' : resourceType);
    const finalResourceId = shouldUseWindow ? (metadata.windowId || metadata.window) : queueId;

    const resourceName = queueNumber
      ? `Queue #${queueNumber} (${department})`
      : isBulkOperation || shouldUseWindow
        ? `Window ${metadata.windowName || finalResourceId || 'Unknown'} (${department})`
        : `Queue Operation (${department})`;

    return this.logAction({
      user,
      action,
      actionDescription: queueNumber
        ? `Queue ${action.toLowerCase()} - #${queueNumber}`
        : `Queue ${action.toLowerCase()} - ${metadata.requeuedCount || 'bulk'} queue(s)`,
      resourceType: finalResourceType,
      resourceId: finalResourceId,
      resourceName,
      req,
      statusCode: success ? 200 : 500,
      success,
      errorMessage,
      severity: 'MEDIUM',
      tags: ['queue', department],
      metadata: { queueNumber, department, ...metadata }
    });
  }

  /**
   * Log settings changes
   */
  static async logSettings({ user, action, settingName, req, success, oldValues, newValues, errorMessage = null }) {
    // Generate a consistent resourceId for settings based on setting name
    const settingId = new mongoose.Types.ObjectId();

    return this.logAction({
      user,
      action: 'SETTINGS_UPDATE',
      actionDescription: `Updated ${settingName} settings`,
      resourceType: 'Settings',
      resourceId: settingId,
      resourceName: settingName,
      req,
      statusCode: success ? 200 : 500,
      success,
      oldValues,
      newValues,
      errorMessage,
      severity: 'MEDIUM',
      tags: ['settings', 'configuration']
    });
  }
}

module.exports = AuditService;
