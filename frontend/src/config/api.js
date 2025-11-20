/**
 * API Configuration for LVCampusConnect System
 * Hybrid Architecture: Cloud Backend + Local Backend
 *
 * Architecture:
 * - Cloud Backend: Used by Admin interface (accessible from anywhere)
 * - Local Backend: Used by Kiosk interface (for printing and queue submission)
 * - Both backends connect to the same MongoDB Atlas database
 */

// Backend URLs from environment variables
const CLOUD_BACKEND_URL = import.meta.env.VITE_CLOUD_BACKEND_URL || 'https://lvcampusconnect-backend.onrender.com';
const LOCAL_BACKEND_URL = import.meta.env.VITE_LOCAL_BACKEND_URL || 'http://localhost:5000';

// Environment mode - determines which backend to use
const NODE_ENV = import.meta.env.VITE_NODE_ENV || import.meta.env.MODE || 'development';
const IS_DEVELOPMENT = NODE_ENV === 'development';

/**
 * Detect if the current page is a kiosk page
 * Kiosk pages are public-facing pages that don't require authentication
 */
const isKioskPage = () => {
  const path = window.location.pathname;

  // Kiosk pages (public interface)
  const kioskPages = [
    '/',
    '/kiosk',
    '/queue',
    '/bulletin',
    '/directory',
    '/map',
    '/faqs',
    '/portalqueue'
  ];

  return kioskPages.some(page => path === page || path.startsWith(page));
};

/**
 * Detect if the current page is an admin page
 * Admin pages require authentication and use cloud backend
 */
const isAdminPage = () => {
  const path = window.location.pathname;
  return path.startsWith('/admin') || path.startsWith('/login');
};

/**
 * Get the appropriate backend URL based on the operation type
 *
 * @param {string} operation - The type of operation ('kiosk', 'admin', 'print', 'default')
 * @returns {string} The backend URL to use
 */
const getBackendUrl = (operation = 'default') => {
  // PRINT operations ALWAYS use localhost (for thermal printer access)
  // This is critical for kiosk machines with physical printers
  if (operation === 'print') {
    console.log('🖨️ FORCING LOCAL backend for PRINTING (localhost:5000)');
    return 'http://localhost:5000'; // Hardcoded for printing reliability
  }

  // DEVELOPMENT MODE: Use local backend for EVERYTHING (except explicit cloud requests)
  // This allows full local testing before deployment
  if (IS_DEVELOPMENT) {
    console.log(`🔧 DEVELOPMENT MODE: Using LOCAL backend for ${operation}`);
    return LOCAL_BACKEND_URL;
  }

  // PRODUCTION MODE: Use hybrid architecture
  // Explicit operation types
  if (operation === 'kiosk') {
    console.log('🖥️ Using LOCAL backend for:', operation);
    return LOCAL_BACKEND_URL;
  }

  if (operation === 'admin') {
    console.log('☁️ Using CLOUD backend for:', operation);
    return CLOUD_BACKEND_URL;
  }

  // Auto-detect based on current page
  if (isKioskPage()) {
    console.log('🖥️ Using LOCAL backend (kiosk page detected)');
    return LOCAL_BACKEND_URL;
  }

  if (isAdminPage()) {
    console.log('☁️ Using CLOUD backend (admin page detected)');
    return CLOUD_BACKEND_URL;
  }

  // Default: Use cloud backend for general operations
  console.log('☁️ Using CLOUD backend (default)');
  return CLOUD_BACKEND_URL;
};

/**
 * Get Socket.io URL based on context
 * - Development: Always use local backend
 * - Production: Kiosk pages use local backend, Admin pages use cloud backend
 */
const getSocketUrl = () => {
  // DEVELOPMENT MODE: Always use local backend
  if (IS_DEVELOPMENT) {
    console.log('🔌 Socket.io: DEVELOPMENT MODE - Connecting to LOCAL backend');
    return LOCAL_BACKEND_URL;
  }

  // PRODUCTION MODE: Use hybrid architecture
  if (isKioskPage()) {
    console.log('🔌 Socket.io: Connecting to LOCAL backend');
    return LOCAL_BACKEND_URL;
  }

  console.log('🔌 Socket.io: Connecting to CLOUD backend');
  return CLOUD_BACKEND_URL;
};

