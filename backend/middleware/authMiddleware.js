const jwt = require('jsonwebtoken');
const { User } = require('../models');

/**
 * Middleware to verify JWT token and attach user to request
 * 
 * Usage:
 * router.get('/protected-route', verifyToken, (req, res) => {
 *   // req.user is available here
 * });
 */
const verifyToken = async (req, res, next) => {
  try {
    // Check if DEV_BYPASS_AUTH is enabled (development only)
    if (process.env.DEV_BYPASS_AUTH === 'true') {
      console.log('🔓 DEV_BYPASS_AUTH: Bypassing authentication');
      req.user = {
        _id: 'dev-user-id',
        id: 'dev-user-id',
        role: 'super_admin',
        email: 'dev@test.com',
        name: 'Development User',
        office: 'MIS',
        pageAccess: ['*'], // Access to all pages
        isActive: true
      };
      return next();
    }

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No authentication token provided. Please sign in.'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      console.error('JWT verification failed:', jwtError.message);
      
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'Token expired',
          message: 'Your session has expired. Please sign in again.'
        });
      }
      
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Invalid authentication token. Please sign in again.'
      });
    }

    // Fetch user from database to ensure they still exist and are active
    // Populate assignedWindows and assignedWindow for Admin Staff RBAC
    const user = await User.findById(decoded.id)
      .select('-password')
      .populate('assignedWindows', 'name office')
      .populate('assignedWindow', 'name office'); // Keep for backward compatibility

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User account not found. Please contact the administrator.'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        error: 'Account inactive',
        message: 'Your account has been deactivated. Please contact the administrator.'
      });
    }

    // Attach user to request object
    req.user = {
      _id: user._id,
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      office: user.office,
      pageAccess: user.pageAccess || [],
      permissions: user.permissions || {},
      isActive: user.isActive,
      assignedWindows: user.assignedWindows || [], // Multiple windows support
      assignedWindow: user.assignedWindow || null // Keep for backward compatibility
    };

    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    res.status(500).json({
      error: 'Authentication error',
      message: 'An error occurred during authentication.'
    });
  }
};

/**
 * Middleware to check if user has access to a specific page/route
 * 
 * Usage:
 * router.get('/admin/mis/users', verifyToken, checkPageAccess('/admin/mis/users'), (req, res) => {
 *   // User has access to this route
 * });
 */
const checkPageAccess = (requiredPage) => {
  return (req, res, next) => {
    // Check if DEV_BYPASS_AUTH is enabled
    if (process.env.DEV_BYPASS_AUTH === 'true') {
      console.log(`🔓 DEV_BYPASS_AUTH: Bypassing page access check for ${requiredPage}`);
      return next();
    }

    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please sign in to access this resource.'
      });
    }

    // MIS Super Admin has access to everything
    if (req.user.role === 'MIS Super Admin') {
      return next();
    }

    // Check if user has access to the specific page
    const pageAccess = req.user.pageAccess || [];

    // Check for exact match or wildcard access ONLY
    // No parent route access - each page must be explicitly granted
    const hasAccess = pageAccess.some(page => {
      if (page === '*') return true; // Wildcard access (MIS Super Admin only)
      if (page === requiredPage) return true; // Exact match required

      return false;
    });

    if (!hasAccess) {
      console.log(`❌ Access denied for ${req.user.email} to ${requiredPage}`);
      console.log(`   User's pageAccess:`, pageAccess);

      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have permission to access this resource.'
      });
    }

    next();
  };
};

/**
 * Helper function to map API endpoints to required page access
 * This is used by requireRole to check pageAccess as a fallback
 */
