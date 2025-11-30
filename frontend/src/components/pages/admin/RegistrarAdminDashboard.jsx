import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useSocket } from '../../../contexts/SocketContext';
import { RoleAwareAreaChart } from '../../ui/AreaChart';
import { ChartPieLegend } from '../../ui/PieChart';
import AnalyticalReportModal from '../../ui/AnalyticalReportModal';
import DateRangeModal from '../../ui/DateRangeModal';
import API_CONFIG from '../../../config/api';
import { authFetch } from '../../../utils/apiClient';

const RegistrarAdminDashboard = () => {
  const { user } = useAuth();
  const { socket, isConnected, joinRoom, leaveRoom, subscribe } = useSocket();
  const [isDateRangeModalOpen, setIsDateRangeModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedDateRange, setSelectedDateRange] = useState(null);
  const [stats, setStats] = useState({
    queueLength: 0,
    servedToday: 0,
    activeWindows: 0,
    systemStatus: 'operational'
  });
  const [tableData, setTableData] = useState({
    windows: [],
    todayVisits: 0,
    averageTurnaroundTime: '0 mins'
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Extract fetchDashboardData function to be reusable
  const fetchDashboardData = useCallback(async () => {
    try {
      const baseUrl = API_CONFIG.getAdminUrl();

      // Parallelize independent API calls for faster loading
      const [windowsResponse, tableResponse] = await Promise.all([
        authFetch(`${baseUrl}/api/windows/registrar`),
        authFetch(`${baseUrl}/api/analytics/dashboard-table-data/registrar`)
      ]);

      const windows = windowsResponse.ok ? await windowsResponse.json() : [];
      const tableResult = tableResponse.ok ? await tableResponse.json() : { data: { windows: [], todayVisits: 0, averageTurnaroundTime: '0 mins' } };

      // Transform windows data to match dashboard table format
      const transformedWindows = windows.map(window => ({
        windowName: window.name,
        incomingNumber: 0, // Default to 0, could be enhanced with real queue data
        currentServingNumber: 0 // Default to 0, could be enhanced with real queue data
      }));

      // Merge analytics data with transformed windows
      const analyticsWindowsMap = new Map(
        tableResult.data.windows.map(w => [w.windowName, w])
      );

      // Update transformed windows with analytics data where available
      const finalWindows = transformedWindows.map(window => {
        const analyticsData = analyticsWindowsMap.get(window.windowName);
        return analyticsData ? analyticsData : window;
      });

      // Mock stats based on actual data
      const mockStats = {
        queueLength: 8,
        servedToday: 23,
        activeWindows: windows.length,
        systemStatus: 'operational'
      };

      // Mock recent activity
      const mockActivity = [
        {
          id: 1,
          type: 'queue',
          message: 'Queue #15 served at Window 1',
          timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          icon: '📋'
        },
        {
          id: 2,
          type: 'service',
          message: 'Enrollment service completed',
          timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          icon: '✅'
        },
        {
          id: 3,
          type: 'queue',
          message: 'Queue #14 served at Window 2',
          timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
          icon: '📋'
        },
        {
          id: 4,
          type: 'user',
          message: 'New queue number issued: #16',
          timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
          icon: '👤'
        }
      ];

      setStats(mockStats);
      setTableData({
        windows: finalWindows,
        todayVisits: tableResult.data.todayVisits,
        averageTurnaroundTime: tableResult.data.averageTurnaroundTime
      });
      setRecentActivity(mockActivity);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []); // Empty dependency array since it doesn't depend on any props or state

  // Initial data fetch
  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Join Socket.io room and listen for real-time updates
  useEffect(() => {
    if (!socket || !isConnected) return;

    console.log('🔌 Registrar Dashboard: Joining admin-registrar room');
    joinRoom('admin-registrar');

    // Subscribe to windows updates
    const unsubscribe = subscribe('windows-updated', (data) => {
      if (data.department === 'registrar') {
        console.log('📡 Windows updated for registrar dashboard:', data);
        // Refetch dashboard data when windows change
        fetchDashboardData();
      }
    });

    return () => {
      unsubscribe();
      leaveRoom('admin-registrar');
    };
  }, [socket, isConnected, fetchDashboardData]);

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
          <div className="h-5 sm:h-6 bg-gray-200 rounded w-32 sm:w-40 animate-pulse"></div>
        </div>

        {/* Dashboard Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 md:gap-4 min-h-[480px]">
          {/* Row 1 - Upper row (40% height) */}
          <div className="col-span-1">
            {/* Window & Incoming Queue Table Skeleton */}
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 p-3 sm:p-4 h-full">
              <div className="space-y-1">
                {/* Header Row Skeleton */}
                <div className="bg-gray-300 rounded-lg grid grid-cols-2 gap-0 animate-pulse">
                  <div className="px-2 sm:px-3 py-1.5 sm:py-2 h-7 sm:h-8"></div>
                  <div className="px-2 sm:px-3 py-1.5 sm:py-2 h-7 sm:h-8"></div>
                </div>

                {/* Data Rows Skeleton */}
                {[...Array(4)].map((_, index) => (
                  <div key={index} className="bg-gray-100 rounded-lg grid grid-cols-2 gap-0 animate-pulse">
                    <div className="px-2 sm:px-3 py-1.5 sm:py-2">
                      <div className="h-3 bg-gray-200 rounded w-10 sm:w-12 mx-auto"></div>
                    </div>
                    <div className="px-2 sm:px-3 py-1.5 sm:py-2">
                      <div className="h-3 bg-gray-200 rounded w-5 sm:w-6 mx-auto"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="col-span-1">
            {/* Window & Now Serving Table Skeleton */}
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 p-3 sm:p-4 h-full">
              <div className="space-y-1">
                {/* Header Row Skeleton */}
                <div className="bg-gray-300 rounded-lg grid grid-cols-2 gap-0 animate-pulse">
                  <div className="px-2 sm:px-3 py-1.5 sm:py-2 h-7 sm:h-8"></div>
                  <div className="px-2 sm:px-3 py-1.5 sm:py-2 h-7 sm:h-8"></div>
                </div>

                {/* Data Rows Skeleton */}
                {[...Array(4)].map((_, index) => (
                  <div key={index} className="bg-gray-100 rounded-lg grid grid-cols-2 gap-0 animate-pulse">
                    <div className="px-2 sm:px-3 py-1.5 sm:py-2">
                      <div className="h-3 bg-gray-200 rounded w-10 sm:w-12 mx-auto"></div>
                    </div>
                    <div className="px-2 sm:px-3 py-1.5 sm:py-2">
                      <div className="h-3 bg-gray-200 rounded w-5 sm:w-6 mx-auto"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="col-span-1 grid grid-rows-2 gap-2 sm:gap-2.5">
            {/* Statistics Cards Skeleton */}
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 p-3 sm:p-4 flex flex-col justify-center items-center">
              <div className="w-10 h-8 sm:w-12 sm:h-10 bg-gray-300 rounded mb-1 animate-pulse"></div>
              <div className="h-3 bg-gray-200 rounded w-14 sm:w-16 animate-pulse"></div>
            </div>
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 p-3 sm:p-4 flex flex-col justify-center items-center">
              <div className="w-14 h-8 sm:w-16 sm:h-10 bg-gray-300 rounded mb-1 animate-pulse"></div>
              <div className="h-3 bg-gray-200 rounded w-24 sm:w-28 animate-pulse"></div>
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
          Queue Monitoring
        </h1>
        <button
          onClick={() => setIsDateRangeModalOpen(true)}
          className="w-full sm:w-auto px-4 sm:px-5 py-2 sm:py-2.5 bg-[#1F3463] text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-[#152847] transition-all duration-200 active:scale-95 shadow-lg shadow-[#1F3463]/20 hover:shadow-[#1F3463]/30 focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:ring-offset-2"
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
        userRole="Registrar Admin"
      />

      {/* Analytical Report Modal */}
      <AnalyticalReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        userRole="Registrar Admin"
        dateRange={selectedDateRange}
      />

      {/* New Grid Layout - 2 rows (40%/60%), 3 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 md:gap-4" style={{ gridTemplateRows: 'auto auto' }}>
        {/* Row 1 - Upper row (40% height) */}
        <div className="col-span-1">
          {/* Row 1, Column 1 - Window & Incoming Queue Table */}
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg shadow-[#1F3463]/10 border border-gray-200 p-3 sm:p-4 h-full hover:shadow-xl hover:shadow-[#1F3463]/15 transition-shadow duration-300">
            <div className="space-y-1">
              {/* Header Row */}
              <div className="bg-[#1F3463] text-white rounded-lg grid grid-cols-2 gap-0">
                <div className="px-2 sm:px-3 py-1.5 sm:py-2 text-center text-xs sm:text-sm font-bold">Window</div>
                <div className="px-2 sm:px-3 py-1.5 sm:py-2 text-center text-xs sm:text-sm font-bold">Incoming Number</div>
              </div>

              {/* Data Rows */}
              {tableData.windows.slice(0, 4).map((window, index) => (
                <div key={index} className="bg-gray-100 rounded-lg grid grid-cols-2 gap-0">
                  <div className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-900 font-medium text-center">{window.windowName}</div>
                  <div className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-900 font-bold text-center">
                    {window.incomingNumber > 0 ? window.incomingNumber : '-'}
                  </div>
                </div>
              ))}

              {/* Fill remaining rows if less than 4 windows */}
              {Array.from({ length: Math.max(0, 4 - tableData.windows.length) }).map((_, index) => (
                <div key={`empty-${index}`} className="bg-gray-100 rounded-lg grid grid-cols-2 gap-0">
                  <div className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-400 text-center">-</div>
                  <div className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-400 text-center">-</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-span-1">
          {/* Row 1, Column 2 - Window & Now Serving Table */}
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg shadow-[#1F3463]/10 border border-gray-200 p-3 sm:p-4 h-full hover:shadow-xl hover:shadow-[#1F3463]/15 transition-shadow duration-300">
            <div className="space-y-1">
              {/* Header Row */}
              <div className="bg-[#1F3463] text-white rounded-lg grid grid-cols-2 gap-0">
                <div className="px-2 sm:px-3 py-1.5 sm:py-2 text-center text-xs sm:text-sm font-bold">Window</div>
                <div className="px-2 sm:px-3 py-1.5 sm:py-2 text-center text-xs sm:text-sm font-bold">Now Serving</div>
              </div>

              {/* Data Rows */}
              {tableData.windows.slice(0, 4).map((window, index) => (
                <div key={index} className="bg-gray-100 rounded-lg grid grid-cols-2 gap-0">
                  <div className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-900 font-medium text-center">{window.windowName}</div>
                  <div className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-900 font-bold text-center">
                    {window.currentServingNumber > 0 ? window.currentServingNumber : '-'}
                  </div>
                </div>
              ))}

              {/* Fill remaining rows if less than 4 windows */}
              {Array.from({ length: Math.max(0, 4 - tableData.windows.length) }).map((_, index) => (
                <div key={`empty-${index}`} className="bg-gray-100 rounded-lg grid grid-cols-2 gap-0">
                  <div className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-400 text-center">-</div>
                  <div className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-400 text-center">-</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-span-1 lg:col-span-1 grid grid-rows-2 gap-2 sm:gap-2.5">
          {/* Row 1, Column 3 - Statistics Cards */}
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg shadow-[#1F3463]/10 border border-gray-200 p-3 sm:p-4 flex flex-col justify-center items-center hover:shadow-xl hover:shadow-[#1F3463]/15 transition-shadow duration-300">
            <div className="text-xl sm:text-2xl font-bold text-[#1F3463] mb-1">{tableData.todayVisits}</div>
            <div className="text-xs sm:text-sm text-gray-600 text-center font-medium">Visits Today</div>
          </div>
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg shadow-[#1F3463]/10 border border-gray-200 p-3 sm:p-4 flex flex-col justify-center items-center hover:shadow-xl hover:shadow-[#1F3463]/15 transition-shadow duration-300">
            <div className="text-xl sm:text-2xl font-bold text-[#1F3463] mb-1">{tableData.averageTurnaroundTime}</div>
            <div className="text-xs sm:text-sm text-gray-600 text-center font-medium">Average Turnaround Time</div>
          </div>
        </div>

        {/* Pie Chart - Positioned after Statistics Cards on md, stays in row 2 on lg */}
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

export default RegistrarAdminDashboard;
