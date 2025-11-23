const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { User } = require('../models');
const { AuditService } = require('../middleware/auditMiddleware');
const { getDefaultPageAccess, getOfficeForRole } = require('../utils/rolePermissions');

// Initialize Google OAuth2 Client
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * POST /api/auth/google
 * Verify Google OAuth token and authenticate user
 */
async function googleAuth(req, res, next) {
  try {
    const { credential } = req.body;

    if (!credential) {
      await AuditService.logAuth({
        action: 'LOGIN_FAILED',
        email: 'unknown',
        req,
        success: false,
        errorMessage: 'No credential provided'
      });

      return res.status(400).json({
        success: false,
        error: 'No credential provided'
      });
    }

    // Verify Google ID token
    let ticket;
    try {
      ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
    } catch (verifyError) {
      console.error('Google token verification failed:', verifyError);
      
      await AuditService.logAuth({
        action: 'LOGIN_FAILED',
        email: 'unknown',
        req,
        success: false,
        errorMessage: 'Invalid Google token'
      });

      return res.status(401).json({
        success: false,
        error: 'Invalid Google token',
        message: 'Failed to verify your Google account. Please try again.'
      });
    }

    // Extract user information from verified token
    const payload = ticket.getPayload();
    const { email, name, sub: googleId, picture } = payload;

    console.log('✅ Google token verified for:', email);

    // Check if user exists in database
    let user = await User.findOne({ email })
      .select('-password')
      .populate('assignedWindows', 'name office')
      .populate('assignedWindow', 'name office'); // Keep for backward compatibility

    if (!user) {
      console.log('❌ User not found in database:', email);
      
      await AuditService.logAuth({
        action: 'LOGIN_FAILED',
        email,
        req,
        success: false,
        errorMessage: 'User not registered in system'
      });

      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'Your email is not registered in the system. Please contact the administrator.'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      console.log('❌ User account is inactive:', email);

      await AuditService.logAuth({
        action: 'LOGIN_FAILED',
        user, // Pass the user object so we have userId and office
        email,
        req,
        success: false,
        errorMessage: 'User account is inactive'
      });

      return res.status(403).json({
        success: false,
        error: 'Account inactive',
        message: 'Your account has been deactivated. Please contact the administrator.'
      });
    }

    // Update user's Google ID and profile picture if not set
    let userUpdated = false;
    if (!user.googleId) {
      user.googleId = googleId;
      userUpdated = true;
    }
    if (picture && (!user.profilePicture || user.profilePicture !== picture)) {
      user.profilePicture = picture;
      userUpdated = true;
    }

    // Ensure pageAccess is populated with default routes for the role
    // This handles cases where users were created before pageAccess was properly set
    if (!user.pageAccess || user.pageAccess.length === 0) {
      user.pageAccess = getDefaultPageAccess(user.role);
      userUpdated = true;
      console.log(`📝 Auto-populated pageAccess for ${user.email} (${user.role}):`, user.pageAccess);
    }

    // Ensure office is set correctly for the role
    if (!user.office) {
      user.office = getOfficeForRole(user.role);
      userUpdated = true;
      console.log(`📝 Auto-populated office for ${user.email}: ${user.office}`);
    }

    // Update last login timestamp
    user.lastLogin = new Date();
    userUpdated = true;

    if (userUpdated) {
      await user.save();
      console.log(`✅ User data updated for ${user.email}`);
    }

    // Log successful login details (only in development/debug mode)
    if (process.env.NODE_ENV === 'development' || process.env.LOG_LEVEL === 'debug') {
      console.log(`🔐 User logged in: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Office: ${user.office}`);
      console.log(`   PageAccess:`, user.pageAccess);
    }

    // Generate JWT token with pageAccess
    const jwtPayload = {
      id: user._id,
      email: user.email,
      role: user.role,
      office: user.office,
      pageAccess: user.pageAccess || []
    };

    const token = jwt.sign(
      jwtPayload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );

    // Log successful authentication
    await AuditService.logAuth({
      action: 'LOGIN',
      userId: user._id,
      email: user.email,
      req,
      success: true,
      metadata: {
        role: user.role,
        office: user.office,
        loginMethod: 'google_sso'
      }
    });

    console.log('✅ User authenticated successfully:', email);

    // Return user data (excluding sensitive fields)
    const userData = {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      office: user.office,
      department: user.office, // Alias for compatibility
      pageAccess: user.pageAccess || [],
      permissions: user.permissions || {},
      profilePicture: user.profilePicture,
      isActive: user.isActive,
      lastLogin: user.lastLogin,
      assignedWindows: user.assignedWindows || [], // Multiple windows support
      assignedWindow: user.assignedWindow || null // Keep for backward compatibility
    };

    res.json({
      success: true,
      token,
      user: userData
    });

  } catch (error) {
    console.error('Authentication error:', error);

    await AuditService.logAuth({
      action: 'LOGIN_FAILED',
      email: req.body.email || 'unknown',
      req,
      success: false,
      errorMessage: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Authentication failed',
      message: 'An error occurred during authentication. Please try again.'
    });
  }
}

