/**
 * Authenticated API Client for LVCampusConnect System
 * 
 * This utility wraps the native fetch API to automatically include
 * JWT authentication tokens in all requests to protected endpoints.
 * 
 * Features:
 * - Automatically adds Authorization header with JWT token
 * - Handles 401 Unauthorized responses by redirecting to login
 * - Provides a drop-in replacement for fetch()
 * - Supports all standard fetch options
 */

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
  console.error('🔒 Authentication failed - redirecting to login');
  localStorage.removeItem('authToken');
  localStorage.removeItem('userData');
  
  // Only redirect if not already on login page
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login';
  }
};

/**
 * Authenticated fetch wrapper
 * 
 * Usage:
 * ```javascript
 * import { authFetch } from '@/utils/apiClient';
 * 
 * // GET request
 * const response = await authFetch('/api/users');
 * const data = await response.json();
 * 
 * // POST request
 * const response = await authFetch('/api/users', {
 *   method: 'POST',
 *   body: JSON.stringify({ name: 'John' })
 * });
 * ```
 * 
 * @param {string} url - The URL to fetch
 * @param {RequestInit} options - Fetch options (method, headers, body, etc.)
 * @returns {Promise<Response>} The fetch response
 */
export const authFetch = async (url, options = {}) => {
  // Get the JWT token
  const token = getAuthToken();

  // Prepare headers
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Add Authorization header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Merge options with headers
  const fetchOptions = {
    ...options,
    headers,
  };

  try {
    // Make the request
    const response = await fetch(url, fetchOptions);

    // Handle 401 Unauthorized
    if (response.status === 401) {
      handleAuthError();
      throw new Error('Authentication required. Please sign in again.');
    }

    return response;
  } catch (error) {
    // Re-throw the error for the caller to handle
    throw error;
  }
};

/**
 * Authenticated fetch with automatic JSON parsing
 * 
 * Usage:
 * ```javascript
 * import { authFetchJSON } from '@/utils/apiClient';
 * 
 * const data = await authFetchJSON('/api/users');
 * ```
 * 
 * @param {string} url - The URL to fetch
 * @param {RequestInit} options - Fetch options
 * @returns {Promise<any>} The parsed JSON response
 */
export const authFetchJSON = async (url, options = {}) => {
  const response = await authFetch(url, options);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
  }
  
  return response.json();
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

