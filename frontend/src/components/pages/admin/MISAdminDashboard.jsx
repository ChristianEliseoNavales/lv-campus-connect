import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
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
  const activeSessionsIntervalRef = useRef(null);

  // Fetch active sessions function (separate for polling)
  const fetchActiveSessions = async () => {
    try {
      const baseUrl = API_CONFIG.getAdminUrl();
      const sessionsResponse = await authFetch(`${baseUrl}/api/analytics/active-sessions`);
      const sessionsData = sessionsResponse.ok ? await sessionsResponse.json() : { data: [] };
      setActiveSessions(sessionsData.data || []);
    } catch (error) {
      console.error('Error fetching active sessions:', error);
    }
  };

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

        // Fetch active sessions (initial load)
        await fetchActiveSessions();

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

  // Polling for active sessions (every 15 seconds)
  useEffect(() => {
    // Set up polling interval
    activeSessionsIntervalRef.current = setInterval(() => {
      fetchActiveSessions();
    }, 15000); // 15 seconds

    // Cleanup interval on unmount
    return () => {
      if (activeSessionsIntervalRef.current) {
        clearInterval(activeSessionsIntervalRef.current);
      }
    };
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
      <div className="space-y-2 sm:space-y-3 md:space-y-4">
        {/* Welcome Section Skeleton */}
        <div>
          <div className="h-5 sm:h-6 bg-gray-200 rounded w-48 sm:w-64 animate-pulse"></div>
        </div>

        {/* Dashboard Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 md:gap-4 min-h-[480px]">
          {/* Row 1 - Upper row (40% height) */}
          <div className="col-span-1">
            {/* System Overview Card Skeleton */}
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 p-3 sm:p-4 h-full">
              <div className="h-4 sm:h-5 bg-gray-200 rounded w-24 sm:w-28 mb-2 sm:mb-3 animate-pulse"></div>
              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-3 bg-gray-200 rounded w-14 sm:w-16 animate-pulse"></div>
                  <div className="h-5 sm:h-6 bg-gray-300 rounded w-8 sm:w-10 animate-pulse"></div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="h-3 bg-gray-200 rounded w-16 sm:w-20 animate-pulse"></div>
                  <div className="h-5 sm:h-6 bg-gray-300 rounded w-8 sm:w-10 animate-pulse"></div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="h-3 bg-gray-200 rounded w-14 sm:w-16 animate-pulse"></div>
                  <div className="h-5 sm:h-6 bg-gray-300 rounded w-8 sm:w-10 animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-span-1">
            {/* System Status Card Skeleton */}
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 p-3 sm:p-4 h-full">
              <div className="h-4 sm:h-5 bg-gray-200 rounded w-20 sm:w-24 mb-2 sm:mb-3 animate-pulse"></div>
              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-3 bg-gray-200 rounded w-16 sm:w-20 animate-pulse"></div>
                  <div className="h-5 sm:h-6 bg-gray-300 rounded w-5 sm:w-6 animate-pulse"></div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="h-3 bg-gray-200 rounded w-10 sm:w-12 animate-pulse"></div>
                  <div className="h-3 bg-gray-300 rounded w-14 sm:w-16 animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-span-1">
            {/* System Control Card Skeleton */}
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 p-3 sm:p-4 h-full">
              <div className="h-4 sm:h-5 bg-gray-200 rounded w-24 sm:w-28 mb-2 sm:mb-3 animate-pulse"></div>
              <div className="text-center">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-300 rounded-full mx-auto mb-1.5 animate-pulse"></div>
                <div className="h-3 bg-gray-200 rounded w-16 sm:w-20 mx-auto mb-2 sm:mb-3 animate-pulse"></div>
                <div className="space-y-1.5">
                  <div className="h-2.5 bg-gray-200 rounded w-20 sm:w-24 mx-auto animate-pulse"></div>
                  <div className="h-2.5 bg-gray-200 rounded w-24 sm:w-28 mx-auto animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2 - Lower row (60% height) */}
          <div className="col-span-1 md:col-span-2">
            {/* Area Chart Skeleton */}
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 p-3 sm:p-4 h-full min-h-[240px]">
              <div className="h-4 sm:h-5 bg-gray-200 rounded w-28 sm:w-32 mb-2 sm:mb-3 animate-pulse"></div>
              <div className="bg-gray-100 rounded-lg animate-pulse h-full"></div>
            </div>
          </div>

          <div className="col-span-1">
            {/* Pie Chart Skeleton */}
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 p-3 sm:p-4 h-full min-h-[240px]">
              <div className="h-4 sm:h-5 bg-gray-200 rounded w-24 sm:w-28 mb-2 sm:mb-3 animate-pulse"></div>
              <div className="flex items-center justify-center h-full">
                <div className="w-32 h-32 sm:w-40 sm:h-40 bg-gray-100 rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 sm:space-y-3 md:space-y-4">
      {/* Welcome Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#1F3463] tracking-tight">
          MIS Super Admin Dashboard
        </h1>
        <motion.button
          onClick={() => setIsDateRangeModalOpen(true)}
          className="w-full sm:w-auto px-4 sm:px-5 py-2 sm:py-2.5 bg-[#1F3463] text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-[#152847] transition-colors duration-200 shadow-md hover:shadow-lg"
          whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
          whileTap={{ scale: 0.95, transition: { duration: 0.15 } }}
        >
          View Analytic Report
        </motion.button>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 md:gap-4" style={{ gridTemplateRows: 'auto auto' }}>
        {/* Row 1 - Upper row (40% height) */}

        {/* Row 1, Column 1 - User Management & Active Sessions */}
        <div className="col-span-1">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 p-3 sm:p-4 flex flex-col h-full">
            <div className="grid grid-cols-2 gap-0 h-full">
              {/* Left Column - Total Users */}
              <div className="border-r border-[#1F3463] pr-2 sm:pr-3 flex flex-col items-center text-center h-full">
                <div className="flex flex-col items-center">
                  <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">Total Users</p>
                  <FaUsers className="text-2xl sm:text-3xl text-[#1F3463]" />
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-2xl sm:text-4xl font-bold text-[#1F3463]">{stats.totalUsers}</p>
                </div>
                <button
                  onClick={() => navigate('/admin/mis/users')}
                  className="bg-[#1F3463] text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold hover:bg-opacity-90 transition w-full"
                >
                  Manage Users
                </button>
              </div>

              {/* Right Column - Active Sessions */}
              <div className="pl-2 sm:pl-3 flex flex-col items-center h-full">
                <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2 flex-shrink-0">Now Active</p>
                <div className="flex-1 overflow-y-auto space-y-1 sm:space-y-1.5 w-full min-h-0 max-h-full">
                  {activeSessions.length > 0 ? (
                    activeSessions.map((session) => (
                      <div key={session.userId} className="flex items-center justify-center space-x-1 sm:space-x-1.5 text-xs flex-shrink-0">
                        <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-green-500 rounded-full flex-shrink-0"></div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 truncate text-[10px] sm:text-xs">{session.email}</p>
                          <p className="text-[8px] sm:text-[10px] text-gray-500">({session.name})</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-[10px] sm:text-xs text-gray-400 text-center py-2 sm:py-3">No active sessions</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Row 1, Column 2 - Kiosk Ratings Summary */}
        <div className="col-span-1">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 p-3 sm:p-4 flex flex-col justify-center items-center text-center h-full">
            <div className="w-full">
              <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">Kiosk Total Ratings</p>
              <p className="text-2xl sm:text-3xl font-bold text-[#1F3463] mb-2 sm:mb-3">{kioskRatings.totalRatings}</p>

              <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">Average Rating</p>
              <div className="flex items-center justify-center space-x-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <div key={star}>
                    {star <= Math.floor(kioskRatings.averageRating) ? (
                      <MdStar className="text-xl sm:text-2xl text-[#1F3463]" />
                    ) : star - kioskRatings.averageRating < 1 && star - kioskRatings.averageRating > 0 ? (
                      <div className="relative">
                        <MdStarBorder className="text-xl sm:text-2xl text-[#1F3463]" />
                        <div className="absolute top-0 left-0 overflow-hidden" style={{ width: `${(1 - (star - kioskRatings.averageRating)) * 100}%` }}>
                          <MdStar className="text-xl sm:text-2xl text-[#1F3463]" />
                        </div>
                      </div>
                    ) : (
                      <MdStarBorder className="text-xl sm:text-2xl text-[#1F3463]" />
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs sm:text-sm text-gray-600 mt-1 sm:mt-1.5 font-medium">{kioskRatings.averageRating.toFixed(2)} / 5.0</p>
            </div>
          </div>
        </div>

        {/* Row 1, Column 3 - Most Visited Office */}
        <div className="col-span-1 lg:col-span-1">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 p-3 sm:p-4 flex flex-col h-full">
            <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">Most Visited Office</p>
            <div className="flex-1 flex items-center justify-center">
              <DepartmentDonutChart data={departmentQueues} />
            </div>
          </div>
        </div>

        {/* Pie Chart - Positioned after Most Visited Office on md, stays in row 2 on lg */}
        <div className="col-span-1 lg:col-span-1 lg:row-start-2 lg:col-start-3">
          {/* Row 2, Column 3 - Pie Chart */}
          <div className="h-full">
            <ChartPieLegend userRole={user?.role} />
          </div>
        </div>

        {/* Row 2 - Lower row (60% height) - Area Chart */}
        <div className="col-span-1 md:col-span-2 lg:row-start-2 lg:col-start-1">
          {/* Row 2, Columns 1-2 (spanning both columns) - Area Chart */}
          <div className="h-full">
            <RoleAwareAreaChart userRole={user?.role} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MISAdminDashboard;
