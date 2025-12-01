const express = require('express');
const router = express.Router();
const { verifyToken, checkApiAccess } = require('../middleware/authMiddleware');
const transactionsController = require('../controllers/transactionsController');

// POST /api/admin/transactions/:department - Create transaction from admin side
router.post('/transactions/:department', verifyToken, checkApiAccess, transactionsController.createAdminTransaction);

// GET /api/admin/transactions/:id/details - Get full transaction details
router.get('/transactions/:id/details', verifyToken, checkApiAccess, transactionsController.getTransactionDetails);

// PATCH /api/admin/transactions/:id/status - Update transaction status and remarks
router.patch('/transactions/:id/status', verifyToken, checkApiAccess, transactionsController.updateTransactionStatus);

module.exports = router;

