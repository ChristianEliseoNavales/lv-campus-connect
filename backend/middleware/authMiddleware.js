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

module.exports = {
  verifyToken,
  checkPageAccess,
  requireRole,
  requireSuperAdmin
};

