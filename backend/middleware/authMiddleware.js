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
    // Populate assignedWindow for Admin Staff RBAC
    const user = await User.findById(decoded.id)
      .select('-password')
      .populate('assignedWindow', 'name office');

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
      assignedWindow: user.assignedWindow || null // Include assignedWindow for Admin Staff RBAC
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
    
    // Check for exact match or wildcard access
    const hasAccess = pageAccess.some(page => {
      if (page === '*') return true; // Wildcard access
      if (page === requiredPage) return true; // Exact match
      
      // Check if the required page starts with the allowed page (for parent routes)
      // e.g., if user has access to '/admin/registrar', they can access '/admin/registrar/queue'
      if (requiredPage.startsWith(page + '/')) return true;
      
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
 * Middleware to check if user has a specific role
 * 
 * Usage:
 * router.get('/admin/mis/database', verifyToken, requireRole('super_admin'), (req, res) => {
 *   // Only super_admin can access
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

    if (!roles.includes(req.user.role)) {
      console.log(`❌ Role check failed for ${req.user.email}. Required: ${roles.join(', ')}, Has: ${req.user.role}`);
      
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have the required role to access this resource.'
      });
    }

    next();
  };
};

/**
 * Middleware specifically for MIS Super Admin access
 *
 * Usage:
 * router.get('/admin/mis/database', verifyToken, requireSuperAdmin, (req, res) => {
 *   // Only super_admin can access
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

  if (!req.user || req.user.role !== 'MIS Super Admin') {
    return res.status(403).json({
      error: 'Access denied',
      message: 'MIS Super Admin role required.'
    });
  }

  next();
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
  '/api/transaction-logs/registrar': ['/admin/registrar/transaction-logs'],
  '/api/transaction-logs/admissions': ['/admin/admissions/transaction-logs'],

  // Bulletin API - used by MIS Bulletin page
  '/api/bulletin': ['/admin/mis/bulletin'],

  // Ratings API - used by MIS Ratings page
  '/api/ratings': ['/admin/mis/ratings'],

  // Audit Trail API - used by MIS Audit Trail page
  '/api/audit-trail': ['/admin/mis/audit-trail'],

  // Database API - used by MIS Database Manager page
  '/api/database': ['/admin/mis/database-manager'],

  // Charts API - used by Senior Management Charts page
  '/api/charts': ['/admin/seniormanagement/charts'],

  // Analytics API - used by Senior Management Charts page and Dashboard pages
  '/api/analytics': ['/admin/seniormanagement/charts', '/admin/registrar', '/admin/admissions'],
  '/api/analytics/pie-chart': ['/admin/seniormanagement/charts', '/admin/registrar', '/admin/admissions'],
  '/api/analytics/area-chart': ['/admin/seniormanagement/charts', '/admin/registrar', '/admin/admissions'],
  '/api/analytics/dashboard-stats': ['/admin/registrar', '/admin/admissions'],
  '/api/analytics/dashboard-table-data': ['/admin/registrar', '/admin/admissions'],
  '/api/analytics/queue-monitor': ['/admin/registrar/queue', '/admin/admissions/queue'],
  '/api/analytics/combined': ['/admin/seniormanagement/charts'],
  '/api/analytics/active-sessions': ['/admin/seniormanagement/charts'],
  '/api/analytics/queue-ratings-summary': ['/admin/seniormanagement/charts'],
  '/api/analytics/queue-by-department': ['/admin/seniormanagement/charts']
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
    console.log(`✅ MIS Super Admin ${req.user.email} has access to ${req.path}`);
    return next();
  }

  // Get the API path from the request (without query parameters)
  const apiPath = req.path;

  console.log(`🔍 Checking API access for ${req.user.email} to ${apiPath}`);
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
  const hasAccess = requiredPages.some(requiredPage => {
    // Check exact match
    if (pageAccess.includes(requiredPage)) {
      console.log(`   ✓ User has exact access to: ${requiredPage}`);
      return true;
    }

    // Check if user has access to parent route
    // e.g., if requiredPage is /admin/registrar/settings and user has /admin/registrar
    const hasParentAccess = pageAccess.some(userPage => requiredPage.startsWith(userPage + '/'));
    if (hasParentAccess) {
      console.log(`   ✓ User has parent access to: ${requiredPage}`);
      return true;
    }

    return false;
  });

  if (!hasAccess) {
    console.log(`❌ API access denied for ${req.user.email} to ${apiPath}`);
    console.log(`   Required pages:`, requiredPages);
    console.log(`   User's pageAccess:`, pageAccess);

    return res.status(403).json({
      error: 'Access denied',
      message: 'You do not have permission to access this resource.'
    });
  }

  console.log(`✅ API access granted for ${req.user.email} to ${apiPath}`);
  next();
};

module.exports = {
  verifyToken,
  checkPageAccess,
  requireRole,
  requireSuperAdmin,
  checkApiAccess
};