const getRequiredPagesForApi = (req) => {
  const fullPath = req.baseUrl + req.path;

  // Map API endpoints to required pages
  const apiPageMap = {
    '/api/users': ['/admin/mis/users', '/admin/registrar/settings', '/admin/admissions/settings'],
    '/api/services': ['/admin/registrar/settings', '/admin/admissions/settings'],
    '/api/windows': ['/admin/registrar/settings', '/admin/admissions/settings', '/admin/registrar/queue', '/admin/admissions/queue'],
    '/api/settings': ['/admin/registrar/settings', '/admin/admissions/settings', '/admin/registrar/queue', '/admin/admissions/queue'],
    '/api/queue': ['/admin/registrar/queue', '/admin/admissions/queue'],
    '/api/transactions': ['/admin/registrar/transaction-logs', '/admin/admissions/transaction-logs'],
    '/api/analytics': ['/admin/seniormanagement/charts', '/admin/registrar', '/admin/admissions'],
    '/api/bulletin': ['/admin/mis/bulletin'],
    '/api/ratings': ['/admin/mis/ratings'],
    '/api/audit': ['/admin/mis/audit-trail'],
    '/api/database': ['/admin/mis/database-manager'],
    '/api/charts': ['/admin/seniormanagement/charts']
  };

  // Find matching pages for this API endpoint
  for (const [apiPath, pages] of Object.entries(apiPageMap)) {
    if (fullPath.startsWith(apiPath)) {
      return pages;
    }
  }

  return null;
};

/**
 * Middleware to check if user has a specific role OR page access
 * Enhanced to support dynamic pageAccess alongside role-based checks
 *
 * Usage:
 * router.get('/admin/mis/database', verifyToken, requireRole('super_admin'), (req, res) => {
 *   // User needs either the role OR access to the page that uses this API
 * });
 */
const requireRole = (allowedRoles) => {
  // Convert single role to array
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req, res, next) => {
    // Check if DEV_BYPASS_AUTH is enabled
    if (process.env.DEV_BYPASS_AUTH === 'true') {
      console.log(`🔓 DEV_BYPASS_AUTH: Bypassing role check for ${roles.join(', ')}`);
      return next();
    }

    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please sign in to access this resource.'
      });
    }

    // MIS Super Admin always has access
    if (req.user.role === 'MIS Super Admin') {
      return next();
    }

    // Check if user has the required role
    const hasRole = roles.includes(req.user.role);

    if (hasRole) {
      return next();
    }

    // If role check failed, check pageAccess as fallback
    const requiredPages = getRequiredPagesForApi(req);

    if (requiredPages && req.user.pageAccess && req.user.pageAccess.length > 0) {
      const hasPageAccess = requiredPages.some(requiredPage => {
        return req.user.pageAccess.some(userPage => {
          // Exact match only - no parent route access
          if (userPage === requiredPage) return true;
          return false;
        });
      });

      if (hasPageAccess) {
        // Only log in development to prevent spam
        if (process.env.NODE_ENV === 'development' || process.env.LOG_LEVEL === 'debug') {
          console.log(`✅ Page access granted for ${req.user.email} to ${req.baseUrl}${req.path}`);
        }
        return next();
      }
    }

    console.error(`❌ Role access denied for ${req.user.email}`);
    console.error(`   User role: ${req.user.role}`);
    console.error(`   Required roles:`, roles);
    console.error(`   Required pages:`, requiredPages);
    console.error(`   User's pageAccess:`, req.user.pageAccess);

    return res.status(403).json({
      error: 'Access denied',
      message: 'You do not have the required permissions to access this resource.',
      details: process.env.NODE_ENV === 'development' ? {
        requiredRoles: roles,
        requiredPages,
        userPageAccess: req.user.pageAccess,
        userRole: req.user.role
      } : undefined
    });
  };
};

/**
 * Middleware specifically for MIS Super Admin access OR page access
 * Enhanced to support dynamic pageAccess alongside role-based checks
 *
 * Usage:
 * router.get('/admin/mis/database', verifyToken, requireSuperAdmin, (req, res) => {
 *   // User needs either MIS Super Admin role OR access to the page that uses this API
 * });
 */
