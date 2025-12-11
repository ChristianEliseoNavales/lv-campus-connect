const express = require('express');
const router = express.Router();
const { verifyToken, requireSuperAdmin, checkApiAccess } = require('../middleware/authMiddleware');
const bulletinController = require('../controllers/bulletinController');
const asyncHandler = require('../middleware/asyncHandler');

// Note: requireSuperAdmin middleware is now imported from authMiddleware.js

// POST /api/bulletin/upload - Upload bulletin file to Cloudinary
router.post('/upload', verifyToken, checkApiAccess, bulletinController.upload.single('file'), asyncHandler(bulletinController.uploadBulletin));

// DELETE /api/bulletin/delete/:publicId - Delete file from Cloudinary
router.delete('/delete/:publicId', verifyToken, checkApiAccess, asyncHandler(bulletinController.deleteBulletin));

module.exports = router;

