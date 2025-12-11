/**
 * Request Timeout Middleware
 * Sets a timeout for requests to prevent hanging requests
 */

const { TimeoutError } = require('../utils/errorHandler');

/**
 * Request Timeout Middleware
 * Automatically cancels requests that exceed the specified timeout
 *
 * @param {number} timeoutMs - Timeout in milliseconds (default: 30000)
 * @returns {Function} Express middleware function
 *
 * @example
 * // Use default 30 second timeout
 * app.use(timeoutMiddleware());
 *
 * // Use custom 60 second timeout
 * app.use(timeoutMiddleware(60000));
 */
const timeoutMiddleware = (timeoutMs = 30000) => {
  return (req, res, next) => {
    // Set timeout
    const timeout = setTimeout(() => {
      // If response hasn't been sent, send timeout error
      if (!res.headersSent) {
        const error = new TimeoutError(
          `Request timeout after ${timeoutMs}ms. Please try again.`
        );
        next(error);
      }
    }, timeoutMs);

    // Clear timeout when response is finished
    const originalEnd = res.end;
    res.end = function(...args) {
      clearTimeout(timeout);
      originalEnd.apply(this, args);
    };

    // Continue to next middleware
    next();
  };
};

module.exports = timeoutMiddleware;