const requireSuperAdmin = (req, res, next) => {
  // Check if DEV_BYPASS_AUTH is enabled
  if (process.env.DEV_BYPASS_AUTH === 'true') {
    console.log('🔓 DEV_BYPASS_AUTH: Bypassing super admin check');
    req.user = req.user || {
      _id: 'dev-user-id',
      id: 'dev-user-id',
      role: 'MIS Super Admin',
      accessLevel: 'super_admin',
      email: 'dev@test.com',
      name: 'Development User',
      office: 'MIS'
    };
    return next();
  }

  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please sign in to access this resource.'
    });
  }

  // Check if user is MIS Super Admin
  if (req.user.role === 'MIS Super Admin') {
    return next();
  }

  // If not Super Admin, check pageAccess as fallback
  const requiredPages = getRequiredPagesForApi(req);

  if (requiredPages && req.user.pageAccess && req.user.pageAccess.length > 0) {
    const hasPageAccess = requiredPages.some(requiredPage => {
      return req.user.pageAccess.some(userPage => {
        // Exact match only - no parent route access
        if (userPage === requiredPage) return true;
        return false;
      });
    });

    if (hasPageAccess) {
      // Only log in development to prevent spam
      if (process.env.NODE_ENV === 'development' || process.env.LOG_LEVEL === 'debug') {
        console.log(`✅ Page access granted for ${req.user.email} to ${req.baseUrl}${req.path}`);
      }
      return next();
    }
  }

  console.error(`❌ Super Admin access denied for ${req.user.email}`);
  console.error(`   User role: ${req.user.role}`);
  console.error(`   Required pages:`, requiredPages);
  console.error(`   User's pageAccess:`, req.user.pageAccess);

  return res.status(403).json({
    error: 'Access denied',
    message: 'You do not have the required permissions to access this resource.',
    details: process.env.NODE_ENV === 'development' ? {
      requiredPages,
      userPageAccess: req.user.pageAccess,
      userRole: req.user.role
    } : undefined
  });
};

/**
 * API endpoint to page access mapping
 * Maps API endpoints to the frontend pages that use them
 */
