import { useState, useEffect, useCallback, useRef } from 'react';

// Cache for storing API responses
const apiCache = new Map();
const cacheTimestamps = new Map();
const CACHE_DURATION = 30000; // 30 seconds

// Get JWT token from localStorage
const getAuthToken = () => {
  return localStorage.getItem('authToken');
};

// Debounce utility
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
};

export const useOptimizedFetch = (url, options = {}) => {
  const {
    dependencies = [],
    cacheKey = url,
    debounceMs = 300,
    enableCache = true,
    onSuccess,
    onError
  } = options;

  const [data, setData] = useState(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);

  // Check if cached data is still valid
  const getCachedData = useCallback((key) => {
    if (!enableCache) return null;
    
    const cached = apiCache.get(key);
    const timestamp = cacheTimestamps.get(key);
    
    if (cached && timestamp && (Date.now() - timestamp < CACHE_DURATION)) {
      return cached;
    }
    
    // Clean up expired cache
    apiCache.delete(key);
    cacheTimestamps.delete(key);
    return null;
  }, [enableCache]);

  // Set cache data
  const setCachedData = useCallback((key, data) => {
    if (enableCache) {
      apiCache.set(key, data);
      cacheTimestamps.set(key, Date.now());
    }
  }, [enableCache]);

  // Fetch function
  const fetchData = useCallback(async () => {
    // Check cache first
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      setData(cachedData);
      setError(null);
      if (onSuccess) onSuccess(cachedData);
      return cachedData;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);

      // Get JWT token and prepare headers
      const token = getAuthToken();
      const headers = {
        'Content-Type': 'application/json',
        ...options.fetchOptions?.headers,
      };

      // Add Authorization header if token exists
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        signal: abortControllerRef.current.signal,
        ...options.fetchOptions,
        headers
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setData(result);
        setCachedData(cacheKey, result);
        if (onSuccess) onSuccess(result);
      }

      return result;
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('Fetch aborted');
        return;
      }

      if (isMountedRef.current) {
        setError(err.message);
        if (onError) onError(err);
      }
      throw err;
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [url, cacheKey, getCachedData, setCachedData, onSuccess, onError, options.fetchOptions]);

  // Debounced fetch function
  const debouncedFetch = useCallback(
    debounce(fetchData, debounceMs),
    [fetchData, debounceMs]
  );

  // Refetch function for manual triggers
  const refetch = useCallback(() => {
    // Clear cache for this key to force fresh data
    apiCache.delete(cacheKey);
    cacheTimestamps.delete(cacheKey);
    return fetchData();
  }, [cacheKey, fetchData]);

  // Effect to trigger fetch when dependencies change
  useEffect(() => {
    if (url) {
      debouncedFetch();
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [url, debouncedFetch, ...dependencies]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    data,
    loading,
    error,
    refetch,
    clearCache: () => {
      apiCache.delete(cacheKey);
      cacheTimestamps.delete(cacheKey);
    }
  };
};

// Utility to clear all cache
export const clearAllCache = () => {
  apiCache.clear();
  cacheTimestamps.clear();
};

// Utility to clear cache by pattern
export const clearCacheByPattern = (pattern) => {
  const regex = new RegExp(pattern);
  for (const key of apiCache.keys()) {
    if (regex.test(key)) {
      apiCache.delete(key);
      cacheTimestamps.delete(key);
    }
  }
};

export default useOptimizedFetch;
