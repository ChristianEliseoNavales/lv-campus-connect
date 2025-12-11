/**
 * Enhanced Error Handling Middleware
 * Centralized error handling with proper classification, logging, and user-friendly messages
 */

const {
  AppError,
  ValidationError,
  DatabaseError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  ServiceUnavailableError,
  TimeoutError,
  formatErrorResponse,
  handleMongoError,
  handleJWTError,
  logErrorWithContext
} = require('../utils/errorHandler');

const mongoose = require('mongoose');

/**
 * Error Handling Middleware
 * Must be placed after all routes and before 404 handler
 *
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const errorHandler = (err, req, res, next) => {
  let error = err;

  // If error is not an instance of AppError, convert it
  if (!(error instanceof AppError)) {
    // Handle MongoDB errors
    if (error.name === 'ValidationError' ||
        error.name === 'CastError' ||
        error.code === 11000 ||
        error.name === 'MongoServerError' ||
        error.name === 'MongoNetworkError') {
      error = handleMongoError(error);
    }
    // Handle JWT errors
    else if (error.name === 'TokenExpiredError' ||
             error.name === 'JsonWebTokenError' ||
             error.name === 'NotBeforeError') {
      error = handleJWTError(error);
    }
    // Handle timeout errors
    else if (error.name === 'TimeoutError' || error.code === 'ETIMEDOUT') {
      error = new TimeoutError('Request timeout. Please try again.');
    }
    // Handle network errors
    else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      error = new ServiceUnavailableError('Service unavailable. Please try again later.');
    }
    // Handle generic errors
    else {
      error = new AppError(
        error.message || 'An unexpected error occurred',
        error.statusCode || 500,
        'INTERNAL_ERROR',
        false // Non-operational errors
      );
    }
  }

  // Log error with context
  const severity = error.statusCode >= 500 ? 'error' : 'warn';
  logErrorWithContext(error, req, severity);

  // Format error response
  const errorResponse = formatErrorResponse(error, req);

  // Send error response
  res.status(error.statusCode || 500).json(errorResponse);
};

/**
 * 404 Not Found Handler
 * Must be placed after all routes
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Route ${req.method} ${req.originalUrl}`);
  next(error);
};

/**
 * Database Connection Check Middleware
 * Checks if database is connected before processing request
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const checkDatabaseConnection = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    const error = new ServiceUnavailableError(
      'Database connection is not available. Please try again later.'
    );
    return next(error);
  }
  next();
};

module.exports = {
  errorHandler,
  notFoundHandler,
  checkDatabaseConnection
};
