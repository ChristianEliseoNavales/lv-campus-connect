const express = require('express');
const router = express.Router();
const { verifyToken, checkApiAccess } = require('../middleware/authMiddleware');
const chartsController = require('../controllers/chartsController');
const asyncHandler = require('../middleware/asyncHandler');

// Middleware to require super admin or senior management admin
const requireSeniorManagementAccess = (req, res, next) => {
  // Check if DEV_BYPASS_AUTH is enabled (development only)
  if (process.env.DEV_BYPASS_AUTH === 'true') {
    console.log('🔓 DEV_BYPASS_AUTH: Bypassing senior management access check');
    return next();
  }

  // Check for proper authentication
  const allowedRoles = ['MIS Super Admin', 'Senior Management Admin', 'Senior Management Admin Staff'];
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied. Senior Management or Super Admin access required.' });
  }
  next();
};

// POST /api/charts/upload - Upload chart file to Cloudinary
router.post('/upload', verifyToken, checkApiAccess, chartsController.upload.single('file'), asyncHandler(chartsController.uploadChart));

// DELETE /api/charts/delete/:publicId - Delete file from Cloudinary
router.delete('/delete/:publicId', verifyToken, checkApiAccess, asyncHandler(chartsController.deleteChart));

// Apply error handling middleware
router.use(chartsController.handleMulterError);

module.exports = router;

