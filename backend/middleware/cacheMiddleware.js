const { CacheHelper, CacheKeys } = require('../utils/cache');

/**
 * Middleware to check cache before route handler execution
 * If cache hit, return cached response immediately
 * If cache miss, continue to next middleware/route handler
 * 
 * @param {string} cacheType - Type of cache ('settings', 'services', 'windows')
 * @param {Function} keyGenerator - Function to generate cache key from request
 */
const checkCache = (cacheType, keyGenerator) => {
  return (req, res, next) => {
    try {
      const cacheKey = keyGenerator(req);
      const cachedData = CacheHelper.get(cacheType, cacheKey);
      
      if (cachedData !== undefined) {
        // Cache hit - return cached response
        return res.json(cachedData);
      }
      
      // Cache miss - continue to route handler
      // Store original json method to intercept response
      const originalJson = res.json.bind(res);
      res.json = function(data) {
        // Only cache successful responses (2xx status codes)
        if (res.statusCode >= 200 && res.statusCode < 300) {
          CacheHelper.set(cacheType, cacheKey, data);
        }
        // Call original json method
        return originalJson(data);
      };
      
      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      // On error, continue without caching
      next();
    }
  };
};

/**
 * Middleware to invalidate cache after mutation operations
 * Should be called after successful mutations (POST, PUT, PATCH, DELETE)
 * 
 * @param {Function} invalidationFunction - Function to determine which caches to invalidate
 */
const invalidateCache = (invalidationFunction) => {
  return (req, res, next) => {
    // Store original json method to intercept response
    const originalJson = res.json.bind(res);
    res.json = function(data) {
      // Only invalidate if response is successful (2xx status)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          invalidationFunction(req, data);
        } catch (error) {
          console.error('Cache invalidation error:', error);
          // Don't fail the request if cache invalidation fails
        }
      }
      // Call original json method
      return originalJson(data);
    };
    
    next();
  };
};

/**
 * Helper function to create cache middleware for GET endpoints
 * 
 * @param {string} cacheType - Type of cache ('settings', 'services', 'windows')
 * @param {string} keyType - Type of cache key ('all', 'byDepartment', etc.)
 * @param {Function} keyGenerator - Optional custom key generator function
 */
const cacheMiddleware = (cacheType, keyType, keyGenerator = null) => {
  return checkCache(cacheType, (req) => {
    if (keyGenerator) {
      return keyGenerator(req);
    }
    
    // Default key generation based on keyType
    switch (keyType) {
      case 'all':
        return CacheKeys[cacheType].all();
      case 'byDepartment':
        return CacheKeys[cacheType].byDepartment(req.params.department);
      case 'activeByDepartment':
        return CacheKeys[cacheType].activeByDepartment(req.params.department);
      case 'queue':
        return CacheKeys.settings.queue(req.params.department);
      case 'location':
        return CacheKeys.settings.location(req.params.department);
      case 'publicServices':
        return CacheKeys.public.services(req.params.department);
      case 'publicWindows':
        return CacheKeys.public.windows(req.params.department);
      default:
        throw new Error(`Unknown key type: ${keyType}`);
    }
  });
};

module.exports = {
  checkCache,
  invalidateCache,
  cacheMiddleware
};

