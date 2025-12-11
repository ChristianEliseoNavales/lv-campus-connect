/**
 * Centralized Error Handling Utilities
 * Provides custom error classes and standardized error response format
 */

const { error: logError } = require('./logger');

/**
 * Base Application Error Class
 * All custom errors extend from this class
 */
class AppError extends Error {
  constructor(message, statusCode = 500, errorCode = 'INTERNAL_ERROR', isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation Error
 * Used for input validation failures
 */
class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = []) {
    super(message, 400, 'VALIDATION_ERROR', true);
    this.details = details;
  }
}

/**
 * Database Error
 * Used for database operation failures
 */
class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', originalError = null) {
    super(message, 500, 'DATABASE_ERROR', true);
    this.originalError = originalError;
  }
}

/**
 * Authentication Error
 * Used for authentication failures
 */
class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR', true);
  }
}

/**
 * Authorization Error
 * Used for authorization/permission failures
 */
class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR', true);
  }
}

/**
 * Not Found Error
 * Used when resources are not found
 */
class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND', true);
    this.resource = resource;
  }
}

/**
 * Conflict Error
 * Used for duplicate key or conflict errors
 */
class ConflictError extends AppError {
  constructor(message = 'Resource conflict', field = null) {
    super(message, 409, 'CONFLICT_ERROR', true);
    this.field = field;
  }
}

/**
 * Service Unavailable Error
 * Used when services are temporarily unavailable
 */
class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable') {
    super(message, 503, 'SERVICE_UNAVAILABLE', true);
  }
}

/**
 * Timeout Error
 * Used for request timeout scenarios
 */
class TimeoutError extends AppError {
  constructor(message = 'Request timeout') {
    super(message, 408, 'TIMEOUT_ERROR', true);
  }
}

/**
 * Error Code Mapping
 * Maps error types to user-friendly messages
 */
const ERROR_MESSAGES = {
  // Validation Errors
  VALIDATION_ERROR: 'The provided data is invalid. Please check your input and try again.',

  // Database Errors
  DATABASE_ERROR: 'A database error occurred. Please try again later.',
  DATABASE_CONNECTION_ERROR: 'Unable to connect to the database. Please try again later.',

  // Authentication/Authorization
  AUTHENTICATION_ERROR: 'Authentication required. Please sign in.',
  AUTHORIZATION_ERROR: 'You do not have permission to access this resource.',
  TOKEN_EXPIRED: 'Your session has expired. Please sign in again.',
  TOKEN_INVALID: 'Invalid authentication token. Please sign in again.',

  // Not Found
  NOT_FOUND: 'The requested resource was not found.',

  // Conflict
  CONFLICT_ERROR: 'A conflict occurred. The resource may already exist.',
  DUPLICATE_KEY: 'This record already exists. Please use a different value.',

  // Service Unavailable
  SERVICE_UNAVAILABLE: 'The service is temporarily unavailable. Please try again later.',

  // Timeout
  TIMEOUT_ERROR: 'The request took too long to process. Please try again.',

  // Generic
  INTERNAL_ERROR: 'An unexpected error occurred. Please try again later.',
  UNKNOWN_ERROR: 'An unknown error occurred. Please contact support if the problem persists.'
};

/**
 * Get user-friendly error message
 * @param {string} errorCode - Error code
 * @param {string} defaultMessage - Default message if code not found
 * @returns {string} User-friendly error message
 */
const getUserFriendlyMessage = (errorCode, defaultMessage = null) => {
  return ERROR_MESSAGES[errorCode] || defaultMessage || ERROR_MESSAGES.UNKNOWN_ERROR;
};

/**
 * Standardized Error Response Format
 * @param {Error} err - Error object
 * @param {Object} req - Express request object (optional)
 * @returns {Object} Standardized error response
 */
