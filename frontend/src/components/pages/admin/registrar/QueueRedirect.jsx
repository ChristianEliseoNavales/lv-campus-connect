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
        // Admin Staff: Check for assigned windows (role includes "Admin Staff")
        const isAdminStaff = user?.role?.includes('Admin Staff');

        if (isAdminStaff) {
          // Support both assignedWindows (array) and assignedWindow (single, deprecated)
          const assignedWindows = user?.assignedWindows || (user?.assignedWindow ? [user.assignedWindow] : []);

          if (assignedWindows.length > 0) {
            // Redirect to first assigned window
            const firstWindow = assignedWindows[0];
            const assignedWindowId = typeof firstWindow === 'object'
              ? firstWindow._id
              : firstWindow;

            // Redirect to the assigned window
            setRedirectPath(`/admin/registrar/queue/${assignedWindowId}`);
          } else {
            // Admin Staff has queue access but no assigned windows
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
      <div className="space-y-2 sm:space-y-3 md:space-y-4">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-2.5">
            <div className="w-5 h-5 sm:w-5.5 sm:h-5.5 md:w-6 md:h-6 bg-gray-200 rounded animate-pulse"></div>
            <div>
              <div className="h-5 sm:h-5.5 md:h-6 bg-gray-200 rounded w-32 sm:w-36 md:w-40 mb-1 sm:mb-1.5 animate-pulse"></div>
              <div className="h-2.5 sm:h-3 bg-gray-200 rounded w-40 sm:w-46 md:w-52 animate-pulse"></div>
            </div>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-2.5">
            <div className="w-16 h-7 sm:w-18 sm:h-7.5 md:w-20 md:h-8 bg-gray-200 rounded-lg animate-pulse"></div>
            <div className="w-12 h-7 sm:w-14 sm:h-7.5 md:w-16 md:h-8 bg-gray-200 rounded-lg animate-pulse"></div>
          </div>
        </div>

        {/* Queue Interface Skeleton */}
        <div className="grid grid-rows-3 gap-2 sm:gap-3 md:gap-4 h-[400px] sm:h-[440px] md:h-[480px]">
          {/* Window Header Skeleton */}
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 p-3 sm:p-4 md:p-5">
            <div className="h-8 sm:h-9 md:h-10 bg-gray-200 rounded w-40 sm:w-46 md:w-52 mx-auto animate-pulse"></div>
          </div>

          {/* Main Control Area Skeleton */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4">
            {/* Queue Display Skeleton */}
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 p-3 sm:p-4 md:p-5">
              <div className="text-center">
                <div className="h-4 sm:h-4.5 md:h-5 bg-gray-200 rounded w-20 sm:w-22 md:w-24 mx-auto mb-2 sm:mb-2.5 md:mb-3 animate-pulse"></div>
                <div className="h-16 sm:h-18 md:h-20 bg-gray-200 rounded w-20 sm:w-22 md:w-24 mx-auto animate-pulse"></div>
              </div>
            </div>

            {/* Control Buttons Skeleton */}
            <div className="col-span-2 grid grid-cols-2 gap-2 sm:gap-2.5 md:gap-3">
              {[...Array(6)].map((_, index) => (
                <div key={index} className="h-10 sm:h-11 md:h-12 bg-gray-200 rounded-xl animate-pulse"></div>
              ))}
            </div>
          </div>

          {/* Skipped Queue Section Skeleton */}
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 p-3 sm:p-4 md:p-5">
            <div className="h-4 sm:h-4.5 md:h-5 bg-gray-200 rounded w-20 sm:w-22 md:w-24 mb-2 sm:mb-2.5 md:mb-3 animate-pulse"></div>
            <div className="grid grid-cols-6 gap-1 sm:gap-1.5">
              {[...Array(6)].map((_, index) => (
                <div key={index} className="h-8 sm:h-9 md:h-10 bg-gray-200 rounded animate-pulse"></div>
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
