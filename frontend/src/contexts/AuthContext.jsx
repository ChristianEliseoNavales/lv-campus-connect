import React, { createContext, useContext, useState, useEffect } from 'react';
import useGoogleAuth from '../hooks/useGoogleAuth';
import { getDefaultRoute as getDefaultRouteUtil } from '../utils/roleRoutes';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const { isGoogleLoaded, signInWithGoogle, signOut: googleSignOut } = useGoogleAuth();

  // Check for existing session on mount
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const userData = localStorage.getItem('userData');

        if (token && userData) {
          const parsedUser = JSON.parse(userData);

          // Get backend URL from environment
          const backendUrl = import.meta.env.VITE_CLOUD_BACKEND_URL || 'http://localhost:3001';

          // Verify token with backend
          const response = await fetch(`${backendUrl}/api/auth/verify`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.user) {
              setUser(data.user);
              setIsAuthenticated(true);
            } else {
              // Invalid response, clear storage
              localStorage.removeItem('authToken');
              localStorage.removeItem('userData');
            }
          } else {
            // Token is invalid, clear storage
            localStorage.removeItem('authToken');
            localStorage.removeItem('userData');
          }
        }
      } catch (error) {
        console.error('Session check failed:', error);
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
      } finally {
        setIsLoading(false);
      }
    };

    checkExistingSession();
  }, []);

  const signIn = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const credential = await signInWithGoogle();

      // Get backend URL from environment
      const backendUrl = import.meta.env.VITE_CLOUD_BACKEND_URL || 'http://localhost:3001';

      // Send credential to backend for verification
      const response = await fetch(`${backendUrl}/api/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ credential })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setUser(data.user);
        setIsAuthenticated(true);

        // Store token and user data
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('userData', JSON.stringify(data.user));

        return { success: true, user: data.user };
      } else {
        throw new Error(data.message || data.error || 'Authentication failed');
      }
    } catch (error) {
      console.error('Sign in error:', error);
      setError(error.message);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };



  const signOut = async () => {
    try {
      setIsLoading(true);

      // Clear local state
      setUser(null);
      setIsAuthenticated(false);
      setError(null);

      // Clear storage
      localStorage.removeItem('authToken');
      localStorage.removeItem('userData');

      // Sign out from Google
      googleSignOut();

      return { success: true };
    } catch (error) {
      console.error('Sign out error:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh user data from backend
  const refreshUser = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        console.warn('No auth token found, cannot refresh user');
        return false;
      }

      const backendUrl = import.meta.env.VITE_CLOUD_BACKEND_URL || 'http://localhost:3001';

      const response = await fetch(`${backendUrl}/api/auth/verify`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.user) {
          setUser(data.user);
          localStorage.setItem('userData', JSON.stringify(data.user));
          console.log('✅ User data refreshed successfully');
          return true;
        }
      }

      console.warn('Failed to refresh user data');
      return false;
    } catch (error) {
      console.error('Error refreshing user data:', error);
      return false;
    }
  };

  // Role-based access control helpers
  const hasRole = (role) => {
    return user?.role === role;
  };

  const hasAnyRole = (roles) => {
    return roles.includes(user?.role);
  };

  const canAccessRoute = (route) => {
    if (!isAuthenticated || !user) return false;

    // MIS Super Admin has access to everything
    if (user.role === 'MIS Super Admin') return true;

    // Check pageAccess array for specific route permissions
    const pageAccess = user.pageAccess || [];

    // Check for exact match or wildcard access
    const hasAccess = pageAccess.some(page => {
      if (page === '*') return true; // Wildcard access (MIS Super Admin only)
      if (page === route) return true; // Exact match

      // Special case for queue window routes:
      // If user has access to /admin/{office}/queue, they can access /admin/{office}/queue/{windowId}
      // This applies to Admin and Registrar/Admissions Admin roles (NOT Admin Staff)
      // Admin Staff will have the specific window route in their pageAccess
      const isAdminStaff = user.role?.includes('Admin Staff');
      const isAdmin = user.role === 'Admin' || user.role?.includes('Admin') && !isAdminStaff;

      if (isAdmin) {
        // Check if route is a queue window route (e.g., /admin/registrar/queue/windowId)
        const queueWindowPattern = /^\/admin\/(registrar|admissions)\/queue\/[a-f0-9]+$/i;
        if (queueWindowPattern.test(route)) {
          // Extract the base queue route (e.g., /admin/registrar/queue)
          const baseQueueRoute = route.substring(0, route.lastIndexOf('/'));
          // Check if user has access to the base queue route
          if (page === baseQueueRoute) return true;
        }
      }

      return false;
    });

    return hasAccess;
  };

  /**
   * Get the default route for the current user based on their role
   * @returns {string} - Default route path
   */
  const getDefaultRoute = () => {
    return getDefaultRouteUtil(user);
  };

  const value = {
    user,
    isAuthenticated,
    isLoading,
    error,
    isGoogleLoaded,
    signIn,
    signOut,
    refreshUser,
    hasRole,
    hasAnyRole,
    canAccessRoute,
    getDefaultRoute,
    clearError: () => setError(null)
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
