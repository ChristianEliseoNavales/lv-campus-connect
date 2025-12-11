/**
 * Frontend Error Handling Utility
 * Centralized error handling with error message mapping and logging
 */

/**
 * Error Message Mapping
 * Maps error codes and types to user-friendly messages
 */
const ERROR_MESSAGES = {
  // Network Errors
  NETWORK_ERROR: 'Unable to connect to the server. Please check your internet connection and try again.',
  TIMEOUT_ERROR: 'The request took too long to process. Please try again.',
  CONNECTION_REFUSED: 'Unable to connect to the server. The server may be temporarily unavailable.',

  // HTTP Status Code Messages
  400: 'Invalid request. Please check your input and try again.',
  401: 'Authentication required. Please sign in again.',
  403: 'You do not have permission to access this resource.',
  404: 'The requested resource was not found.',
  409: 'A conflict occurred. This record may already exist.',
  408: 'Request timeout. Please try again.',
  422: 'Validation failed. Please check your input.',
  500: 'An unexpected server error occurred. Please try again later.',
  503: 'Service temporarily unavailable. Please try again later.',

  // Authentication Errors
  AUTHENTICATION_ERROR: 'Authentication required. Please sign in again.',
  TOKEN_EXPIRED: 'Your session has expired. Please sign in again.',
  TOKEN_INVALID: 'Invalid authentication token. Please sign in again.',

  // Validation Errors
  VALIDATION_ERROR: 'The provided data is invalid. Please check your input and try again.',

  // Generic Errors
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again or contact support if the problem persists.',
  INTERNAL_ERROR: 'An internal error occurred. Please try again later.'
};

/**
 * Get user-friendly error message
 * @param {Error|string|number} error - Error object, error message, or status code
 * @returns {string} User-friendly error message
 */
export const getUserFriendlyMessage = (error) => {
  // If error is a number (status code)
  if (typeof error === 'number') {
    return ERROR_MESSAGES[error] || ERROR_MESSAGES.UNKNOWN_ERROR;
  }

  // If error is a string
  if (typeof error === 'string') {
    // Check if it matches any error message key
    for (const [key, message] of Object.entries(ERROR_MESSAGES)) {
      if (error.toLowerCase().includes(key.toLowerCase())) {
        return message;
      }
    }
    return error; // Return the string as-is if no match
  }

  // If error is an Error object
  if (error instanceof Error) {
    const message = error.message || '';

    // Check for specific error types
    if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
      return ERROR_MESSAGES.NETWORK_ERROR;
    }

    if (message.includes('timeout') || message.includes('Timeout')) {
      return ERROR_MESSAGES.TIMEOUT_ERROR;
    }

    if (message.includes('401') || message.includes('Unauthorized')) {
      return ERROR_MESSAGES[401];
    }

    if (message.includes('403') || message.includes('Forbidden')) {
      return ERROR_MESSAGES[403];
    }

    if (message.includes('404') || message.includes('Not Found')) {
      return ERROR_MESSAGES[404];
    }

    if (message.includes('500') || message.includes('Internal Server Error')) {
      return ERROR_MESSAGES[500];
    }

    // Check error code if available
    if (error.code) {
      if (ERROR_MESSAGES[error.code]) {
        return ERROR_MESSAGES[error.code];
      }
    }

    // Return the error message if it's user-friendly, otherwise return generic message
    return message || ERROR_MESSAGES.UNKNOWN_ERROR;
  }

  // If error has a response object (from API)
  if (error?.response) {
    const status = error.response.status;
    const data = error.response.data;

    // Check for status code message
    if (ERROR_MESSAGES[status]) {
      return ERROR_MESSAGES[status];
    }

    // Check for error message in response data
    if (data?.message) {
      return data.message;
    }

    if (data?.error) {
      return data.error;
    }
  }

  // Default fallback
  return ERROR_MESSAGES.UNKNOWN_ERROR;
};

/**
 * Parse API error response
 * @param {Response} response - Fetch response object
 * @returns {Promise<Error>} Parsed error object
 */
export const parseApiError = async (response) => {
  let errorData;

  try {
    errorData = await response.json();
  } catch (e) {
    // If response is not JSON, create error from status
    const error = new Error(`HTTP error! status: ${response.status}`);
    error.status = response.status;
    error.statusText = response.statusText;
    return error;
  }

  // Create error with API error details
  const error = new Error(errorData.message || errorData.error || `HTTP error! status: ${response.status}`);
  error.status = response.status;
  error.statusText = response.statusText;
  error.data = errorData;
  error.code = errorData.error || errorData.errorCode;
  error.details = errorData.details;

  return error;
};

/**
 * Log error to console (and potentially to error reporting service)
 * @param {Error} error - Error object
 * @param {Object} context - Additional context data
 */
export const logError = (error, context = {}) => {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    name: error.name,
    status: error.status,
    code: error.code,
    timestamp: new Date().toISOString(),
    ...context
  };

  // Log in development
  if (import.meta.env.DEV) {
    console.error('Error occurred:', errorInfo);
  } else {
    // In production, you might want to send to error reporting service
    // e.g., Sentry, LogRocket, etc.
    console.error('Error:', error.message);
  }

  // TODO: Integrate with error reporting service in production
  // if (import.meta.env.PROD) {
  //   errorReportingService.captureException(error, { extra: context });
  // }
};

/**
 * Handle error and return user-friendly message
 * @param {Error|Response|any} error - Error object or response
 * @param {Object} context - Additional context
 * @returns {string} User-friendly error message
 */
export const handleError = async (error, context = {}) => {
  // Log error
  logError(error, context);

  // If error is a Response object, parse it
  if (error instanceof Response) {
    const parsedError = await parseApiError(error);
    return getUserFriendlyMessage(parsedError);
  }

  // Return user-friendly message
  return getUserFriendlyMessage(error);
};

/**
 * Error Recovery Helpers
 */

/**
 * Check if error is retryable
 * @param {Error} error - Error object
 * @returns {boolean} True if error is retryable
 */
export const isRetryableError = (error) => {
  // Network errors are retryable
  if (error.message?.includes('Failed to fetch') ||
      error.message?.includes('NetworkError') ||
      error.message?.includes('timeout')) {
    return true;
  }

  // 5xx errors are retryable (except 501, 505)
  if (error.status >= 500 && error.status < 600) {
    if (error.status === 501 || error.status === 505) {
      return false;
    }
    return true;
  }

  // 408 (Request Timeout) is retryable
  if (error.status === 408) {
    return true;
  }

  return false;
};

/**
 * Get retry delay in milliseconds
 * @param {number} attempt - Current attempt number (0-indexed)
 * @returns {number} Delay in milliseconds
 */
export const getRetryDelay = (attempt) => {
  // Exponential backoff: 1s, 2s, 4s, 8s, etc.
  return Math.min(1000 * Math.pow(2, attempt), 10000); // Max 10 seconds
};

/**
 * Retry function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxAttempts - Maximum number of attempts
 * @param {Function} shouldRetry - Function to determine if error is retryable
 * @returns {Promise<any>} Result of function execution
 */
export const retry = async (fn, maxAttempts = 3, shouldRetry = isRetryableError) => {
  let lastError;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // If this is the last attempt or error is not retryable, throw
      if (attempt === maxAttempts - 1 || !shouldRetry(error)) {
        throw error;
      }

      // Wait before retrying
      const delay = getRetryDelay(attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

export default {
  getUserFriendlyMessage,
  parseApiError,
  logError,
  handleError,
  isRetryableError,
  getRetryDelay,
  retry,
  ERROR_MESSAGES
};
