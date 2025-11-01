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

      // Determine office based on user role
      const officeMap = {
        'super_admin': 'MIS',
        'registrar_admin': 'Registrar',
        'admissions_admin': 'Admissions',
        'senior_management_admin': 'Senior Management'
      };
      const office = officeMap[userRole] || 'Unknown';
      
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
        office,
        errorMessage,
        severity,
        tags,
        metadata
      };
      
      // Remove null/undefined values to keep the document clean
      // BUT preserve required fields (userId, userEmail, userName, userRole, action, actionDescription, resourceType, ipAddress, requestMethod, requestUrl, statusCode, success)
      const requiredFields = ['userId', 'userEmail', 'userName', 'userRole', 'action', 'actionDescription', 'resourceType', 'ipAddress', 'requestMethod', 'requestUrl', 'statusCode', 'success'];
      Object.keys(auditData).forEach(key => {
        if ((auditData[key] === null || auditData[key] === undefined) && !requiredFields.includes(key)) {
          delete auditData[key];
        }
      });
      
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
   */
  static async logAuth({ user, action, req, success, errorMessage = null }) {
    return this.logAction({
      user,
      action,
      actionDescription: `User ${action.toLowerCase()}`,
      resourceType: 'System',
      req,
      statusCode: success ? 200 : 401,
      success,
      errorMessage,
      severity: success ? 'LOW' : 'MEDIUM',
      tags: ['authentication']
    });
  }
  
  /**
   * Log CRUD operations
   */
  static async logCRUD({ user, action, resourceType, resourceId, resourceName, req, success, oldValues, newValues, errorMessage = null }) {
    const actionMap = {
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
  static async logQueue({ user, action, queueId, queueNumber, department, req, success, metadata = {}, errorMessage = null }) {
    return this.logAction({
      user,
      action,
      actionDescription: `Queue ${action.toLowerCase()} - #${queueNumber}`,
      resourceType: 'Queue',
      resourceId: queueId,
      resourceName: `Queue #${queueNumber} (${department})`,
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