/**
 * GET /api/auth/verify
 * Verify JWT token and return user data
 */
async function verifyToken(req, res, next) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      console.error('JWT verification failed:', jwtError.message);
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
        message: 'Your session has expired. Please sign in again.'
      });
    }

    // Fetch fresh user data from database with assignedWindows populated
    const user = await User.findById(decoded.id)
      .select('-password -googleId')
      .populate('assignedWindows', 'name office')
      .populate('assignedWindow', 'name office'); // Keep for backward compatibility

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        error: 'Account inactive',
        message: 'Your account has been deactivated.'
      });
    }

    // Ensure pageAccess is populated (in case user was created before this was implemented)
    let pageAccess = user.pageAccess || [];
    let userUpdated = false;

    if (pageAccess.length === 0) {
      pageAccess = getDefaultPageAccess(user.role);
      userUpdated = true;
      console.log(`📝 Auto-populated pageAccess for ${user.email} (${user.role}) during token verification`);

      // Update user in database immediately (not in background)
      try {
        await User.findByIdAndUpdate(user._id, { pageAccess });
        console.log(`✅ Successfully updated pageAccess for ${user.email}:`, pageAccess);
      } catch (updateError) {
        console.error('❌ Failed to update pageAccess:', updateError);
      }
    }

    // Log verification for debugging (only in development/debug mode)
    if (process.env.NODE_ENV === 'development' || process.env.LOG_LEVEL === 'debug') {
      console.log(`🔍 Token verified for ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Office: ${user.office}`);
      console.log(`   PageAccess:`, pageAccess);
    }

    // Return user data
    const userData = {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      office: user.office,
      department: user.office, // Alias for compatibility
      pageAccess: pageAccess,
      permissions: user.permissions || {},
      profilePicture: user.profilePicture,
      isActive: user.isActive,
      lastLogin: user.lastLogin,
      assignedWindows: user.assignedWindows || [], // Multiple windows support
      assignedWindow: user.assignedWindow || null // Keep for backward compatibility
    };

    res.json({
      success: true,
      user: userData
    });

  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Verification failed',
      message: 'An error occurred during token verification.'
    });
  }
}

/**
 * POST /api/auth/logout
 * Logout user (mainly for audit trail)
 */
async function logout(req, res, next) {
  try {
    // Extract token to get user info for audit trail
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Log logout event
        await AuditService.logAuth({
          action: 'LOGOUT',
          userId: decoded.id,
          email: decoded.email,
          req,
          success: true
        });
      } catch (jwtError) {
        // Token invalid or expired, but still allow logout
        console.log('Logout with invalid/expired token');
      }
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout error:', error);
    // Still return success even if audit logging fails
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  }
}

/**
 * GET /api/auth/debug/permissions
 * Debug endpoint to check current user's permissions
 * Only available in development mode
 */
async function debugPermissions(req, res, next) {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production' && process.env.LOG_LEVEL !== 'debug') {
      return res.status(403).json({
        error: 'Debug endpoints are disabled in production'
      });
    }

    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'No token provided'
      });
    }

    const token = authHeader.substring(7);

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      return res.status(401).json({
        error: 'Invalid or expired token',
        details: jwtError.message
      });
    }

    // Fetch user from database
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Get expected pageAccess for this role
    const expectedPageAccess = getDefaultPageAccess(user.role);

    res.json({
      success: true,
      user: {
        email: user.email,
        name: user.name,
        role: user.role,
        office: user.office,
        isActive: user.isActive
      },
      permissions: {
        currentPageAccess: user.pageAccess || [],
        expectedPageAccess: expectedPageAccess,
        hasCorrectAccess: JSON.stringify(user.pageAccess) === JSON.stringify(expectedPageAccess),
        missingPages: expectedPageAccess.filter(page => !(user.pageAccess || []).includes(page)),
        extraPages: (user.pageAccess || []).filter(page => !expectedPageAccess.includes(page))
      },
      tokenPayload: decoded
    });
  } catch (error) {
    console.error('Debug permissions error:', error);
    res.status(500).json({
      error: 'Server error',
      details: error.message
    });
  }
}

module.exports = {
  googleAuth,
  verifyToken,
  logout,
  debugPermissions
};


