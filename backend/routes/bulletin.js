const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const { verifyToken, requireSuperAdmin } = require('../middleware/authMiddleware');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure multer for memory storage (we'll upload to Cloudinary)
const storage = multer.memoryStorage();

// File filter for allowed types
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'application/pdf',
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-ms-wmv'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, PDF, MP4, MOV, AVI, and WMV are allowed.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
});

// Note: requireSuperAdmin middleware is now imported from authMiddleware.js

// POST /api/bulletin/upload - Upload bulletin file to Cloudinary
router.post('/upload', verifyToken, requireSuperAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded'
      });
    }

    // Upload to Cloudinary using stream
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: process.env.CLOUDINARY_UPLOAD_FOLDER || 'lvcampusconnect/bulletin',
        resource_type: 'auto',
        allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'mp4', 'mov', 'avi', 'wmv']
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          return res.status(500).json({
            error: 'File upload failed',
            message: error.message
          });
        }

        // Return Cloudinary response data
        res.json({
          success: true,
          public_id: result.public_id,
          secure_url: result.secure_url,
          url: result.url,
          resource_type: result.resource_type,
          size: result.bytes,
          mimetype: req.file.mimetype,
          originalName: req.file.originalname,
          filename: result.public_id.split('/').pop()
        });
      }
    );

    // Stream the file buffer to Cloudinary
    streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: 'File upload failed',
      message: error.message
    });
  }
});

// DELETE /api/bulletin/delete/:publicId - Delete file from Cloudinary
router.delete('/delete/:publicId', verifyToken, requireSuperAdmin, async (req, res) => {
  try {
    const { publicId } = req.params;

    if (!publicId) {
      return res.status(400).json({
        error: 'Public ID is required'
      });
    }

    // Delete from Cloudinary
    const result = await cloudinary.uploader.destroy(publicId);

    if (result.result === 'ok') {
      res.json({
        success: true,
        message: 'File deleted successfully from Cloudinary'
      });
    } else {
      res.status(400).json({
        error: 'Failed to delete file from Cloudinary',
        details: result
      });
    }
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({
      error: 'File deletion failed',
      message: error.message
    });
  }
});

module.exports = router;

