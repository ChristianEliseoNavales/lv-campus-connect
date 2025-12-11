/**
 * Authenticated API Client for LVCampusConnect System
 *
 * This utility wraps the native fetch API to automatically include
 * JWT authentication tokens in all requests to protected endpoints.
 *
 * Features:
 * - Automatically adds Authorization header with JWT token
 * - Handles 401 Unauthorized responses by redirecting to login
 * - Request timeout handling
 * - Automatic retry for transient errors
 * - Better error parsing and user-friendly messages
 * - Provides a drop-in replacement for fetch()
 * - Supports all standard fetch options
 */

import { parseApiError, handleError, isRetryableError, retry } from './errorHandler';

/**
 * Get the JWT token from localStorage
 * @returns {string|null} The JWT token or null if not found
 */
const getAuthToken = () => {
  return localStorage.getItem('authToken');
};

/**
 * Handle authentication errors
 * Clears auth data and redirects to login page
 */
const handleAuthError = () => {
  console.error('Authentication failed - redirecting to login');
  localStorage.removeItem('authToken');
  localStorage.removeItem('userData');

  // Only redirect if not already on login page
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login';
  }
};

/**
 * Create AbortController with timeout
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {AbortController} AbortController with timeout
 */
const createTimeoutController = (timeoutMs = 30000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // Store timeout ID for cleanup
  controller._timeoutId = timeoutId;

  return controller;
};

/**
 * Authenticated fetch wrapper with timeout and retry
 *
 * Usage:
 * ```javascript
 * import { authFetch } from '@/utils/apiClient';
 *
 * // GET request
 * const response = await authFetch('/api/users');
 * const data = await response.json();
 *
 * // POST request with custom timeout
 * const response = await authFetch('/api/users', {
 *   method: 'POST',
 *   body: JSON.stringify({ name: 'John' }),
 *   timeout: 60000 // 60 seconds
 * });
 * ```
 *
 * @param {string} url - The URL to fetch
 * @param {RequestInit & { timeout?: number, retry?: boolean, maxRetries?: number }} options - Fetch options
 * @returns {Promise<Response>} The fetch response
 */
export const authFetch = async (url, options = {}) => {
  const {
    timeout = 30000, // Default 30 seconds
    retry: shouldRetry = true,
    maxRetries = 3,
    ...fetchOptions
  } = options;

  // Get the JWT token
  const token = getAuthToken();

  // Prepare headers
  // IMPORTANT: Do NOT set Content-Type for FormData - browser will auto-set with boundary
  const headers = {
    ...fetchOptions.headers,
  };

  // Only set Content-Type if body is NOT FormData
  // FormData requires browser to automatically set Content-Type with boundary
  if (!(fetchOptions.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  // Add Authorization header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Fetch function to retry
  const fetchWithTimeout = async () => {
    // Create timeout controller
    const timeoutController = createTimeoutController(timeout);

    try {
      // Merge options with headers and signal
      const requestOptions = {
        ...fetchOptions,
        headers,
        signal: timeoutController.signal,
      };

      // Make the request
      const response = await fetch(url, requestOptions);

      // Clear timeout on success
      clearTimeout(timeoutController._timeoutId);

      // Handle 401 Unauthorized
      if (response.status === 401) {
        handleAuthError();
        const error = new Error('Authentication required. Please sign in again.');
        error.status = 401;
        throw error;
      }

      return response;
    } catch (error) {
      // Clear timeout on error
      clearTimeout(timeoutController._timeoutId);

      // Handle abort (timeout)
      if (error.name === 'AbortError') {
        const timeoutError = new Error('Request timeout. Please try again.');
        timeoutError.name = 'TimeoutError';
        timeoutError.status = 408;
        throw timeoutError;
      }

      throw error;
    }
  };

  // Retry logic if enabled
  if (shouldRetry) {
    try {
      return await retry(fetchWithTimeout, maxRetries, isRetryableError);
    } catch (error) {
      // If retry failed, enhance error with user-friendly message
      const enhancedError = await handleError(error, { url, method: fetchOptions.method });
      throw enhancedError;
    }
  } else {
    try {
      return await fetchWithTimeout();
    } catch (error) {
      // Enhance error with user-friendly message
      const enhancedError = await handleError(error, { url, method: fetchOptions.method });
      throw enhancedError;
    }
  }
};

/**
 * Authenticated fetch with automatic JSON parsing and error handling
 *
 * Usage:
 * ```javascript
 * import { authFetchJSON } from '@/utils/apiClient';
 *
 * try {
 *   const data = await authFetchJSON('/api/users');
 * } catch (error) {
 *   // Error is already parsed and user-friendly
 *   console.error(error.message);
 * }
 * ```
 *
 * @param {string} url - The URL to fetch
 * @param {RequestInit & { timeout?: number, retry?: boolean, maxRetries?: number }} options - Fetch options
 * @returns {Promise<any>} The parsed JSON response
 */
export const authFetchJSON = async (url, options = {}) => {
  try {
    const response = await authFetch(url, options);

    if (!response.ok) {
      // Parse API error response
      const error = await parseApiError(response);
      throw error;
    }

    return await response.json();
  } catch (error) {
    // Enhance error with user-friendly message
    const userFriendlyMessage = await handleError(error, { url, method: options.method });
    error.userMessage = userFriendlyMessage;
    throw error;
  }
};

/**
 * Check if user is authenticated
 * @returns {boolean} True if user has a valid token
 */
export const isAuthenticated = () => {
  return !!getAuthToken();
};

/**
 * Get current user data from localStorage
 * @returns {object|null} User data or null if not found
 */
export const getCurrentUser = () => {
  const userData = localStorage.getItem('userData');
  if (!userData) return null;

  try {
    return JSON.parse(userData);
  } catch (error) {
    console.error('Failed to parse user data:', error);
    return null;
  }
};

/**
 * Clear authentication data
 */
export const clearAuth = () => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('userData');
};

// Export as default for convenience
export default {
  authFetch,
  authFetchJSON,
  isAuthenticated,
  getCurrentUser,
  clearAuth,
};