const API_PAGE_MAPPING = {
  // Users API - used by MIS Users page and Settings pages
  '/api/users': ['/admin/mis/users', '/admin/registrar/settings', '/admin/admissions/settings'],

  // Services API - used by Settings pages
  '/api/services': ['/admin/registrar/settings', '/admin/admissions/settings'],
  '/api/services/registrar': ['/admin/registrar/settings'],
  '/api/services/admissions': ['/admin/admissions/settings'],

  // Windows API - used by Settings pages and Queue pages
  '/api/windows': ['/admin/registrar/settings', '/admin/admissions/settings', '/admin/registrar/queue', '/admin/admissions/queue'],
  '/api/windows/registrar': ['/admin/registrar/settings', '/admin/registrar/queue'],
  '/api/windows/admissions': ['/admin/admissions/settings', '/admin/admissions/queue'],

  // Settings API - used by Settings pages and Queue pages
  '/api/settings': ['/admin/registrar/settings', '/admin/admissions/settings'],
  '/api/settings/queue/registrar': ['/admin/registrar/settings', '/admin/registrar/queue'],
  '/api/settings/queue/admissions': ['/admin/admissions/settings', '/admin/admissions/queue'],
  '/api/settings/location/registrar': ['/admin/registrar/settings'],
  '/api/settings/location/admissions': ['/admin/admissions/settings'],

  // Queue API - used by Queue pages
  '/api/queue': ['/admin/registrar/queue', '/admin/admissions/queue'],
  '/api/queue/registrar': ['/admin/registrar/queue'],
  '/api/queue/admissions': ['/admin/admissions/queue'],

  // Transaction Logs API - used by Transaction Logs pages
  '/api/transactions': ['/admin/registrar/transaction-logs', '/admin/admissions/transaction-logs'],
  '/api/transactions/registrar': ['/admin/registrar/transaction-logs'],
  '/api/transactions/admissions': ['/admin/admissions/transaction-logs'],
  '/api/transaction-logs/registrar': ['/admin/registrar/transaction-logs'],
  '/api/transaction-logs/admissions': ['/admin/admissions/transaction-logs'],

  // Bulletin API - used by MIS Bulletin page
  '/api/bulletin': ['/admin/mis/bulletin'],

  // FAQ API - used by all office FAQ pages (same component, different routes)
  '/api/faq': ['/admin/mis/faq', '/admin/registrar/faq', '/admin/admissions/faq', '/admin/seniormanagement/faq'],

  // Ratings API - used by MIS Ratings page
  '/api/ratings': ['/admin/mis/ratings'],

  // Audit Trail API - used by MIS Audit Trail page
  '/api/audit-trail': ['/admin/mis/audit-trail'],

  // Database API - used by MIS Database Manager page and Senior Management Charts page
  '/api/database': ['/admin/mis/database-manager', '/admin/seniormanagement/charts'],

  // Charts API - used by Senior Management Charts page
  '/api/charts': ['/admin/seniormanagement/charts'],

  // Analytics API - used by Senior Management Charts page and Dashboard pages
  '/api/analytics': ['/admin/seniormanagement/charts', '/admin/registrar', '/admin/admissions'],
  '/api/analytics/pie-chart': ['/admin/seniormanagement/charts', '/admin/registrar', '/admin/admissions'],
  '/api/analytics/pie-chart/registrar': ['/admin/registrar'],
  '/api/analytics/pie-chart/admissions': ['/admin/admissions'],
  '/api/analytics/area-chart': ['/admin/seniormanagement/charts', '/admin/registrar', '/admin/admissions'],
  '/api/analytics/area-chart/registrar': ['/admin/registrar'],
  '/api/analytics/area-chart/admissions': ['/admin/admissions'],
  '/api/analytics/dashboard-stats': ['/admin/registrar', '/admin/admissions'],
  '/api/analytics/dashboard-stats/registrar': ['/admin/registrar'],
  '/api/analytics/dashboard-stats/admissions': ['/admin/admissions'],
  '/api/analytics/dashboard-table-data': ['/admin/registrar', '/admin/admissions'],
  '/api/analytics/dashboard-table-data/registrar': ['/admin/registrar'],
  '/api/analytics/dashboard-table-data/admissions': ['/admin/admissions'],
  '/api/analytics/queue-monitor': ['/admin/registrar/queue', '/admin/admissions/queue'],
  '/api/analytics/queue-monitor/registrar': ['/admin/registrar/queue'],
  '/api/analytics/queue-monitor/admissions': ['/admin/admissions/queue'],
  '/api/analytics/combined': ['/admin/seniormanagement/charts'],
  '/api/analytics/active-sessions': ['/admin/seniormanagement/charts'],
  '/api/analytics/queue-ratings-summary': ['/admin/seniormanagement/charts'],
  '/api/analytics/queue-by-department': ['/admin/seniormanagement/charts'],

  // Public Queue Management API - used by Queue pages (admin interface)
  '/api/public/queue-data': ['/admin/registrar/queue', '/admin/admissions/queue'],
  '/api/public/queue-data/registrar': ['/admin/registrar/queue'],
  '/api/public/queue-data/admissions': ['/admin/admissions/queue'],
  '/api/public/queue/next': ['/admin/registrar/queue', '/admin/admissions/queue'],
  '/api/public/queue/skip': ['/admin/registrar/queue', '/admin/admissions/queue'],
  '/api/public/queue/complete': ['/admin/registrar/queue', '/admin/admissions/queue'],
  '/api/public/queue/transfer': ['/admin/registrar/queue', '/admin/admissions/queue'],
  '/api/public/queue/recall': ['/admin/registrar/queue', '/admin/admissions/queue'],
  '/api/public/queue/windows': ['/admin/registrar/queue', '/admin/admissions/queue'],
  '/api/public/queue/skipped': ['/admin/registrar/queue', '/admin/admissions/queue']
};

/**
 * Middleware to check API access based on pageAccess
 * This replaces role-based checks with dynamic pageAccess checks
 *
 * Usage:
 * router.get('/api/services/registrar', verifyToken, checkApiAccess, (req, res) => {
 *   // User has access if they have access to any page that uses this API
 * });
 */
