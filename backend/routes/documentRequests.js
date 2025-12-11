const express = require('express');
const router = express.Router();
const documentRequestController = require('../controllers/documentRequestController');
const { verifyToken, requireRole, checkApiAccess } = require('../middleware/authMiddleware');
const asyncHandler = require('../middleware/asyncHandler');

// Public route - create document request from kiosk
router.post('/public/document-request', asyncHandler(documentRequestController.createDocumentRequest));

// Admin routes - require authentication and page access (with role fallback)
router.get(
  '/document-requests/registrar',
  verifyToken,
  requireRole(['MIS Super Admin', 'Registrar Admin']),
  checkApiAccess,
  asyncHandler(documentRequestController.getDocumentRequests)
);

router.get(
  '/document-requests/registrar/:id',
  verifyToken,
  requireRole(['MIS Super Admin', 'Registrar Admin']),
  checkApiAccess,
  asyncHandler(documentRequestController.getDocumentRequestById)
);

router.patch(
  '/document-requests/registrar/:id/approve',
  verifyToken,
  requireRole(['MIS Super Admin', 'Registrar Admin']),
  checkApiAccess,
  asyncHandler(documentRequestController.approveDocumentRequest)
);

router.patch(
  '/document-requests/registrar/:id/reject',
  verifyToken,
  requireRole(['MIS Super Admin', 'Registrar Admin']),
  checkApiAccess,
  asyncHandler(documentRequestController.rejectDocumentRequest)
);

router.post(
  '/document-requests/registrar',
  verifyToken,
  requireRole(['MIS Super Admin', 'Registrar Admin']),
  checkApiAccess,
  asyncHandler(documentRequestController.createAdminDocumentRequest)
);

module.exports = router;
