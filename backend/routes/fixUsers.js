/**
 * Temporary Route: Fix User PageAccess
 *
 * This is a one-time fix endpoint to update all users with empty pageAccess.
 * Should be removed after fixing all users.
 */

const express = require('express');
const router = express.Router();
const { verifyToken, requireSuperAdmin } = require('../middleware/authMiddleware');
const fixUsersController = require('../controllers/fixUsersController');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * POST /api/fix-users/page-access
 * Fix all users with empty or missing pageAccess
 * Only accessible by Super Admin
 */
router.post('/page-access', verifyToken, requireSuperAdmin, asyncHandler(fixUsersController.fixUserPageAccess));

/**
 * GET /api/fix-users/check
 * Check how many users need fixing
 * Only accessible by Super Admin
 */
router.get('/check', verifyToken, requireSuperAdmin, asyncHandler(fixUsersController.checkUsers));

module.exports = router;

