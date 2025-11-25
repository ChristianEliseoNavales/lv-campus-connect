const NodeCache = require('node-cache');

// Cache TTL configuration (in seconds)
const CACHE_TTL = {
  STATIC: 300, // 5 minutes for static data (settings, services, windows)
  DYNAMIC: 30  // 30 seconds for dynamic data (if needed in future)
};

// Create cache instances for different data types
const settingsCache = new NodeCache({
  stdTTL: CACHE_TTL.STATIC,
  checkperiod: 60, // Check for expired keys every 60 seconds
  useClones: false // Better performance, but be careful with object mutations
});

const servicesCache = new NodeCache({
  stdTTL: CACHE_TTL.STATIC,
  checkperiod: 60,
  useClones: false
});

const windowsCache = new NodeCache({
  stdTTL: CACHE_TTL.STATIC,
  checkperiod: 60,
  useClones: false
});

// Cache key generators
const CacheKeys = {
  // Settings keys
  settings: {
    all: () => 'settings:all',
    queue: (department) => `settings:queue:${department}`,
    location: (department) => `settings:location:${department}`
  },

  // Services keys
  services: {
    all: () => 'services:all',
    byDepartment: (department) => `services:${department}`,
    activeByDepartment: (department) => `services:${department}:active`
  },

  // Windows keys
  windows: {
    all: () => 'windows:all',
    byDepartment: (department) => `windows:${department}`
  },

  // Public endpoints keys
  public: {
    services: (department) => `public:services:${department}`,
    windows: (department) => `public:windows:${department}`
  }
};

// Cache helper functions
const CacheHelper = {
  // Get cache instance by type
  getCache: (type) => {
    switch (type) {
      case 'settings':
        return settingsCache;
      case 'services':
        return servicesCache;
      case 'windows':
        return windowsCache;
      default:
        return settingsCache; // Default to settings cache
    }
  },

  // Get cached value
  get: (type, key) => {
    const cache = CacheHelper.getCache(type);
    return cache.get(key);
  },

  // Set cached value
  set: (type, key, value, ttl = null) => {
    const cache = CacheHelper.getCache(type);
    if (ttl) {
      cache.set(key, value, ttl);
    } else {
      cache.set(key, value);
    }
  },

  // Delete cached value
  del: (type, key) => {
    const cache = CacheHelper.getCache(type);
    cache.del(key);
  },

  // Delete multiple keys (supports pattern matching)
  delMultiple: (type, keys) => {
    const cache = CacheHelper.getCache(type);
    if (Array.isArray(keys)) {
      keys.forEach(key => cache.del(key));
    } else {
      // If keys is a pattern string, delete all matching keys
      const allKeys = cache.keys();
      const pattern = new RegExp(keys);
      allKeys.forEach(key => {
        if (pattern.test(key)) {
          cache.del(key);
        }
      });
    }
  },

  // Flush all cache for a type
  flush: (type) => {
    const cache = CacheHelper.getCache(type);
    cache.flushAll();
  },

  // Flush all caches
  flushAll: () => {
    settingsCache.flushAll();
    servicesCache.flushAll();
    windowsCache.flushAll();
  },

  // Invalidate settings-related caches
  invalidateSettings: (department = null) => {
    CacheHelper.del('settings', CacheKeys.settings.all());
    if (department) {
      CacheHelper.del('settings', CacheKeys.settings.queue(department));
      CacheHelper.del('settings', CacheKeys.settings.location(department));
      // Also invalidate public services cache for this department
      CacheHelper.del('services', CacheKeys.public.services(department));
    } else {
      // Invalidate all department-specific settings
      ['registrar', 'admissions'].forEach(dept => {
        CacheHelper.del('settings', CacheKeys.settings.queue(dept));
        CacheHelper.del('settings', CacheKeys.settings.location(dept));
        CacheHelper.del('services', CacheKeys.public.services(dept));
      });
    }
  },

  // Invalidate services-related caches
  invalidateServices: (department = null) => {
    CacheHelper.del('services', CacheKeys.services.all());
    if (department) {
      CacheHelper.del('services', CacheKeys.services.byDepartment(department));
      CacheHelper.del('services', CacheKeys.services.activeByDepartment(department));
      CacheHelper.del('services', CacheKeys.public.services(department));
    } else {
      // Invalidate all department-specific services
      ['registrar', 'admissions'].forEach(dept => {
        CacheHelper.del('services', CacheKeys.services.byDepartment(dept));
        CacheHelper.del('services', CacheKeys.services.activeByDepartment(dept));
        CacheHelper.del('services', CacheKeys.public.services(dept));
      });
    }
  },

  // Invalidate windows-related caches
  invalidateWindows: (department = null) => {
    CacheHelper.del('windows', CacheKeys.windows.all());
    if (department) {
      CacheHelper.del('windows', CacheKeys.windows.byDepartment(department));
      CacheHelper.del('windows', CacheKeys.public.windows(department));
      // Windows changes affect service visibility, so invalidate public services too
      CacheHelper.del('services', CacheKeys.public.services(department));
    } else {
      // Invalidate all department-specific windows
      ['registrar', 'admissions'].forEach(dept => {
        CacheHelper.del('windows', CacheKeys.windows.byDepartment(dept));
        CacheHelper.del('windows', CacheKeys.public.windows(dept));
        CacheHelper.del('services', CacheKeys.public.services(dept));
      });
    }
  }
};

module.exports = {
  CacheKeys,
  CacheHelper,
  CACHE_TTL
};