const formatErrorResponse = (err, req = null) => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Determine error code
  const errorCode = err.errorCode || 'UNKNOWN_ERROR';

  // Get user-friendly message
  const userMessage = getUserFriendlyMessage(errorCode, err.message);

  // Base response structure
  const response = {
    success: false,
    error: errorCode,
    message: isDevelopment ? err.message : userMessage,
    timestamp: err.timestamp || new Date().toISOString()
  };

  // Add details for validation errors
  if (err.details && Array.isArray(err.details)) {
    response.details = err.details;
  }

  // Add field information for conflict errors
  if (err.field) {
    response.field = err.field;
  }

  // Add resource information for not found errors
  if (err.resource) {
    response.resource = err.resource;
  }

  // Add stack trace in development
  if (isDevelopment && err.stack) {
    response.stack = err.stack;
  }

  // Add request context in development
  if (isDevelopment && req) {
    response.request = {
      method: req.method,
      path: req.path,
      query: req.query,
      body: req.body
    };
  }

  return response;
};

/**
 * Handle MongoDB Errors
 * Converts MongoDB errors to appropriate AppError instances
 * @param {Error} error - MongoDB error
 * @returns {AppError} Appropriate error instance
 */
const handleMongoError = (error) => {
  // Validation Error
  if (error.name === 'ValidationError') {
    const details = Object.values(error.errors).map(err => ({
      field: err.path,
      message: err.message
    }));
    return new ValidationError('Validation failed', details);
  }

  // Cast Error (Invalid ObjectId)
  if (error.name === 'CastError') {
    return new ValidationError(`Invalid ID format: ${error.value}`);
  }

  // Duplicate Key Error
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0] || 'field';
    return new ConflictError(
      `Duplicate ${field}. This ${field} already exists.`,
      field
    );
  }

  // Connection Error
  if (error.name === 'MongoServerError' || error.name === 'MongoNetworkError') {
    return new ServiceUnavailableError('Database connection error. Please try again later.');
  }

  // Generic Database Error
  return new DatabaseError('Database operation failed', error);
};

/**
 * Handle JWT Errors
 * Converts JWT errors to appropriate AppError instances
 * @param {Error} error - JWT error
 * @returns {AppError} Appropriate error instance
 */
const handleJWTError = (error) => {
  if (error.name === 'TokenExpiredError') {
    return new AuthenticationError('Your session has expired. Please sign in again.');
  }

  if (error.name === 'JsonWebTokenError' || error.name === 'NotBeforeError') {
    return new AuthenticationError('Invalid authentication token. Please sign in again.');
  }

  return new AuthenticationError('Authentication failed');
};

/**
 * Log Error with Context
 * @param {Error} err - Error object
 * @param {Object} req - Express request object (optional)
 * @param {string} severity - Error severity level
 */
const logErrorWithContext = (err, req = null, severity = 'error') => {
  const errorContext = {
    message: err.message,
    errorCode: err.errorCode || 'UNKNOWN_ERROR',
    statusCode: err.statusCode || 500,
    stack: err.stack,
    timestamp: new Date().toISOString()
  };

  if (req) {
    errorContext.request = {
      method: req.method,
      path: req.path,
      query: req.query,
      body: req.body,
      headers: {
        'user-agent': req.get('user-agent'),
        'referer': req.get('referer')
      },
      ip: req.ip || req.connection.remoteAddress,
      user: req.user ? {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role
      } : null
    };
  }

  // Log based on severity
  if (severity === 'error') {
    logError('Error occurred:', JSON.stringify(errorContext, null, 2));
  } else {
    logError(`[${severity.toUpperCase()}]`, JSON.stringify(errorContext, null, 2));
  }
};

module.exports = {
  // Error Classes
  AppError,
  ValidationError,
  DatabaseError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  ServiceUnavailableError,
  TimeoutError,

  // Utility Functions
  formatErrorResponse,
  getUserFriendlyMessage,
  handleMongoError,
  handleJWTError,
  logErrorWithContext,

  // Constants
  ERROR_MESSAGES
};
