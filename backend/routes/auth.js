const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');

// Rate limiting for authentication endpoints
// 5 attempts per 15 minutes per IP address
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 50 : 100, // Temporarily increased for testing, relaxed in development
  message: {
    error: 'Too many authentication attempts',
    message: 'Please try again after 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/auth/google
 * Verify Google OAuth token and authenticate user
 */
router.post('/google', authLimiter, authController.googleAuth);

/**
 * GET /api/auth/verify
 * Verify JWT token and return user data
 */
router.get('/verify', authController.verifyToken);

/**
 * POST /api/auth/logout
 * Logout user (mainly for audit trail)
 */
router.post('/logout', authController.logout);

/**
 * GET /api/auth/debug/permissions
 * Debug endpoint to check current user's permissions
 * Only available in development mode
 */
router.get('/debug/permissions', authController.debugPermissions);

module.exports = router;

