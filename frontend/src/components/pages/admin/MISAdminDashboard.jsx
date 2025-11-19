import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaUsers } from 'react-icons/fa';
import { MdStar, MdStarBorder } from 'react-icons/md';
import { useAuth } from '../../../contexts/AuthContext';
import { RoleAwareAreaChart } from '../../ui/AreaChart';
import { ChartPieLegend } from '../../ui/PieChart';
import DepartmentDonutChart from '../../ui/DepartmentDonutChart';
import AnalyticalReportModal from '../../ui/AnalyticalReportModal';
import DateRangeModal from '../../ui/DateRangeModal';
import API_CONFIG from '../../../config/api';
import { authFetch } from '../../../utils/apiClient';

const MISAdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isDateRangeModalOpen, setIsDateRangeModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedDateRange, setSelectedDateRange] = useState(null);
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

        const usersResponse = await authFetch(`${baseUrl}/api/users`);
        const usersData = usersResponse.ok ? await usersResponse.json() : { data: [] };
        const users = usersData.data || [];

        // Fetch all windows data
        const registrarResponse = await authFetch(`${baseUrl}/api/windows/registrar`);
        const admissionsResponse = await authFetch(`${baseUrl}/api/windows/admissions`);
        const registrarWindows = registrarResponse.ok ? await registrarResponse.json() : [];
        const admissionsWindows = admissionsResponse.ok ? await admissionsResponse.json() : [];

        // Fetch active sessions
        const sessionsResponse = await authFetch(`${baseUrl}/api/analytics/active-sessions`);
        const sessionsData = sessionsResponse.ok ? await sessionsResponse.json() : { data: [] };

        // Fetch kiosk ratings summary
        const ratingsResponse = await authFetch(`${baseUrl}/api/analytics/queue-ratings-summary`);
        const ratingsData = ratingsResponse.ok ? await ratingsResponse.json() : { data: { totalRatings: 0, averageRating: 0 } };

        // Fetch queue distribution by department
        const departmentResponse = await authFetch(`${baseUrl}/api/analytics/queue-by-department`);
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
      <div className="space-y-5">
        {/* Welcome Section Skeleton */}
        <div>
          <div className="h-6 bg-gray-200 rounded w-64 animate-pulse"></div>
        </div>

        {/* Dashboard Grid Skeleton */}
        <div className="grid grid-cols-3 gap-5 min-h-[480px]">
          {/* Row 1 - Upper row (40% height) */}
          <div className="col-span-1">
            {/* System Overview Card Skeleton */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-5 h-full">
              <div className="h-5 bg-gray-200 rounded w-28 mb-3 animate-pulse"></div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-3 bg-gray-200 rounded w-16 animate-pulse"></div>
                  <div className="h-6 bg-gray-300 rounded w-10 animate-pulse"></div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="h-3 bg-gray-200 rounded w-20 animate-pulse"></div>
                  <div className="h-6 bg-gray-300 rounded w-10 animate-pulse"></div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="h-3 bg-gray-200 rounded w-16 animate-pulse"></div>
                  <div className="h-6 bg-gray-300 rounded w-10 animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-span-1">
            {/* System Status Card Skeleton */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-5 h-full">
              <div className="h-5 bg-gray-200 rounded w-24 mb-3 animate-pulse"></div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-3 bg-gray-200 rounded w-20 animate-pulse"></div>
                  <div className="h-6 bg-gray-300 rounded w-6 animate-pulse"></div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="h-3 bg-gray-200 rounded w-12 animate-pulse"></div>
                  <div className="h-3 bg-gray-300 rounded w-16 animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-span-1">
            {/* System Control Card Skeleton */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-5 h-full">
              <div className="h-5 bg-gray-200 rounded w-28 mb-3 animate-pulse"></div>
              <div className="text-center">
                <div className="w-10 h-10 bg-gray-300 rounded-full mx-auto mb-1.5 animate-pulse"></div>
                <div className="h-3 bg-gray-200 rounded w-20 mx-auto mb-3 animate-pulse"></div>
                <div className="space-y-1.5">
                  <div className="h-2.5 bg-gray-200 rounded w-24 mx-auto animate-pulse"></div>
                  <div className="h-2.5 bg-gray-200 rounded w-28 mx-auto animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2 - Lower row (60% height) */}
          <div className="col-span-2">
            {/* Area Chart Skeleton */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-5 h-full">
              <div className="h-5 bg-gray-200 rounded w-32 mb-3 animate-pulse"></div>
              <div className="bg-gray-100 rounded-lg animate-pulse"></div>
            </div>
          </div>

          <div className="col-span-1">
            {/* Pie Chart Skeleton */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-5 h-full">
              <div className="h-5 bg-gray-200 rounded w-28 mb-3 animate-pulse"></div>
              <div className="flex items-center justify-center h-full">
                <div className="w-40 h-40 bg-gray-100 rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-[#1F3463] tracking-tight">
          MIS Super Admin Dashboard
        </h1>
        <button
          onClick={() => setIsDateRangeModalOpen(true)}
          className="px-5 py-2.5 bg-[#1F3463] text-white rounded-lg text-sm font-semibold hover:bg-[#152847] transition-colors duration-200 shadow-md hover:shadow-lg"
        >
          View Analytic Report
        </button>
      </div>

      {/* Date Range Selection Modal */}
      <DateRangeModal
        isOpen={isDateRangeModalOpen}
        onClose={() => setIsDateRangeModalOpen(false)}
        onGenerateReport={(dateRange) => {
          setSelectedDateRange(dateRange);
          setIsDateRangeModalOpen(false);
          setIsReportModalOpen(true);
        }}
        userRole="MIS Super Admin"
      />

      {/* Analytical Report Modal */}
      <AnalyticalReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        userRole="MIS Super Admin"
        dateRange={selectedDateRange}
      />

      {/* New Grid Layout - 2 rows (40%/60%), 3 columns */}
      <div className="grid grid-cols-3 gap-5 min-h-[480px]">
        {/* Row 1 - Upper row (40% height) */}

        {/* Row 1, Column 1 - User Management & Active Sessions */}
        <div className="col-span-1">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-5 h-full flex flex-col">
            <div className="grid grid-cols-2 gap-0 h-full">
              {/* Left Column - Total Users */}
              <div className="border-r border-[#1F3463] pr-3 flex flex-col justify-start items-center text-center space-y-3">
                <div className="flex flex-col items-center">
                  <p className="text-sm font-semibold text-gray-700 mb-2.5">Total Users</p>
                  <FaUsers className="text-3xl text-[#1F3463] mb-3" />
                  <p className="text-3xl font-bold text-[#1F3463] mb-3">{stats.totalUsers}</p>
                </div>
                <button
                  onClick={() => navigate('/admin/mis/users')}
                  className="bg-[#1F3463] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-opacity-90 transition"
                >
                  Manage Users
                </button>
              </div>

              {/* Right Column - Active Sessions */}
              <div className="pl-3 flex flex-col items-center text-center">
                <p className="text-sm font-semibold text-gray-700 mb-2.5">Now Active</p>
                <div className="flex-1 overflow-y-auto space-y-1.5 w-full">
                  {activeSessions.length > 0 ? (
                    activeSessions.map((session, index) => (
                      <div key={index} className="flex items-start justify-start space-x-1.5 text-xs">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0 mt-1"></div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="font-semibold text-gray-800 truncate text-xs">{session.name}</p>
                          <p className="text-[10px] text-gray-500">({session.role.replace('_', ' ')})</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-400 text-center py-3">No active sessions</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Row 1, Column 2 - Kiosk Ratings Summary */}
        <div className="col-span-1">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-5 h-full flex flex-col justify-center items-center text-center">
            <div className="w-full">
              <p className="text-sm font-semibold text-gray-700 mb-3">Kiosk Total Ratings</p>
              <p className="text-4xl font-bold text-[#1F3463] mb-4">{kioskRatings.totalRatings}</p>

              <p className="text-sm font-semibold text-gray-700 mb-2">Average Rating</p>
              <div className="flex items-center justify-center space-x-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <div key={star}>
                    {star <= Math.floor(kioskRatings.averageRating) ? (
                      <MdStar className="text-2xl text-[#1F3463]" />
                    ) : star - kioskRatings.averageRating < 1 && star - kioskRatings.averageRating > 0 ? (
                      <div className="relative">
                        <MdStarBorder className="text-2xl text-[#1F3463]" />
                        <div className="absolute top-0 left-0 overflow-hidden" style={{ width: `${(1 - (star - kioskRatings.averageRating)) * 100}%` }}>
                          <MdStar className="text-2xl text-[#1F3463]" />
                        </div>
                      </div>
                    ) : (
                      <MdStarBorder className="text-2xl text-[#1F3463]" />
                    )}
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-600 mt-2 font-medium">{kioskRatings.averageRating.toFixed(2)} / 5.0</p>
            </div>
          </div>
        </div>

        {/* Row 1, Column 3 - Most Visited Office */}
        <div className="col-span-1">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-5 h-full flex flex-col">
            <p className="text-sm font-semibold text-gray-700 mb-3">Most Visited Office</p>
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
