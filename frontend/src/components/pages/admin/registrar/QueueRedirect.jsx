import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import API_CONFIG from '../../../../config/api';
import { authFetch } from '../../../../utils/apiClient';
import { useAuth } from '../../../../contexts/AuthContext';
import NoWindowAssigned from '../shared/NoWindowAssigned';

const QueueRedirect = () => {
  const { user } = useAuth();
  const [redirectPath, setRedirectPath] = useState(null);
  const [showNoWindowMessage, setShowNoWindowMessage] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const determineRedirect = async () => {
      try {
        // Admin Staff: Check for assigned window (role includes "Admin Staff")
        const isAdminStaff = user?.role?.includes('Admin Staff');

        if (isAdminStaff) {
          if (user?.assignedWindow) {
            const assignedWindowId = typeof user.assignedWindow === 'object'
              ? user.assignedWindow._id
              : user.assignedWindow;

            // Redirect to the assigned window
            setRedirectPath(`/admin/registrar/queue/${assignedWindowId}`);
          } else {
            // Admin Staff has queue access but no assigned window
            // Show the "not assigned" message
            setShowNoWindowMessage(true);
          }
        } else {
          // Admin or Super Admin: Fetch all windows and redirect to first one
          const response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/windows/registrar`);
          if (response.ok) {
            const windows = await response.json();
            if (windows.length > 0) {
              // Redirect to the first available window
              setRedirectPath(`/admin/registrar/queue/${windows[0].id}`);
            } else {
              // No windows available, redirect to settings to create one
              setRedirectPath('/admin/registrar/settings');
            }
          } else {
            // API error, redirect to dashboard
            setRedirectPath('/admin/registrar');
          }
        }
      } catch (error) {
        console.error('Error determining redirect:', error);
        // Network error, redirect to dashboard
        setRedirectPath('/admin/registrar');
      } finally {
        setLoading(false);
      }
    };

    determineRedirect();
  }, [user]);

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gray-200 rounded animate-pulse"></div>
            <div>
              <div className="h-8 bg-gray-200 rounded w-48 mb-2 animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded w-64 animate-pulse"></div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-24 h-10 bg-gray-200 rounded-lg animate-pulse"></div>
            <div className="w-20 h-10 bg-gray-200 rounded-lg animate-pulse"></div>
          </div>
        </div>

        {/* Queue Interface Skeleton */}
        <div className="grid grid-rows-3 gap-6 h-[600px]">
          {/* Window Header Skeleton */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <div className="h-12 bg-gray-200 rounded w-64 mx-auto animate-pulse"></div>
          </div>

          {/* Main Control Area Skeleton */}
          <div className="grid grid-cols-3 gap-6">
            {/* Queue Display Skeleton */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
              <div className="text-center">
                <div className="h-6 bg-gray-200 rounded w-32 mx-auto mb-4 animate-pulse"></div>
                <div className="h-24 bg-gray-200 rounded w-32 mx-auto animate-pulse"></div>
              </div>
            </div>

            {/* Control Buttons Skeleton */}
            <div className="col-span-2 grid grid-cols-2 gap-4">
              {[...Array(6)].map((_, index) => (
                <div key={index} className="h-16 bg-gray-200 rounded-xl animate-pulse"></div>
              ))}
            </div>
          </div>

          {/* Skipped Queue Section Skeleton */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <div className="h-6 bg-gray-200 rounded w-32 mb-4 animate-pulse"></div>
            <div className="grid grid-cols-6 gap-2">
              {[...Array(6)].map((_, index) => (
                <div key={index} className="h-12 bg-gray-200 rounded animate-pulse"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show "not assigned" message if user has no assigned window
  if (showNoWindowMessage) {
    return <NoWindowAssigned office="Registrar" />;
  }

  if (redirectPath) {
    return <Navigate to={redirectPath} replace />;
  }

  // Fallback redirect
  return <Navigate to="/admin/registrar" replace />;
};

export default QueueRedirect;
