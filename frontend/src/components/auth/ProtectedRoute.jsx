import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingSpinner } from '../ui';

const ProtectedRoute = ({ children, requiredRoles = [], redirectTo = '/login' }) => {
  const { isAuthenticated, isLoading, user, canAccessRoute } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Check route-specific access using pageAccess array
  // This is the primary access control mechanism - it checks if the user's
  // pageAccess array includes the current route
  if (!canAccessRoute(location.pathname)) {
    if (import.meta.env.DEV) {
      console.log(`❌ Access denied to ${location.pathname} for user:`, user?.email);
      console.log(`   User role: ${user?.role}`);
      console.log(`   User pageAccess:`, user?.pageAccess);
    }
    return <Navigate to="/admin/unauthorized" replace />;
  }

  return children;
};

export default ProtectedRoute;
