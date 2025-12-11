const express = require('express');
const router = express.Router();
const { verifyToken, requireRole, checkApiAccess } = require('../middleware/authMiddleware');
const transactionsController = require('../controllers/transactionsController');
const asyncHandler = require('../middleware/asyncHandler');

// GET /api/transactions/:department - Get transaction logs for a department
router.get('/:department', verifyToken, checkApiAccess, asyncHandler(transactionsController.getTransactionsByDepartment));

// PATCH /api/transactions/:id/remarks - Update remarks for a transaction
router.patch('/:id/remarks', verifyToken, checkApiAccess, asyncHandler(transactionsController.updateTransactionRemarks));

module.exports = router;
