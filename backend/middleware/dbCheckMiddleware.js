/**
 * Database Connection Check Middleware
 * Verifies MongoDB connection before processing requests that require database access
 */

const mongoose = require('mongoose');
const { ServiceUnavailableError } = require('../utils/errorHandler');

/**
 * Database Connection Check Middleware
 * Checks if MongoDB is connected before allowing request to proceed
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const checkDatabaseConnection = (req, res, next) => {
  const connectionState = mongoose.connection.readyState;

  // Connection states:
  // 0 = disconnected
  // 1 = connected
  // 2 = connecting
  // 3 = disconnecting

  if (connectionState !== 1) {
    const error = new ServiceUnavailableError(
      'Database connection is not available. Please try again later.'
    );
    return next(error);
  }

  next();
};

/**
 * Optional Database Connection Check
 * Only checks connection but doesn't fail if disconnected
 * Useful for read-only operations that can use cached data
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const checkDatabaseConnectionOptional = (req, res, next) => {
  const connectionState = mongoose.connection.readyState;

  // Attach connection status to request for use in controllers
  req.dbConnected = connectionState === 1;

  if (connectionState !== 1) {
    // Log warning but don't fail the request
    console.warn('⚠️  Database not connected, but request proceeding (optional check)');
  }

  next();
};

module.exports = {
  checkDatabaseConnection,
  checkDatabaseConnectionOptional
};
