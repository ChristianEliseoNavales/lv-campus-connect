const express = require('express');
const router = express.Router();
const multer = require('multer');
const streamifier = require('streamifier');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Middleware to require super admin or senior management admin
const requireSeniorManagementAccess = (req, res, next) => {
  // For development, bypass authentication
  if (process.env.NODE_ENV === 'development') {
    return next();
  }

  // In production, check for proper authentication
  const allowedRoles = ['MIS Super Admin', 'Senior Management Admin', 'Senior Management Admin Staff'];
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied. Senior Management or Super Admin access required.' });
  }
  next();
};

// Configure multer for memory storage (we'll upload to Cloudinary)
const storage = multer.memoryStorage();

// File filter for allowed types (JPG and PNG only)
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg',
    'image/png'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG and PNG are allowed.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// Error handling middleware for multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        message: 'Maximum file size is 10MB'
      });
    }
    return res.status(400).json({
      error: 'File upload error',
      message: err.message
    });
  }
  
  if (err) {
    return res.status(400).json({
      error: 'Upload error',
      message: err.message
    });
  }
  
  next();
};

// POST /api/charts/upload - Upload chart file to Cloudinary
router.post('/upload', requireSeniorManagementAccess, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded'
      });
    }

    // Upload to Cloudinary using stream
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: process.env.CLOUDINARY_CHARTS_FOLDER || 'lvcampusconnect/charts',
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png']
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

// DELETE /api/charts/delete/:publicId - Delete file from Cloudinary
router.delete('/delete/:publicId', requireSeniorManagementAccess, async (req, res) => {
  try {
    const { publicId } = req.params;

    if (!publicId) {
      return res.status(400).json({
        error: 'Public ID is required'
      });
    }

    // Decode the public ID
    const decodedPublicId = decodeURIComponent(publicId);

    // Delete from Cloudinary
    const result = await cloudinary.uploader.destroy(decodedPublicId);

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

// Apply error handling middleware
router.use(handleMulterError);

module.exports = router;