const checkApiAccess = (req, res, next) => {
  // Check if DEV_BYPASS_AUTH is enabled
  if (process.env.DEV_BYPASS_AUTH === 'true') {
    console.log('🔓 DEV_BYPASS_AUTH: Bypassing API access check');
    return next();
  }

  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please sign in to access this resource.'
    });
  }

  // MIS Super Admin has access to everything
  if (req.user.role === 'MIS Super Admin') {
    return next();
  }

  // Get the full API path from the request (baseUrl + path)
  // e.g., baseUrl = '/api/users', path = '/' => fullPath = '/api/users'
  // e.g., baseUrl = '/api/users', path = '/:id' => fullPath = '/api/users/:id'
  const apiPath = req.baseUrl + req.path;

  console.log(`🔍 Checking API access for ${req.user.email} to ${apiPath}`);
  console.log(`   baseUrl: ${req.baseUrl}, path: ${req.path}`);
  console.log(`   User role: ${req.user.role}, Office: ${req.user.office}`);
  console.log(`   User pageAccess:`, req.user.pageAccess);

  // Find matching API mapping (check for exact match first, then prefix match)
  let requiredPages = null;
  let matchedPath = null;

  // Try exact match first
  if (API_PAGE_MAPPING[apiPath]) {
    requiredPages = API_PAGE_MAPPING[apiPath];
    matchedPath = apiPath;
    console.log(`   ✓ Found exact match: ${matchedPath}`);
  } else {
    // Try prefix match (for dynamic routes like /api/users/:id)
    for (const [mappedPath, pages] of Object.entries(API_PAGE_MAPPING)) {
      if (apiPath.startsWith(mappedPath + '/') || apiPath === mappedPath) {
        requiredPages = pages;
        matchedPath = mappedPath;
        console.log(`   ✓ Found prefix match: ${matchedPath}`);
        break;
      }
    }
  }

  // If no mapping found, deny access (fail-safe)
  if (!requiredPages) {
    console.log(`❌ No API mapping found for ${apiPath}`);
    return res.status(403).json({
      error: 'Access denied',
      message: 'You do not have permission to access this resource.'
    });
  }

  console.log(`   Required pages for ${matchedPath}:`, requiredPages);

  // Check if user has access to at least one of the required pages
  const pageAccess = req.user.pageAccess || [];

  // Check if user is Admin Staff (role includes "Admin Staff")
  const isAdminStaff = req.user.role?.includes('Admin Staff');

  const hasAccess = requiredPages.some(requiredPage => {
    // Check exact match first
    if (pageAccess.includes(requiredPage)) {
      console.log(`   ✓ User has exact access to: ${requiredPage}`);
      return true;
    }

    // For Admin roles (NOT Admin Staff), allow parent route access
    // e.g., if user has /admin/registrar, they can access APIs requiring /admin/registrar/settings
    if (!isAdminStaff) {
      const parentRoute = requiredPage.substring(0, requiredPage.lastIndexOf('/'));
      if (parentRoute && pageAccess.includes(parentRoute)) {
        console.log(`   ✓ User has parent route access: ${parentRoute} (for ${requiredPage})`);
        return true;
      }
    }

    return false;
  });

  if (!hasAccess) {
    console.error(`❌ API access denied for ${req.user.email} to ${apiPath}`);
    console.error(`   User role: ${req.user.role}`);
    console.error(`   Required pages:`, requiredPages);
    console.error(`   User's pageAccess:`, pageAccess);
    console.error(`   Full API path: ${req.baseUrl}${req.path}`);

    return res.status(403).json({
      error: 'Access denied',
      message: 'You do not have permission to access this resource.',
      details: process.env.NODE_ENV === 'development' ? {
        requiredPages,
        userPageAccess: pageAccess,
        userRole: req.user.role
      } : undefined
    });
  }

  // Only log in development to prevent spam
  if (process.env.NODE_ENV === 'development' || process.env.LOG_LEVEL === 'debug') {
    console.log(`✅ API access granted for ${req.user.email} to ${apiPath}`);
  }
  next();
};

module.exports = {
  verifyToken,
  checkPageAccess,
  requireRole,
  requireSuperAdmin,
  checkApiAccess
};

