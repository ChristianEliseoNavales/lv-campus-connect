const express = require('express');
const { verifyToken, requireRole, checkApiAccess } = require('../middleware/authMiddleware');
const { cacheMiddleware, invalidateCache } = require('../middleware/cacheMiddleware');
const { CacheHelper, CacheKeys } = require('../utils/cache');
const servicesController = require('../controllers/servicesController');
const router = express.Router();

// GET /api/services - Get all services (with optional pagination)
router.get('/', verifyToken, checkApiAccess, cacheMiddleware('services', 'all'), servicesController.getAllServices);

// GET /api/services/:department - Get services by office (department param for backward compatibility)
router.get('/:department', verifyToken, checkApiAccess, cacheMiddleware('services', 'byDepartment'), servicesController.getServicesByDepartment);

// GET /api/services/:department/active - Get active services by office (department param for backward compatibility)
router.get('/:department/active', verifyToken, checkApiAccess, cacheMiddleware('services', 'activeByDepartment'), servicesController.getActiveServicesByDepartment);

// POST /api/services - Create new service
router.post('/', verifyToken, checkApiAccess, invalidateCache((req, data) => {
  const office = req.body.office || (data && data.office);
  if (office) {
    CacheHelper.invalidateServices(office);
  } else {
    CacheHelper.invalidateServices(); // Invalidate all if office not available
  }
}), servicesController.createService);

// PATCH /api/services/:id/toggle - Toggle service active status
router.patch('/:id/toggle', verifyToken, checkApiAccess, invalidateCache((req, data) => {
  const office = data && data.office;
  if (office) {
    CacheHelper.invalidateServices(office);
  } else {
    // If office not in response, get it from service before toggling
    // This will be handled in the route handler, but we invalidate all to be safe
    CacheHelper.invalidateServices();
  }
}), servicesController.toggleService);

// DELETE /api/services/:id - Delete service
router.delete('/:id', verifyToken, checkApiAccess, invalidateCache((req, data) => {
  const office = data && data.service && data.service.office;
  if (office) {
    CacheHelper.invalidateServices(office);
  } else {
    CacheHelper.invalidateServices(); // Invalidate all if office not available
  }
}), servicesController.deleteService);

module.exports = router;
