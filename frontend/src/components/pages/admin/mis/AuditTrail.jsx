import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MdSearch, MdKeyboardArrowUp, MdKeyboardArrowDown, MdHistory } from 'react-icons/md';
import { IoMdRefresh } from 'react-icons/io';
import { ToastContainer, DatePicker, Pagination } from '../../../ui';
import { useNotification } from '../../../../hooks/useNotification';
import useURLState from '../../../../hooks/useURLState';
import { formatDateForAPI } from '../../../../utils/philippineTimezone';
import API_CONFIG from '../../../../config/api';
import { authFetch } from '../../../../utils/apiClient';

// Define initial state outside component to prevent recreation
const INITIAL_URL_STATE = {
  searchTerm: '',
  filterBy: 'all',
  selectedDate: null,
  logsPerPage: 10,
  currentPage: 1
};

const AuditTrail = () => {
  // URL-persisted state management
  const { state: urlState, updateState } = useURLState(INITIAL_URL_STATE);

  // Extract URL state values
  const { searchTerm, filterBy, selectedDate, logsPerPage, currentPage } = urlState;

  // Non-persisted state (resets on navigation)
  const [auditLogs, setAuditLogs] = useState([]);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalCount: 0, limit: 10 });
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(new Date());

  // Ref to track if we've shown an error for the current fetch attempt
  const errorShownRef = useRef(false);

  // Notifications (saves to database)
  const { toasts, removeToast, showSuccess, showError } = useNotification();

  // Memoize the date parameter to prevent unnecessary API calls
  const dateParam = useMemo(() => {
    if (!selectedDate) return null;
    return formatDateForAPI(selectedDate);
  }, [selectedDate]);

  // Fetch audit logs - depends on pagination and filter changes
  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    errorShownRef.current = false;

    try {
      const params = new URLSearchParams();

      // Add pagination params
      params.append('page', currentPage.toString());
      params.append('limit', logsPerPage.toString());

      // Add filters
      if (dateParam) {
        params.append('startDate', dateParam);
        params.append('endDate', dateParam);
      }
      if (searchTerm && searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }
      if (filterBy && filterBy !== 'all') {
        params.append('filterBy', filterBy);
      }

      const url = `${API_CONFIG.getAdminUrl()}/api/audit?${params.toString()}`;

      const response = await authFetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setAuditLogs(result.data);
        setPagination(result.pagination || { currentPage: 1, totalPages: 1, totalCount: 0, limit: logsPerPage });
        setLastRefreshTime(new Date());
      } else {
        throw new Error(result.error || 'Failed to fetch audit logs');
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      setFetchError(error.message);
      setAuditLogs([]);
      setPagination({ currentPage: 1, totalPages: 1, totalCount: 0, limit: logsPerPage });
    } finally {
      setLoading(false);
    }
  }, [currentPage, logsPerPage, dateParam, searchTerm, filterBy]); // Dependencies include all filter params

  // Manual refresh function for audit logs
  const handleManualRefresh = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      await fetchAuditLogs();
      showSuccess('Refreshed', 'Audit logs updated successfully');
    } catch (error) {
      console.error('Manual refresh error:', error);
      showError('Refresh Failed', 'Unable to update audit logs');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Show error toast only once per fetch attempt
  useEffect(() => {
    if (fetchError && !errorShownRef.current) {
      showError('Error', fetchError);
      errorShownRef.current = true;
    }
  }, [fetchError, showError]);

  // Effect for fetching data - triggers on filter/pagination changes
  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  // Reset to first page when filters change (separate effect to avoid circular dependency)
  useEffect(() => {
    if (currentPage > 1) {
      updateState('currentPage', 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, filterBy]); // Only reset when filters change, not when currentPage changes

  // Pagination - use backend pagination data
  const totalPages = pagination.totalPages || 1;
  const totalCount = pagination.totalCount || 0;
  const currentLogs = auditLogs; // Backend already returns paginated data

  // Handle pagination
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      updateState('currentPage', newPage);
    }
  };

  // Handle logs per page change
  const handleLogsPerPageChange = (increment) => {
    const newValue = Math.max(5, Math.min(50, logsPerPage + increment));
    updateState('logsPerPage', newValue);
  };

  // Format refresh time
  const formatRefreshTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  // Format date and time for display
  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    const time = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    const dateStr = date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
    return { time, date: dateStr };
  };

  // Get department badge color
  const getDepartmentColor = (department) => {
    switch (department) {
      case 'MIS': return 'bg-blue-100 text-blue-800';
      case 'Registrar': return 'bg-green-100 text-green-800';
      case 'Admissions': return 'bg-purple-100 text-purple-800';
      case 'HR': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-5">
      {/* Main Content Container - White background similar to Settings.jsx */}
      <div className="bg-white p-3 sm:p-4 md:p-5 border border-gray-200 rounded-xl sm:rounded-2xl">

        {/* Row 1 - Header */}
        <div className="mb-3 sm:mb-4 md:mb-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">Audit Trail</h1>
            <div className="flex items-center space-x-1">
              <p className="text-[8px] sm:text-[9px] text-gray-500 uppercase tracking-wide">
                As of {formatRefreshTime(lastRefreshTime)}
              </p>
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="p-1.5 transition-all duration-200 hover:bg-[#1F3463]/10 rounded-lg border border-[#1F3463]/20 hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:ring-offset-1 disabled:bg-gray-400 disabled:border-gray-400 disabled:cursor-not-allowed disabled:hover:bg-gray-400 disabled:hover:scale-100"
                title="Refresh audit logs"
              >
                <IoMdRefresh
                  className={`w-4 h-4 sm:w-5 sm:h-5 text-[#1F3463] transition-transform duration-200 ${isRefreshing ? 'animate-spin' : ''} disabled:text-gray-600`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Row 2 - Controls */}
        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3 mb-3 sm:mb-4 md:mb-5">
          {/* Left side - Pagination Control */}
          <div className="flex items-center space-x-1.5">
            <span className="text-xs sm:text-sm text-gray-700 font-medium">Showing</span>
            <div className="flex items-center space-x-1">
              <input
                type="number"
                value={logsPerPage}
                onChange={(e) => updateState('logsPerPage', Math.max(5, Math.min(50, parseInt(e.target.value) || 10)))}
                className="w-10 sm:w-12 px-1 sm:px-1.5 py-0.5 text-xs sm:text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent"
                min="5"
                max="50"
              />
              <div className="flex flex-col">
                <button
                  onClick={() => handleLogsPerPageChange(1)}
                  className="p-0.5 text-gray-500 hover:text-[#1F3463] transition-colors"
                >
                  <MdKeyboardArrowUp className="text-xs sm:text-sm" />
                </button>
                <button
                  onClick={() => handleLogsPerPageChange(-1)}
                  className="p-0.5 text-gray-500 hover:text-[#1F3463] transition-colors"
                >
                  <MdKeyboardArrowDown className="text-xs sm:text-sm" />
                </button>
              </div>
            </div>
            <span className="text-xs sm:text-sm text-gray-700 font-medium">Logs</span>
          </div>

          {/* Right side - Date Filter, Search, Filter dropdown */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            {/* Date Filter */}
            <div className="flex items-center space-x-1.5">
              <label className="text-xs sm:text-sm text-gray-700 font-medium whitespace-nowrap">Date:</label>
              <DatePicker
                value={selectedDate}
                onChange={(date) => updateState('selectedDate', date)}
                placeholder="All Dates"
              />
            </div>

            {/* Search */}
            <div className="relative flex-1 sm:flex-initial">
              <MdSearch className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 text-base sm:text-lg" />
              <input
                type="text"
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => updateState('searchTerm', e.target.value)}
                className="w-full sm:w-52 pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-[#1F3463] focus:border-transparent transition-all duration-200"
              />
            </div>

            {/* Filter */}
            <div className="flex items-center space-x-1.5">
              <label className="text-xs sm:text-sm text-gray-700 font-medium whitespace-nowrap">Filter by:</label>
              <select
                value={filterBy}
                onChange={(e) => updateState('filterBy', e.target.value)}
                className="flex-1 sm:flex-initial px-2 sm:px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-[#1F3463] focus:border-transparent transition-all duration-200"
              >
                <option value="all">All Actions</option>
                <option value="user_actions">User Management</option>
                <option value="queue_actions">Queue Operations</option>
                <option value="settings_actions">Settings Changes</option>
                <option value="failed_actions">Failed Actions</option>
              </select>
            </div>
          </div>
        </div>

        {/* Audit Logs Table */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {loading ? (
            <>
              {/* Table Header */}
              <div className="bg-[#1F3463] px-3 sm:px-4 md:px-5 py-2.5 sm:py-3 md:py-3 border-b border-[#1F3463] min-h-[2.5rem] sm:min-h-[2.75rem] md:min-h-[3rem] flex items-center">
                <div className="grid grid-cols-5 gap-2 sm:gap-3 text-xs sm:text-sm font-bold text-white w-full">
                  <div className="whitespace-normal break-words leading-tight">Time</div>
                  <div className="whitespace-normal break-words leading-tight">Date</div>
                  <div className="whitespace-normal break-words leading-tight">User</div>
                  <div className="whitespace-normal break-words leading-tight">Activity</div>
                  <div className="whitespace-normal break-words leading-tight">Department</div>
                </div>
              </div>

              {/* Skeleton Loading Rows */}
              <div className="divide-y divide-gray-200">
                {[...Array(7)].map((_, index) => (
                  <div key={index} className="px-3 sm:px-4 md:px-5 py-2.5 sm:py-3 md:py-3 md:h-12 flex items-center animate-pulse">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-2 sm:gap-3 items-center w-full">
                      <div className="h-2.5 sm:h-3 bg-gray-200 rounded w-10 sm:w-11 md:w-12"></div>
                      <div className="hidden md:block h-2.5 sm:h-3 bg-gray-200 rounded w-14 sm:w-15 md:w-16"></div>
                      <div className="hidden md:block h-2.5 sm:h-3 bg-gray-200 rounded w-18 sm:w-19 md:w-20"></div>
                      <div className="h-2.5 sm:h-3 bg-gray-200 rounded w-28 sm:w-30 md:w-32"></div>
                      <div className="h-4 sm:h-4.5 md:h-5 bg-gray-200 rounded-full w-10 sm:w-11 md:w-12"></div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : currentLogs.length === 0 ? (
            <div className="text-center py-8 sm:py-10">
              <MdHistory className="text-4xl sm:text-5xl text-gray-300 mx-auto mb-2 sm:mb-3" />
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1 sm:mb-1.5">No audit logs found</h3>
              <p className="text-xs sm:text-sm text-gray-500">Try adjusting your search or filter criteria</p>
            </div>
          ) : (
            <>
              {/* Table Header - Hidden on mobile, shown on md+ */}
              <div className="hidden md:flex bg-[#1F3463] px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 md:py-3 border-b border-[#1F3463] items-center shadow-sm min-h-[2.5rem] sm:min-h-[2.75rem] md:min-h-[3rem]">
                <div className="grid grid-cols-5 gap-2 sm:gap-3 text-xs sm:text-sm font-bold text-white w-full">
                  <div className="whitespace-normal break-words leading-tight">Time</div>
                  <div className="whitespace-normal break-words leading-tight">Date</div>
                  <div className="whitespace-normal break-words leading-tight">User</div>
                  <div className="whitespace-normal break-words leading-tight">Activity</div>
                  <div className="whitespace-normal break-words leading-tight">Department/Office</div>
                </div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-gray-200">
                {currentLogs.map((log, index) => {
                  const { time, date } = formatDateTime(log.createdAt);
                  return (
                    <div key={log._id} className={`px-3 sm:px-4 md:px-5 py-2.5 sm:py-3 hover:bg-gray-50 transition-colors duration-200 md:h-12 flex items-center ${index % 2 === 0 ? 'bg-white' : 'bg-slate-100'}`}>
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-1.5 sm:gap-2 md:gap-3 items-start md:items-center w-full">
                        {/* Time */}
                        <div className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                          <span className="md:hidden text-[10px] text-gray-500 uppercase tracking-wide block mb-0.5">Time</span>
                          {time}
                        </div>

                        {/* Date */}
                        <div className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                          <span className="md:hidden text-[10px] text-gray-500 uppercase tracking-wide block mb-0.5">Date</span>
                          {date}
                        </div>

                        {/* User */}
                        <div className="text-xs sm:text-sm font-medium text-gray-900 truncate" title={log.userEmail || 'Unknown Email'}>
                          <span className="md:hidden text-[10px] text-gray-500 uppercase tracking-wide block mb-0.5">User</span>
                          {log.userEmail || 'Unknown Email'}
                        </div>

                        {/* Activity */}
                        <div className="text-xs sm:text-sm font-medium text-gray-900 truncate" title={log.actionDescription}>
                          <span className="md:hidden text-[10px] text-gray-500 uppercase tracking-wide block mb-0.5">Activity</span>
                          {log.actionDescription}
                        </div>

                        {/* Department */}
                        <div className="truncate">
                          <span className="md:hidden text-[10px] text-gray-500 uppercase tracking-wide block mb-0.5">Department</span>
                          {log.department && (
                            <span className={`inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold shadow-sm transition-all duration-200 ${getDepartmentColor(log.department)}`}>
                              {log.department}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-3 sm:mt-4 md:mt-5 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-0">
            <div className="text-[10px] sm:text-xs md:text-sm text-gray-700 font-medium order-2 sm:order-1">
              Showing {((currentPage - 1) * logsPerPage) + 1} to {Math.min(currentPage * logsPerPage, totalCount)} of {totalCount} logs
            </div>
            <div className="order-1 sm:order-2">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                size="md"
              />
            </div>
          </div>
        )}
      </div>

      {/* Toast Container */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
};

export default AuditTrail;
