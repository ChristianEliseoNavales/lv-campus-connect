import React, { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../../../contexts/AuthContext';
import { RoleAwareAreaChart } from '../../ui/AreaChart';
import { ChartPieLegend } from '../../ui/PieChart';
import AnalyticalReportModal from '../../ui/AnalyticalReportModal';
import DateRangeModal from '../../ui/DateRangeModal';
import API_CONFIG from '../../../config/api';
import { authFetch } from '../../../utils/apiClient';

const AdmissionsAdminDashboard = () => {
  const { user } = useAuth();
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
  const [socket, setSocket] = useState(null);

  // Extract fetchDashboardData function to be reusable
  const fetchDashboardData = useCallback(async () => {
    try {
      const baseUrl = API_CONFIG.getAdminUrl();

      // Fetch windows data
      const windowsResponse = await authFetch(`${baseUrl}/api/windows/admissions`);
      const windows = windowsResponse.ok ? await windowsResponse.json() : [];

      // Fetch table data for analytics (visits, turnaround time)
      const tableResponse = await authFetch(`${baseUrl}/api/analytics/dashboard-table-data/admissions`);
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
        queueLength: 5,
        servedToday: 18,
        activeWindows: windows.length,
        systemStatus: 'operational'
      };

      // Mock recent activity
      const mockActivity = [
        {
          id: 1,
          type: 'queue',
          message: 'Queue #12 served at Window 1',
          timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
          icon: '🎓'
        },
        {
          id: 2,
          type: 'service',
          message: 'Application review completed',
          timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
          icon: '✅'
        },
        {
          id: 3,
          type: 'queue',
          message: 'Queue #11 served at Window 2',
          timestamp: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
          icon: '🎓'
        },
        {
          id: 4,
          type: 'user',
          message: 'New application submitted: #13',
          timestamp: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
          icon: '📄'
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

  // Initialize Socket.io connection for real-time updates
  useEffect(() => {
    const socketUrl = API_CONFIG.getAdminUrl();
    const newSocket = io(socketUrl);
    setSocket(newSocket);

    // Join admin room for real-time updates
    newSocket.emit('join-room', 'admin-admissions');

    // Listen for windows updates
    newSocket.on('windows-updated', (data) => {
      if (data.department === 'admissions') {
        console.log('📡 Windows updated for admissions dashboard:', data);
        // Refetch dashboard data when windows change
        fetchDashboardData();
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, []); // Empty dependency array - Socket.io connection should only be created once

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
          <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
        </div>

        {/* Dashboard Grid Skeleton */}
        <div className="grid grid-cols-3 gap-6 min-h-[600px]">
          {/* Row 1 - Upper row (40% height) */}
          <div className="col-span-1">
            {/* Window & Incoming Queue Table Skeleton */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 h-full">
              <div className="space-y-2">
                {/* Header Row Skeleton */}
                <div className="bg-gray-300 rounded-lg grid grid-cols-2 gap-0 animate-pulse">
                  <div className="px-4 py-3 h-10"></div>
                  <div className="px-4 py-3 h-10"></div>
                </div>

                {/* Data Rows Skeleton */}
                {[...Array(4)].map((_, index) => (
                  <div key={index} className="bg-gray-100 rounded-lg grid grid-cols-2 gap-0 animate-pulse">
                    <div className="px-4 py-3">
                      <div className="h-4 bg-gray-200 rounded w-16 mx-auto"></div>
                    </div>
                    <div className="px-4 py-3">
                      <div className="h-4 bg-gray-200 rounded w-8 mx-auto"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="col-span-1">
            {/* Window & Now Serving Table Skeleton */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 h-full">
              <div className="space-y-2">
                {/* Header Row Skeleton */}
                <div className="bg-gray-300 rounded-lg grid grid-cols-2 gap-0 animate-pulse">
                  <div className="px-4 py-3 h-10"></div>
                  <div className="px-4 py-3 h-10"></div>
                </div>

                {/* Data Rows Skeleton */}
                {[...Array(4)].map((_, index) => (
                  <div key={index} className="bg-gray-100 rounded-lg grid grid-cols-2 gap-0 animate-pulse">
                    <div className="px-4 py-3">
                      <div className="h-4 bg-gray-200 rounded w-16 mx-auto"></div>
                    </div>
                    <div className="px-4 py-3">
                      <div className="h-4 bg-gray-200 rounded w-8 mx-auto"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="col-span-1 grid grid-rows-2 gap-3">
            {/* Statistics Cards Skeleton */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 flex flex-col justify-center items-center">
              <div className="w-16 h-12 bg-gray-300 rounded mb-2 animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>
            </div>
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 flex flex-col justify-center items-center">
              <div className="w-20 h-12 bg-gray-300 rounded mb-2 animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
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
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold text-[#1F3463] tracking-tight">
          Queue Monitoring
        </h1>
        <button
          onClick={() => setIsDateRangeModalOpen(true)}
          className="px-6 py-3 bg-[#1F3463] text-white rounded-lg font-semibold hover:bg-[#152847] transition-colors duration-200 shadow-md hover:shadow-lg"
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
        userRole="Admissions Admin"
      />

      {/* Analytical Report Modal */}
      <AnalyticalReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        userRole="Admissions Admin"
        dateRange={selectedDateRange}
      />

      {/* New Grid Layout - 2 rows (40%/60%), 3 columns */}
      <div className="grid grid-cols-3 gap-6 min-h-[600px]">
        {/* Row 1 - Upper row (40% height) */}
        <div className="col-span-1">
          {/* Row 1, Column 1 - Window & Incoming Queue Table */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 h-full">
            <div className="space-y-2">
              {/* Header Row */}
              <div className="bg-[#1F3463] text-white rounded-lg grid grid-cols-2 gap-0">
                <div className="px-4 py-3 text-center text-base font-bold">Window</div>
                <div className="px-4 py-3 text-center text-base font-bold">Incoming Number</div>
              </div>

              {/* Data Rows */}
              {tableData.windows.slice(0, 4).map((window, index) => (
                <div key={index} className="bg-gray-100 rounded-lg grid grid-cols-2 gap-0">
                  <div className="px-4 py-3 text-base text-gray-900 font-medium text-center">{window.windowName}</div>
                  <div className="px-4 py-3 text-base text-gray-900 font-bold text-center">
                    {window.incomingNumber > 0 ? window.incomingNumber : '-'}
                  </div>
                </div>
              ))}

              {/* Fill remaining rows if less than 4 windows */}
              {Array.from({ length: Math.max(0, 4 - tableData.windows.length) }).map((_, index) => (
                <div key={`empty-${index}`} className="bg-gray-100 rounded-lg grid grid-cols-2 gap-0">
                  <div className="px-4 py-3 text-base text-gray-400 text-center">-</div>
                  <div className="px-4 py-3 text-base text-gray-400 text-center">-</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-span-1">
          {/* Row 1, Column 2 - Window & Now Serving Table */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 h-full">
            <div className="space-y-2">
              {/* Header Row */}
              <div className="bg-[#1F3463] text-white rounded-lg grid grid-cols-2 gap-0">
                <div className="px-4 py-3 text-center text-base font-bold">Window</div>
                <div className="px-4 py-3 text-center text-base font-bold">Now Serving</div>
              </div>

              {/* Data Rows */}
              {tableData.windows.slice(0, 4).map((window, index) => (
                <div key={index} className="bg-gray-100 rounded-lg grid grid-cols-2 gap-0">
                  <div className="px-4 py-3 text-base text-gray-900 font-medium text-center">{window.windowName}</div>
                  <div className="px-4 py-3 text-base text-gray-900 font-bold text-center">
                    {window.currentServingNumber > 0 ? window.currentServingNumber : '-'}
                  </div>
                </div>
              ))}

              {/* Fill remaining rows if less than 4 windows */}
              {Array.from({ length: Math.max(0, 4 - tableData.windows.length) }).map((_, index) => (
                <div key={`empty-${index}`} className="bg-gray-100 rounded-lg grid grid-cols-2 gap-0">
                  <div className="px-4 py-3 text-base text-gray-400 text-center">-</div>
                  <div className="px-4 py-3 text-base text-gray-400 text-center">-</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-span-1 grid grid-rows-2 gap-3">
          {/* Row 1, Column 3 - Statistics Cards */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 flex flex-col justify-center items-center">
            <div className="text-4xl font-bold text-[#1F3463] mb-2">{tableData.todayVisits}</div>
            <div className="text-base text-gray-600 text-center font-medium">Visits Today</div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 flex flex-col justify-center items-center">
            <div className="text-4xl font-bold text-[#1F3463] mb-2">{tableData.averageTurnaroundTime}</div>
            <div className="text-base text-gray-600 text-center font-medium">Average Turnaround Time</div>
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

export default AdmissionsAdminDashboard;
