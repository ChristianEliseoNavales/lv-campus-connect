const express = require('express');
const rateLimit = require('express-rate-limit');
const { verifyToken } = require('../middleware/authMiddleware');
const { cacheMiddleware } = require('../middleware/cacheMiddleware');
const { CacheKeys } = require('../utils/cache');
const publicController = require('../controllers/publicController');
const router = express.Router();

// Rate limiting for public endpoints
const publicLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'production' ? 100 : 200, // 100 requests per minute in production, 200 in development
  message: {
    error: 'Too many requests',
    message: 'Too many requests from this IP, please try again after a minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /api/public/queue/:department - Get queue data for department
router.get('/queue/:department', publicLimiter, publicController.getQueueData);

// GET /api/public/services/:department - Get visible services for department
router.get('/services/:department', publicLimiter, cacheMiddleware('services', 'publicServices', (req) => {
  return CacheKeys.public.services(req.params.department);
}), publicController.getServices);

// GET /api/public/office-status/:department - Check if office is open
router.get('/office-status/:department', publicController.getOfficeStatus);

// GET /api/public/location/:department - Get department location
router.get('/location/:department', publicLimiter, cacheMiddleware('settings', 'location', (req) => {
  return CacheKeys.settings.location(req.params.department);
}), publicController.getLocation);

// GET /api/public/windows/:department - Get active windows for department
router.get('/windows/:department', publicLimiter, cacheMiddleware('windows', 'publicWindows', (req) => {
  return CacheKeys.public.windows(req.params.department);
}), publicController.getWindows);

// POST /api/public/queue - Submit new queue entry
router.post('/queue', publicController.submitQueue);

// GET /api/public/queue-data/:department - Get queue data for admin interface
router.get('/queue-data/:department', publicController.getQueueDataForAdmin);

// GET /api/public/queue-lookup/:id - Get queue details by ID for QR code scanning
router.get('/queue-lookup/:id', publicController.getQueueLookup);

// POST /api/public/queue/:id/rating - Submit rating for a queue entry
router.post('/queue/:id/rating', publicController.submitQueueRating);

// ==========================================
// QUEUE MANAGEMENT ENDPOINTS FOR ADMIN
// ==========================================

// POST /api/public/queue/next - Call next queue number for a window
router.post('/queue/next', publicController.callNextQueue);

// POST /api/public/queue/recall - Recall current serving queue number
router.post('/queue/recall', publicController.recallQueue);

// POST /api/public/queue/stop - Toggle window serving status (pause/resume)
router.post('/queue/stop', publicController.toggleWindowServing);

// POST /api/public/queue/previous - Go back to previously served queue
router.post('/queue/previous', publicController.recallPreviousQueue);

// POST /api/public/queue/transfer - Transfer current queue to another window
router.post('/queue/transfer', publicController.transferQueue);

// POST /api/public/queue/skip - Skip current queue and call next
router.post('/queue/skip', publicController.skipQueue);

// POST /api/public/queue/requeue-all - Re-queue all skipped queues for a window/service
router.post('/queue/requeue-all', verifyToken, publicController.requeueAllSkipped);

// POST /api/public/queue/requeue-selected - Re-queue selected skipped queue numbers
router.post('/queue/requeue-selected', verifyToken, publicController.requeueSelectedSkipped);

// GET /api/public/queue/windows/:department - Get available windows for transfer
router.get('/queue/windows/:department', publicController.getWindowsForTransfer);

// ==========================================
// PUBLIC KIOSK DATA ENDPOINTS
// ==========================================

// GET /api/public/bulletin - Get all bulletins for kiosk display
router.get('/bulletin', publicController.getBulletins);

// GET /api/public/faq - Get all active FAQs for kiosk display (with optional pagination)
router.get('/faq', publicLimiter, publicController.getFAQs);

// GET /api/public/office - Get all offices for directory display
router.get('/office', publicLimiter, publicController.getOffices);

// GET /api/public/chart - Get all charts for directory display
router.get('/chart', publicController.getCharts);

module.exports = router;
