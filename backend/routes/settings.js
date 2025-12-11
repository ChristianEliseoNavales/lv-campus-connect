const express = require('express');
const router = express.Router();
const { verifyToken, checkApiAccess } = require('../middleware/authMiddleware');
const { cacheMiddleware, invalidateCache } = require('../middleware/cacheMiddleware');
const { CacheHelper } = require('../utils/cache');
const settingsController = require('../controllers/settingsController');
const asyncHandler = require('../middleware/asyncHandler');

// GET /api/settings - Get all settings
router.get('/', verifyToken, checkApiAccess, cacheMiddleware('settings', 'all'), asyncHandler(settingsController.getAllSettings));

// GET /api/settings/queue/:department - Get queue settings for specific department
router.get('/queue/:department', verifyToken, checkApiAccess, cacheMiddleware('settings', 'queue'), asyncHandler(settingsController.getQueueSettings));

// PUT /api/settings/queue/:department/toggle - Toggle queue system for department
router.put('/queue/:department/toggle', verifyToken, checkApiAccess, invalidateCache((req) => {
  CacheHelper.invalidateSettings(req.params.department);
}), asyncHandler(settingsController.toggleQueueSystem));

// PUT /api/settings - Update settings
router.put('/', verifyToken, checkApiAccess, invalidateCache(() => {
  CacheHelper.invalidateSettings();
}), asyncHandler(settingsController.updateSettings));

// PUT /api/settings/location/:department - Update department location
router.put('/location/:department', verifyToken, checkApiAccess, invalidateCache((req) => {
  CacheHelper.invalidateSettings(req.params.department);
}), asyncHandler(settingsController.updateLocation));

// GET /api/settings/location/:department - Get department location
router.get('/location/:department', verifyToken, checkApiAccess, cacheMiddleware('settings', 'location'), asyncHandler(settingsController.getLocation));

module.exports = router;
