const express = require('express');
const { verifyToken, requireRole, checkApiAccess } = require('../middleware/authMiddleware');
const { cacheMiddleware, invalidateCache } = require('../middleware/cacheMiddleware');
const { CacheHelper } = require('../utils/cache');
const windowsController = require('../controllers/windowsController');
const router = express.Router();

// GET /api/windows - Get all windows
router.get('/', verifyToken, checkApiAccess, cacheMiddleware('windows', 'all'), windowsController.getAllWindows);

// GET /api/windows/:department - Get windows by office (department param for backward compatibility)
router.get('/:department', verifyToken, checkApiAccess, cacheMiddleware('windows', 'byDepartment'), windowsController.getWindowsByDepartment);

// POST /api/windows - Create new window
router.post('/', verifyToken, checkApiAccess, invalidateCache((req, data) => {
  const office = req.body.office || (data && data.office);
  if (office) {
    CacheHelper.invalidateWindows(office);
  } else {
    CacheHelper.invalidateWindows(); // Invalidate all if office not available
  }
}), windowsController.createWindow);

// PUT /api/windows/:id - Update window
router.put('/:id', verifyToken, checkApiAccess, invalidateCache((req, data) => {
  const office = (data && data.office) || (req.body && req.body.office);
  if (office) {
    CacheHelper.invalidateWindows(office);
  } else {
    // Get office from window before update
    // This will be handled in the route handler
    CacheHelper.invalidateWindows();
  }
}), windowsController.updateWindow);

// PATCH /api/windows/:id/toggle - Toggle window open status
router.patch('/:id/toggle', verifyToken, checkApiAccess, invalidateCache((req, data) => {
  const office = (data && data.office);
  if (office) {
    CacheHelper.invalidateWindows(office);
  } else {
    CacheHelper.invalidateWindows(); // Invalidate all if office not available
  }
}), windowsController.toggleWindow);

// DELETE /api/windows/:id - Delete window
router.delete('/:id', verifyToken, checkApiAccess, invalidateCache((req, data) => {
  const office = (data && data.window && data.window.office);
  if (office) {
    CacheHelper.invalidateWindows(office);
  } else {
    CacheHelper.invalidateWindows(); // Invalidate all if office not available
  }
}), windowsController.deleteWindow);

module.exports = router;
