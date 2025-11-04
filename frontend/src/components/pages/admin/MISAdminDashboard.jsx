import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaUsers } from 'react-icons/fa';
import { MdStar, MdStarBorder } from 'react-icons/md';
import { useAuth } from '../../../contexts/AuthContext';
import { RoleAwareAreaChart } from '../../ui/AreaChart';
import { ChartPieLegend } from '../../ui/PieChart';
import DepartmentDonutChart from '../../ui/DepartmentDonutChart';
import API_CONFIG from '../../../config/api';

const MISAdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeQueues: 0,
    todayServed: 0,
    systemStatus: 'operational'
  });
  const [activeSessions, setActiveSessions] = useState([]);
  const [kioskRatings, setKioskRatings] = useState({
    totalRatings: 0,
    averageRating: 0
  });
  const [departmentQueues, setDepartmentQueues] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch system-wide data for MIS Super Admin
        const baseUrl = API_CONFIG.getAdminUrl();

        const usersResponse = await fetch(`${baseUrl}/api/users`);
        const usersData = usersResponse.ok ? await usersResponse.json() : { data: [] };
        const users = usersData.data || [];

        // Fetch all windows data
        const registrarResponse = await fetch(`${baseUrl}/api/windows/registrar`);
        const admissionsResponse = await fetch(`${baseUrl}/api/windows/admissions`);
        const registrarWindows = registrarResponse.ok ? await registrarResponse.json() : [];
        const admissionsWindows = admissionsResponse.ok ? await admissionsResponse.json() : [];

        // Fetch active sessions
        const sessionsResponse = await fetch(`${baseUrl}/api/analytics/active-sessions`);
        const sessionsData = sessionsResponse.ok ? await sessionsResponse.json() : { data: [] };

        // Fetch kiosk ratings summary
        const ratingsResponse = await fetch(`${baseUrl}/api/analytics/queue-ratings-summary`);
        const ratingsData = ratingsResponse.ok ? await ratingsResponse.json() : { data: { totalRatings: 0, averageRating: 0 } };

        // Fetch queue distribution by department
        const departmentResponse = await fetch(`${baseUrl}/api/analytics/queue-by-department`);
        const departmentData = departmentResponse.ok ? await departmentResponse.json() : { data: [] };

        // Stats based on actual data
        const mockStats = {
          totalUsers: users.length,
          activeQueues: registrarWindows.length + admissionsWindows.length || 6,
          todayServed: 41, // Combined from both departments
          systemStatus: 'operational'
        };

        setStats(mockStats);
        setActiveSessions(sessionsData.data || []);
        setKioskRatings(ratingsData.data || { totalRatings: 0, averageRating: 0 });
        setDepartmentQueues(departmentData.data || []);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now - time) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Welcome Section Skeleton */}
        <div>
          <div className="h-8 bg-gray-200 rounded w-80 animate-pulse"></div>
        </div>

        {/* Dashboard Grid Skeleton */}
        <div className="grid grid-cols-3 gap-6 min-h-[600px]">
          {/* Row 1 - Upper row (40% height) */}
          <div className="col-span-1">
            {/* System Overview Card Skeleton */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 h-full">
              <div className="h-6 bg-gray-200 rounded w-32 mb-4 animate-pulse"></div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>
                  <div className="h-8 bg-gray-300 rounded w-12 animate-pulse"></div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
                  <div className="h-8 bg-gray-300 rounded w-12 animate-pulse"></div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>
                  <div className="h-8 bg-gray-300 rounded w-12 animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-span-1">
            {/* System Status Card Skeleton */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 h-full">
              <div className="h-6 bg-gray-200 rounded w-28 mb-4 animate-pulse"></div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
                  <div className="h-8 bg-gray-300 rounded w-8 animate-pulse"></div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div>
                  <div className="h-4 bg-gray-300 rounded w-20 animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-span-1">
            {/* System Control Card Skeleton */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 h-full">
              <div className="h-6 bg-gray-200 rounded w-32 mb-4 animate-pulse"></div>
              <div className="text-center">
                <div className="w-12 h-12 bg-gray-300 rounded-full mx-auto mb-2 animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded w-24 mx-auto mb-4 animate-pulse"></div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-28 mx-auto animate-pulse"></div>
                  <div className="h-3 bg-gray-200 rounded w-32 mx-auto animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2 - Lower row (60% height) */}
          <div className="col-span-2">
            {/* Area Chart Skeleton */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 h-full">
              <div className="h-6 bg-gray-200 rounded w-40 mb-4 animate-pulse"></div>
              <div className="bg-gray-100 rounded-lg animate-pulse"></div>
            </div>
          </div>

          <div className="col-span-1">
            {/* Pie Chart Skeleton */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 h-full">
              <div className="h-6 bg-gray-200 rounded w-32 mb-4 animate-pulse"></div>
              <div className="flex items-center justify-center h-full">
                <div className="w-48 h-48 bg-gray-100 rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-4xl font-bold text-[#1F3463] tracking-tight">
          MIS Super Admin Dashboard
        </h1>
      </div>

      {/* New Grid Layout - 2 rows (40%/60%), 3 columns */}
      <div className="grid grid-cols-3 gap-6 min-h-[600px]">
        {/* Row 1 - Upper row (40% height) */}

        {/* Row 1, Column 1 - User Management & Active Sessions */}
        <div className="col-span-1">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 h-full flex flex-col">
            <div className="grid grid-cols-2 gap-0 h-full">
              {/* Left Column - Total Users */}
              <div className="border-r border-[#1F3463] pr-4 flex flex-col justify-between items-center text-center">
                <div className="flex flex-col items-center">
                  <p className="text-base font-semibold text-gray-700 mb-3">Total Users</p>
                  <FaUsers className="text-4xl text-[#1F3463] mb-4" />
                  <p className="text-4xl font-bold text-[#1F3463] mb-6">{stats.totalUsers}</p>
                </div>
                <button
                  onClick={() => navigate('/admin/mis/users')}
                  className="bg-[#1F3463] text-white px-5 py-2.5 rounded-lg text-base font-semibold hover:bg-opacity-90 transition"
                >
                  Manage Users
                </button>
              </div>

              {/* Right Column - Active Sessions */}
              <div className="pl-4 flex flex-col items-center text-center">
                <p className="text-base font-semibold text-gray-700 mb-3">Now Active</p>
                <div className="flex-1 overflow-y-auto space-y-2 w-full">
                  {activeSessions.length > 0 ? (
                    activeSessions.map((session, index) => (
                      <div key={index} className="flex items-center justify-center space-x-2 text-sm">
                        <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 truncate text-sm">{session.name}</p>
                          <p className="text-xs text-gray-500">({session.role.replace('_', ' ')})</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-4">No active sessions</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Row 1, Column 2 - Kiosk Ratings Summary */}
        <div className="col-span-1">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 h-full flex flex-col justify-center items-center text-center">
            <div className="w-full">
              <p className="text-base font-semibold text-gray-700 mb-6">Kiosk Total Ratings</p>
              <p className="text-5xl font-bold text-[#1F3463] mb-6">{kioskRatings.totalRatings}</p>

              <p className="text-base font-semibold text-gray-700 mb-3">Average Rating</p>
              <div className="flex items-center justify-center space-x-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <div key={star}>
                    {star <= Math.floor(kioskRatings.averageRating) ? (
                      <MdStar className="text-3xl text-[#1F3463]" />
                    ) : star - kioskRatings.averageRating < 1 && star - kioskRatings.averageRating > 0 ? (
                      <div className="relative">
                        <MdStarBorder className="text-3xl text-[#1F3463]" />
                        <div className="absolute top-0 left-0 overflow-hidden" style={{ width: `${(1 - (star - kioskRatings.averageRating)) * 100}%` }}>
                          <MdStar className="text-3xl text-[#1F3463]" />
                        </div>
                      </div>
                    ) : (
                      <MdStarBorder className="text-3xl text-[#1F3463]" />
                    )}
                  </div>
                ))}
              </div>
              <p className="text-base text-gray-600 mt-2 font-medium">{kioskRatings.averageRating.toFixed(2)} / 5.0</p>
            </div>
          </div>
        </div>

        {/* Row 1, Column 3 - Most Visited Office */}
        <div className="col-span-1">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 h-full flex flex-col">
            <p className="text-base font-semibold text-gray-700 mb-4">Most Visited Office</p>
            <div className="flex-1 flex items-center justify-center">
              <DepartmentDonutChart data={departmentQueues} />
            </div>
          </div>
        </div>

        {/* Row 2 - Lower row (60% height) */}
        <div className="col-span-2 ">
          {/* Row 2, Columns 1-2 (spanning both columns) - Area Chart */}
          <div className="h-full">
            <RoleAwareAreaChart userRole={user?.role} />
          </div>
        </div>

        <div className="col-span-1 ">
          {/* Row 2, Column 3 - Pie Chart */}
          <div className="h-full">
            <ChartPieLegend userRole={user?.role} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MISAdminDashboard;
