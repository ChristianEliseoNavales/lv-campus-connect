// API Configuration
// This file centralizes all API endpoint configurations

// Get API base URL from environment variable or default to localhost
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Socket.io connection URL (same as API base URL)
export const SOCKET_URL = API_BASE_URL;

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

export default {
  API_BASE_URL,
  SOCKET_URL,
  API_ENDPOINTS,
  buildURL,
};

