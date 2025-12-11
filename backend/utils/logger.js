/**
 * Enhanced Logging Utility
 * Structured logging with severity levels and request context
 */

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Log Severity Levels
 */
const SEVERITY = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  FATAL: 'fatal'
};

/**
 * Structured Log Entry
 * @param {string} severity - Log severity level
 * @param {string} message - Log message
 * @param {Object} context - Additional context data
 */
const logStructured = (severity, message, context = {}) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    severity: severity.toUpperCase(),
    message,
    ...context
  };

  // Format log entry
  const logString = JSON.stringify(logEntry, null, isDevelopment ? 2 : 0);

  // Log based on severity
  switch (severity) {
    case SEVERITY.DEBUG:
      if (isDevelopment) {
        console.debug(logString);
      }
      break;
    case SEVERITY.INFO:
      if (isDevelopment || process.env.LOG_LEVEL === 'info') {
        console.info(logString);
      }
      break;
    case SEVERITY.WARN:
      console.warn(logString);
      break;
    case SEVERITY.ERROR:
    case SEVERITY.FATAL:
      console.error(logString);
      break;
    default:
      console.log(logString);
  }
};

/**
 * Log debug information (only in development)
 * @param {string} message - Log message
 * @param {Object} context - Additional context data
 */
const log = (message, context = {}) => {
  if (isDevelopment) {
    logStructured(SEVERITY.DEBUG, message, context);
  }
};

/**
 * Log error information (always logged)
 * @param {string} message - Log message
 * @param {Object} context - Additional context data
 */
const error = (message, context = {}) => {
  logStructured(SEVERITY.ERROR, message, context);
};

/**
 * Log warning information
 * @param {string} message - Log message
 * @param {Object} context - Additional context data
 */
const warn = (message, context = {}) => {
  logStructured(SEVERITY.WARN, message, context);
};

/**
 * Log info information
 * @param {string} message - Log message
 * @param {Object} context - Additional context data
 */
const info = (message, context = {}) => {
  logStructured(SEVERITY.INFO, message, context);
};

/**
 * Log fatal errors (always logged, highest priority)
 * @param {string} message - Log message
 * @param {Object} context - Additional context data
 */
const fatal = (message, context = {}) => {
  logStructured(SEVERITY.FATAL, message, context);
};

/**
 * Log with request context
 * @param {string} severity - Log severity level
 * @param {string} message - Log message
 * @param {Object} req - Express request object
 * @param {Object} additionalContext - Additional context data
 */
const logWithRequest = (severity, message, req, additionalContext = {}) => {
  const requestContext = {
    request: {
      method: req.method,
      path: req.path,
      query: req.query,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent')
    },
    user: req.user ? {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role
    } : null,
    ...additionalContext
  };

  logStructured(severity, message, requestContext);
};

module.exports = {
  // Basic logging functions
  log,
  error,
  warn,
  info,
  fatal,

  // Structured logging
  logStructured,
  logWithRequest,

  // Severity levels
  SEVERITY,

  // Environment check
  isDevelopment
};

