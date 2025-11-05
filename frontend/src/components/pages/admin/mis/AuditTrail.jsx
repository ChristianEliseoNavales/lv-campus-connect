import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MdSearch, MdKeyboardArrowUp, MdKeyboardArrowDown, MdHistory } from 'react-icons/md';
import { IoMdRefresh } from 'react-icons/io';
import { useToast, ToastContainer, DatePicker } from '../../../ui';
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
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(new Date());

  // Ref to track if we've shown an error for the current fetch attempt
  const errorShownRef = useRef(false);

  // Toast notifications
  const { toasts, removeToast, showSuccess, showError } = useToast();

  // Memoize the date parameter to prevent unnecessary API calls
  const dateParam = useMemo(() => {
    if (!selectedDate) return null;
    return formatDateForAPI(selectedDate);
  }, [selectedDate]);

  // Fetch audit logs - only depends on date changes
  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    errorShownRef.current = false;

    try {
      let url = `${API_CONFIG.getAdminUrl()}/api/audit`;
      const params = new URLSearchParams();

      if (dateParam) {
        params.append('startDate', dateParam);
        params.append('endDate', dateParam);
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await authFetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setAuditLogs(result.data);
        setLastRefreshTime(new Date());
      } else {
        throw new Error(result.error || 'Failed to fetch audit logs');
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      setFetchError(error.message);
      setAuditLogs([]);
    } finally {
      setLoading(false);
    }
  }, [dateParam]);

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

  // Initial data fetch
  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  // Filter and search logic
  useEffect(() => {
    let filtered = [...auditLogs];

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(log =>
        log.actionDescription?.toLowerCase().includes(searchLower) ||
        log.userName?.toLowerCase().includes(searchLower) ||
        log.userEmail?.toLowerCase().includes(searchLower) ||
        log.resourceName?.toLowerCase().includes(searchLower) ||
        log.action?.toLowerCase().includes(searchLower)
      );
    }

    // Apply filter by action type
    if (filterBy !== 'all') {
      filtered = filtered.filter(log => {
        switch (filterBy) {
          case 'user_actions':
            return log.action?.startsWith('USER_');
          case 'queue_actions':
            return log.action?.startsWith('QUEUE_');
          case 'settings_actions':
            return log.action?.includes('SETTINGS') || log.action?.includes('CONFIG');
          case 'failed_actions':
            return !log.success;
          default:
            return true;
        }
      });
    }

    setFilteredLogs(filtered);
    // Reset to first page when filters change
    if (currentPage > 1) {
      updateState('currentPage', 1);
    }
  }, [auditLogs, searchTerm, filterBy, currentPage, updateState]);

  // Pagination logic
  const totalPages = Math.ceil(filteredLogs.length / logsPerPage);
  const startIndex = (currentPage - 1) * logsPerPage;
  const currentLogs = filteredLogs.slice(startIndex, startIndex + logsPerPage);

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
    <div className="space-y-6">
      {/* Main Content Container - White background similar to Settings.jsx */}
      <div className="bg-white p-6 border border-gray-200 rounded-xl">

        {/* Row 1 - Header */}
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Audit Trail</h1>
            <div className="flex items-center space-x-1">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">
                As of {formatRefreshTime(lastRefreshTime)}
              </p>
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="p-2 transition-colors duration-200 hover:bg-[#1F3463]/10 rounded-lg border border-[#1F3463]/20"
                title="Refresh audit logs"
              >
                <IoMdRefresh
                  className={`w-6 h-6 text-[#1F3463] ${isRefreshing ? 'animate-spin' : ''}`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Row 2 - Controls */}
        <div className="flex justify-between items-center mb-6">
          {/* Left side - Pagination Control */}
          <div className="flex items-center space-x-2">
            <span className="text-base text-gray-700 font-medium">Showing</span>
            <div className="flex items-center space-x-1">
              <input
                type="number"
                value={logsPerPage}
                onChange={(e) => updateState('logsPerPage', Math.max(5, Math.min(50, parseInt(e.target.value) || 10)))}
                className="w-16 px-2 py-1 text-base border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent"
                min="5"
                max="50"
              />
              <div className="flex flex-col">
                <button
                  onClick={() => handleLogsPerPageChange(1)}
                  className="p-1 text-gray-500 hover:text-[#1F3463] transition-colors"
                >
                  <MdKeyboardArrowUp className="text-base" />
                </button>
                <button
                  onClick={() => handleLogsPerPageChange(-1)}
                  className="p-1 text-gray-500 hover:text-[#1F3463] transition-colors"
                >
                  <MdKeyboardArrowDown className="text-base" />
                </button>
              </div>
            </div>
            <span className="text-base text-gray-700 font-medium">Logs</span>
          </div>

          {/* Right side - Date Filter, Search, Filter dropdown */}
          <div className="flex items-center space-x-4">
            {/* Date Filter */}
            <div className="flex items-center space-x-2">
              <label className="text-base text-gray-700 font-medium">Date:</label>
              <DatePicker
                value={selectedDate}
                onChange={(date) => updateState('selectedDate', date)}
                placeholder="All Dates"
              />
            </div>

            {/* Search */}
            <div className="relative">
              <MdSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-xl" />
              <input
                type="text"
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => updateState('searchTerm', e.target.value)}
                className="w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent"
              />
            </div>

            {/* Filter */}
            <div className="flex items-center space-x-2">
              <label className="text-base text-gray-700 font-medium">Filter by:</label>
              <select
                value={filterBy}
                onChange={(e) => updateState('filterBy', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent"
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
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 h-16 flex items-center">
                <div className="grid grid-cols-5 gap-4 text-base font-bold text-gray-700 w-full">
                  <div>Time</div>
                  <div>Date</div>
                  <div>User</div>
                  <div>Activity</div>
                  <div>Department</div>
                </div>
              </div>

              {/* Skeleton Loading Rows */}
              <div className="divide-y divide-gray-200">
                {[...Array(7)].map((_, index) => (
                  <div key={index} className="px-6 py-4 h-16 flex items-center animate-pulse">
                    <div className="grid grid-cols-5 gap-4 items-center w-full">
                      <div className="h-4 bg-gray-200 rounded w-16"></div>
                      <div className="h-4 bg-gray-200 rounded w-20"></div>
                      <div className="h-4 bg-gray-200 rounded w-24"></div>
                      <div className="h-4 bg-gray-200 rounded w-40"></div>
                      <div className="h-6 bg-gray-200 rounded-full w-16"></div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : currentLogs.length === 0 ? (
            <div className="text-center py-12">
              <MdHistory className="text-6xl text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No audit logs found</h3>
              <p className="text-base text-gray-500">Try adjusting your search or filter criteria</p>
            </div>
          ) : (
            <>
              {/* Table Header */}
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 h-16 flex items-center">
                <div className="grid grid-cols-5 gap-4 text-base font-bold text-gray-700 w-full">
                  <div>Time</div>
                  <div>Date</div>
                  <div>User</div>
                  <div>Activity</div>
                  <div>Department</div>
                </div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-gray-200">
                {currentLogs.map((log) => {
                  const { time, date } = formatDateTime(log.createdAt);
                  return (
                    <div key={log._id} className="px-6 py-4 hover:bg-gray-50 transition-colors h-16 flex items-center">
                      <div className="grid grid-cols-5 gap-4 items-center w-full">
                        {/* Time */}
                        <div className="text-base font-bold text-gray-900">
                          {time}
                        </div>

                        {/* Date */}
                        <div className="text-base font-medium text-gray-900">
                          {date}
                        </div>

                        {/* User */}
                        <div className="text-base font-medium text-gray-900">
                          {log.userName || 'Unknown User'}
                        </div>

                        {/* Activity */}
                        <div className="text-base font-medium text-gray-900">
                          {log.actionDescription}
                        </div>

                        {/* Department */}
                        <div>
                          {log.department && (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-semibold ${getDepartmentColor(log.department)}`}>
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
        {!loading && filteredLogs.length > 0 && (
          <div className="flex items-center justify-between mt-6">
            <div className="text-base text-gray-700 font-medium">
              Showing {startIndex + 1} to {Math.min(startIndex + logsPerPage, filteredLogs.length)} of {filteredLogs.length} logs
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-2 text-base font-semibold text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="px-3 py-2 text-base font-semibold text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-base font-semibold text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
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
