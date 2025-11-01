import React, { createContext, useContext, useState, useEffect } from 'react';
import useGoogleAuth from '../hooks/useGoogleAuth';

// ============================================================================
// DEVELOPMENT BYPASS FLAG - TEMPORARILY DISABLE AUTHENTICATION
// ============================================================================
// Set to true to bypass authentication and auto-login as super admin
// WARNING: Set back to false before deploying to production!
const DEV_BYPASS_AUTH = true;
// ============================================================================

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
      // DEVELOPMENT BYPASS: Auto-authenticate with mock super admin user
      if (DEV_BYPASS_AUTH) {
        console.warn('⚠️ DEVELOPMENT MODE: Auto-authenticated as Super Admin (authentication bypassed)');
        const mockUser = {
          id: 'dev-bypass-user',
          email: 'dev@bypass.local',
          name: 'Development Super Admin',
          role: 'super_admin',
          department: 'mis',
          isActive: true
        };
        setUser(mockUser);
        setIsAuthenticated(true);
        setIsLoading(false);
        return;
      }

      try {
        const token = localStorage.getItem('authToken');
        const userData = localStorage.getItem('userData');

        if (token && userData) {
          const parsedUser = JSON.parse(userData);

          // Verify token with backend
          const response = await fetch('http://localhost:3001/api/auth/verify', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            const data = await response.json();
            setUser(data.user);
            setIsAuthenticated(true);
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

      // Send credential to backend for verification
      const response = await fetch('http://localhost:3001/api/auth/google', {
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
        throw new Error(data.error || 'Authentication failed');
      }
    } catch (error) {
      console.error('Sign in error:', error);
      setError(error.message);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithCredentials = async (email, password) => {
    try {
      setIsLoading(true);
      setError(null);

      // Test credentials for development
      const testCredentials = {
        'admin@test.edu': { password: 'Admin123!', role: 'super_admin', department: 'mis', name: 'System Administrator' },
        'registrar@test.edu': { password: 'Registrar123!', role: 'registrar_admin', department: 'registrar', name: 'Registrar Admin' },
        'admissions@test.edu': { password: 'Admissions123!', role: 'admissions_admin', department: 'admissions', name: 'Admissions Admin' }
      };

      try {
        // Try to connect to backend first
        const response = await fetch('http://localhost:3001/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email, password })
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
          throw new Error(data.error || 'Invalid credentials');
        }
      } catch (fetchError) {
        console.warn('Backend not available, using test credentials:', fetchError.message);

        // Fallback to test credentials if backend is not available
        const testUser = testCredentials[email];

        if (testUser && testUser.password === password) {
          const user = {
            id: Date.now(),
            email,
            name: testUser.name,
            role: testUser.role,
            department: testUser.department,
            isActive: true
          };

          const token = `test-token-${Date.now()}`;

          setUser(user);
          setIsAuthenticated(true);

          // Store token and user data
          localStorage.setItem('authToken', token);
          localStorage.setItem('userData', JSON.stringify(user));

          return { success: true, user };
        } else {
          throw new Error('Invalid credentials');
        }
      }
    } catch (error) {
      console.error('Manual sign in error:', error);
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

  // Role-based access control helpers
  const hasRole = (role) => {
    return user?.role === role;
  };

  const hasAnyRole = (roles) => {
    return roles.includes(user?.role);
  };

  const canAccessRoute = (route) => {
    // DEVELOPMENT BYPASS: Allow all routes when bypass is enabled
    if (DEV_BYPASS_AUTH) {
      return true;
    }

    if (!isAuthenticated || !user) return false;

    // MIS Super Admin has access to everything
    if (user.role === 'super_admin') return true;

    // Role-specific route access
    if (route.startsWith('/admin/registrar') && user.role === 'registrar_admin') return true;
    if (route.startsWith('/admin/admissions') && user.role === 'admissions_admin') return true;
    if (route.startsWith('/admin/seniormanagement') && user.role === 'senior_management_admin') return true;
    if (route.startsWith('/admin/mis') && user.role === 'super_admin') return true;

    return false;
  };

  const value = {
    user,
    isAuthenticated,
    isLoading,
    error,
    isGoogleLoaded,
    signIn,
    signInWithCredentials,
    signOut,
    hasRole,
    hasAnyRole,
    canAccessRoute,
    clearError: () => setError(null)
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