// Get API base URL (dynamic based on context)
export const API_BASE_URL = getBackendUrl();

// Socket.io connection URL (dynamic based on context)
export const SOCKET_URL = getSocketUrl();

// API endpoints
export const API_ENDPOINTS = {
  // Public endpoints
  public: {
    queue: (department) => `${API_BASE_URL}/api/public/queue/${department}`,
    queueLookup: (queueId) => `${API_BASE_URL}/api/public/queue-lookup/${queueId}`,
    submitQueue: `${API_BASE_URL}/api/public/queue`,
    submitRating: `${API_BASE_URL}/api/ratings`,
  },
  
  // Database endpoints
  database: {
    bulletin: `${API_BASE_URL}/api/database/bulletin`,
    office: `${API_BASE_URL}/api/database/office`,
    chart: `${API_BASE_URL}/api/database/chart`,
  },
  
  // Settings endpoints
  settings: {
    location: (department) => `${API_BASE_URL}/api/settings/location/${department}`,
  },
  
  // Analytics endpoints
  analytics: {
    pieChart: {
      combined: (timeRange) => `${API_BASE_URL}/api/analytics/pie-chart/combined?timeRange=${timeRange}`,
      department: (department, timeRange) => `${API_BASE_URL}/api/analytics/pie-chart/${department}?timeRange=${timeRange}`,
    },
  },
  
  // Admin endpoints
  admin: {
    users: `${API_BASE_URL}/api/users`,
    windows: (department) => `${API_BASE_URL}/api/windows/${department}`,
    bulletin: {
      upload: `${API_BASE_URL}/api/bulletin/upload`,
      delete: (publicId) => `${API_BASE_URL}/api/bulletin/delete/${publicId}`,
    },
    charts: {
      upload: `${API_BASE_URL}/api/charts/upload`,
      delete: (publicId) => `${API_BASE_URL}/api/charts/delete/${publicId}`,
    },
  },
};

// Helper function to build URL with query parameters
export const buildURL = (baseUrl, params = {}) => {
  const url = new URL(baseUrl);
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null) {
      url.searchParams.append(key, params[key]);
    }
  });
  return url.toString();
};

/**
 * API Configuration Object
 */
const API_CONFIG = {
  // Backend URLs
  CLOUD_BACKEND: CLOUD_BACKEND_URL,
  LOCAL_BACKEND: LOCAL_BACKEND_URL,

  // Dynamic URLs (based on context)
  API_BASE_URL,
  SOCKET_URL,

  // Helper functions
  isKiosk: isKioskPage,
  isAdmin: isAdminPage,
  getBackendUrl,
  getSocketUrl,

  // Convenience methods for common operations
  getKioskUrl: () => LOCAL_BACKEND_URL,
  getAdminUrl: () => IS_DEVELOPMENT ? LOCAL_BACKEND_URL : CLOUD_BACKEND_URL,
  // CRITICAL: Printing ALWAYS uses localhost for thermal printer access
  getPrintUrl: () => 'http://localhost:5000',

  // Environment info
  isDevelopment: () => IS_DEVELOPMENT,
  getEnvironment: () => NODE_ENV,

  // API Endpoints
  API_ENDPOINTS,
  buildURL,
};

// Log configuration on load
console.log('🌐 API Configuration loaded:');
console.log('  - Environment:', NODE_ENV, IS_DEVELOPMENT ? '(DEVELOPMENT MODE)' : '(PRODUCTION MODE)');
console.log('  - Cloud Backend:', CLOUD_BACKEND_URL);
console.log('  - Local Backend:', LOCAL_BACKEND_URL);
console.log('  - Current Page:', window.location.pathname);
console.log('  - Is Kiosk Page:', isKioskPage());
console.log('  - Is Admin Page:', isAdminPage());
console.log('  - Active Backend:', getBackendUrl());
if (IS_DEVELOPMENT) {
  console.log('  ⚠️ DEVELOPMENT MODE: All API calls will use LOCAL backend (localhost:5000)');
  console.log('  ⚠️ Make sure your local backend is running!');
}

export default API_CONFIG;

