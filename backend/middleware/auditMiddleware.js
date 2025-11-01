const AuditService = require('../services/auditService');

/**
 * Audit Middleware for automatic audit logging
 * Can be used as Express middleware to automatically log requests
 */

/**
 * Generic audit middleware factory
 * @param {Object} options - Audit options
 * @param {string} options.action - Action type
 * @param {string} options.resourceType - Resource type
 * @param {Function} options.getResourceInfo - Function to extract resource info from req/res
 * @param {string} options.severity - Severity level
 * @param {Array} options.tags - Additional tags
 */
function createAuditMiddleware(options = {}) {
  return async (req, res, next) => {
    // Store original res.json to intercept response
    const originalJson = res.json;
    
    res.json = function(data) {
      // Call original json method
      const result = originalJson.call(this, data);
      
      // Log audit trail asynchronously (don't block response)
      setImmediate(async () => {
        try {
          const success = res.statusCode >= 200 && res.statusCode < 400;
          
          // Extract resource information
          let resourceInfo = {};
          if (options.getResourceInfo) {
            resourceInfo = options.getResourceInfo(req, res, data);
          }
          
          await AuditService.logAction({
            user: req.user,
            action: options.action || 'UNKNOWN',
            actionDescription: options.actionDescription || `${options.action} ${options.resourceType}`,
            resourceType: options.resourceType || 'Unknown',
            resourceId: resourceInfo.resourceId || req.params.id,
            resourceName: resourceInfo.resourceName,
            req,
            statusCode: res.statusCode,
            success,
            oldValues: resourceInfo.oldValues,
            newValues: resourceInfo.newValues,
            errorMessage: success ? null : (data?.error || data?.message),
            severity: options.severity || 'LOW',
            tags: options.tags || [],
            metadata: resourceInfo.metadata || {}
          });
        } catch (error) {
          console.error('❌ Audit middleware error:', error);
        }
      });
      
      return result;
    };
    
    next();
  };
}

/**
 * Audit middleware for CRUD operations
 */
const auditCRUD = {
  create: (resourceType, getResourceInfo) => createAuditMiddleware({
    action: 'CREATE',
    resourceType,
    getResourceInfo,
    severity: 'LOW',
    tags: ['crud', 'create']
  }),
  
  read: (resourceType, getResourceInfo) => createAuditMiddleware({
    action: 'READ',
    resourceType,
    getResourceInfo,
    severity: 'LOW',
    tags: ['crud', 'read']
  }),
  
  update: (resourceType, getResourceInfo) => createAuditMiddleware({
    action: 'UPDATE',
    resourceType,
    getResourceInfo,
    severity: 'MEDIUM',
    tags: ['crud', 'update']
  }),
  
  delete: (resourceType, getResourceInfo) => createAuditMiddleware({
    action: 'DELETE',
    resourceType,
    getResourceInfo,
    severity: 'HIGH',
    tags: ['crud', 'delete']
  })
};

/**
 * Audit middleware for authentication
 */
const auditAuth = {
  login: createAuditMiddleware({
    action: 'LOGIN',
    resourceType: 'System',
    severity: 'LOW',
    tags: ['authentication', 'login']
  }),
  
  logout: createAuditMiddleware({
    action: 'LOGOUT',
    resourceType: 'System',
    severity: 'LOW',
    tags: ['authentication', 'logout']
  }),
  
  loginFailed: createAuditMiddleware({
    action: 'LOGIN_FAILED',
    resourceType: 'System',
    severity: 'MEDIUM',
    tags: ['authentication', 'security', 'failed']
  })
};

/**
 * Audit middleware for queue operations
 */
const auditQueue = {
  call: createAuditMiddleware({
    action: 'QUEUE_CALL',
    resourceType: 'Queue',
    getResourceInfo: (req, res, data) => ({
      resourceName: `Queue #${data?.data?.queueNumber} (${req.params.department})`,
      metadata: { 
        queueNumber: data?.data?.queueNumber,
        department: req.params.department,
        windowId: req.params.windowId
      }
    }),
    severity: 'MEDIUM',
    tags: ['queue', 'call']
  }),
  
  serve: createAuditMiddleware({
    action: 'QUEUE_SERVE',
    resourceType: 'Queue',
    severity: 'MEDIUM',
    tags: ['queue', 'serve']
  }),
  
  complete: createAuditMiddleware({
    action: 'QUEUE_COMPLETE',
    resourceType: 'Queue',
    severity: 'MEDIUM',
    tags: ['queue', 'complete']
  }),
  
  skip: createAuditMiddleware({
    action: 'QUEUE_SKIP',
    resourceType: 'Queue',
    severity: 'MEDIUM',
    tags: ['queue', 'skip']
  })
};

/**
 * Audit middleware for settings
 */
const auditSettings = createAuditMiddleware({
  action: 'SETTINGS_UPDATE',
  resourceType: 'Settings',
  getResourceInfo: (req, res, data) => ({
    resourceName: `${req.params.department || 'System'} Settings`,
    oldValues: req.body.oldValues,
    newValues: req.body
  }),
  severity: 'MEDIUM',
  tags: ['settings', 'configuration']
});

module.exports = {
  createAuditMiddleware,
  auditCRUD,
  auditAuth,
  auditQueue,
  auditSettings,
  AuditService
};
