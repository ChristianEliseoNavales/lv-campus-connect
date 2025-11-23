/**
 * Conditional logging utility
 * Only logs in development mode or for errors
 */

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Log debug information (only in development)
 * @param {...any} args - Arguments to log
 */
const log = (...args) => {
  if (isDevelopment) {
    console.log(...args);
  }
};

/**
 * Log error information (always logged)
 * @param {...any} args - Arguments to log
 */
const error = (...args) => {
  console.error(...args);
};

/**
 * Log warning information (only in development)
 * @param {...any} args - Arguments to log
 */
const warn = (...args) => {
  if (isDevelopment) {
    console.warn(...args);
  }
};

/**
 * Log info information (only in development)
 * @param {...any} args - Arguments to log
 */
const info = (...args) => {
  if (isDevelopment) {
    console.info(...args);
  }
};

module.exports = {
  log,
  error,
  warn,
  info,
  isDevelopment
};



