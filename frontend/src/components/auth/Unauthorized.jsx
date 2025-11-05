import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const Unauthorized = () => {
  const navigate = useNavigate();
  const { user, signOut, getDefaultRoute } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleGoToDashboard = () => {
    const defaultRoute = getDefaultRoute();
    navigate(defaultRoute);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 admin-layout">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          
          <p className="text-gray-600 mb-6">
            You don't have permission to access this page. Your current role ({user?.role?.replace('_', ' ')}) 
            doesn't allow access to this section of the admin panel.
          </p>

          {/* User Info */}
          {user && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-700">
                <strong>Signed in as:</strong> {user.name}
              </p>
              <p className="text-sm text-gray-700">
                <strong>Role:</strong> {user.role?.replace('_', ' ')}
              </p>
              <p className="text-sm text-gray-700">
                <strong>Department:</strong> {user.department}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={handleGoBack}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Go Back
            </button>
            
            <button
              onClick={handleGoToDashboard}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
            >
              Go to My Dashboard
            </button>
            
            <button
              onClick={handleSignOut}
              className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Help */}
        <div className="mt-6">
          <p className="text-sm text-gray-500">
            If you believe this is an error, please contact your system administrator or IT support.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Unauthorized;
