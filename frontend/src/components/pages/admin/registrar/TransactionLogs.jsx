import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MdSearch, MdKeyboardArrowUp, MdKeyboardArrowDown } from 'react-icons/md';
import { IoMdRefresh } from 'react-icons/io';
import { BiSolidNotepad } from 'react-icons/bi';
import { PiNotePencilDuotone } from 'react-icons/pi';
import { ToastContainer, DatePicker } from '../../../ui';
import Pagination from '../../../ui/Pagination';
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

const TransactionLogs = () => {
  // URL-persisted state management
  const { state: urlState, updateState } = useURLState(INITIAL_URL_STATE);

  // Extract URL state values
  const { searchTerm, filterBy, selectedDate, logsPerPage, currentPage } = urlState;

  // Non-persisted state (resets on navigation)
  const [transactionLogs, setTransactionLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRemarksModal, setShowRemarksModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [remarksValue, setRemarksValue] = useState('');
  const [savingRemarks, setSavingRemarks] = useState(false);
  const [fetchError, setFetchError] = useState(null); // Track fetch errors separately
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(new Date());

  // Ref to track if we've shown an error for the current fetch attempt
  const errorShownRef = useRef(false);

  // Notifications (saves to database)
  const { toasts, removeToast, showSuccess, showError } = useNotification();

  // Memoize the date parameter to prevent unnecessary API calls
  const dateParam = useMemo(() => {
    if (!selectedDate) return null;

    // Use Philippine timezone utility to format date for API
    return formatDateForAPI(selectedDate);
  }, [selectedDate]);

  // Fetch transaction logs - only depends on date changes
  const fetchTransactionLogs = useCallback(async () => {
    setLoading(true);
    setFetchError(null); // Clear previous errors
    errorShownRef.current = false; // Reset error shown flag

    try {
      const url = `${API_CONFIG.getAdminUrl()}/api/transactions/registrar${dateParam ? `?date=${dateParam}` : ''}`;

      const response = await authFetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setTransactionLogs(result.data);
        // Update refresh timestamp
        setLastRefreshTime(new Date());
      } else {
        throw new Error(result.error || 'Failed to fetch transaction logs');
      }
    } catch (error) {
      console.error('Error fetching transaction logs:', error);
      setFetchError(error.message); // Set error state instead of calling showError directly
      setTransactionLogs([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  }, [dateParam]); // Removed showError from dependencies to prevent infinite loop

  // Manual refresh function for transaction logs
  const handleManualRefresh = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      await fetchTransactionLogs();
      showSuccess('Refreshed', 'Transaction logs updated successfully');
    } catch (error) {
      console.error('Manual refresh error:', error);
      showError('Refresh Failed', 'Unable to update transaction logs');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Format timestamp for display
  const formatRefreshTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Client-side filtering - separate from API fetching
  const applyFilters = useCallback(() => {
    let filtered = [...transactionLogs];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(log =>
        log.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.purposeOfVisit.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.queueNumber.toString().includes(searchTerm) ||
        log.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.remarks.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply filter by status/priority
    if (filterBy !== 'all') {
      if (filterBy === 'priority') {
        filtered = filtered.filter(log => log.priority !== 'No');
      } else if (filterBy === 'complete') {
        filtered = filtered.filter(log => log.status === 'Complete');
      } else if (filterBy === 'serving') {
        filtered = filtered.filter(log => log.status === 'Now Serving');
      } else if (filterBy === 'waiting') {
        filtered = filtered.filter(log => log.status === 'Waiting');
      } else if (filterBy === 'skipped') {
        filtered = filtered.filter(log => log.status === 'Skipped');
      } else if (filterBy === 'no-show') {
        filtered = filtered.filter(log => log.status === 'No-show/Cancelled');
      }
    }

    setFilteredLogs(filtered);
  }, [transactionLogs, searchTerm, filterBy]);

  // Effect for fetching data - only when date changes or on mount
  useEffect(() => {
    fetchTransactionLogs();
  }, [fetchTransactionLogs]);

  // Effect for client-side filtering - when data or filter criteria change
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // Effect for resetting page when filters change (separate to avoid loops)
  useEffect(() => {
    if (currentPage > 1) {
      updateState('currentPage', 1);
    }
  }, [searchTerm, filterBy, updateState]); // Removed currentPage from dependencies to prevent infinite loop

  // Effect for handling fetch errors (separate to avoid infinite loops)
  useEffect(() => {
    if (fetchError && !errorShownRef.current) {
      showError('Error', 'Failed to load transaction logs');
      errorShownRef.current = true; // Mark error as shown
      // Clear the error after showing it to prevent repeated notifications
      setFetchError(null);
    }
  }, [fetchError, showError]);

  const handleLogsPerPageChange = (increment) => {
    const newValue = Math.max(5, Math.min(50, logsPerPage + increment));
    updateState('logsPerPage', newValue);
    updateState('currentPage', 1);
  };

  const handleEditRemarks = (log) => {
    setSelectedLog(log);
    setRemarksValue(log.remarks || '');
    setShowRemarksModal(true);
  };

  const handleSaveRemarks = async () => {
    if (!selectedLog) return;

    setSavingRemarks(true);
    try {
      const response = await fetch(`${API_CONFIG.getAdminUrl()}/api/transactions/${selectedLog.id}/remarks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remarks: remarksValue })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        // Update local state
        setTransactionLogs(prev => prev.map(log =>
          log.id === selectedLog.id ? { ...log, remarks: remarksValue } : log
        ));

        setShowRemarksModal(false);
        setSelectedLog(null);
        setRemarksValue('');
        showSuccess('Success', 'Remarks updated successfully');
      } else {
        throw new Error(result.error || 'Failed to update remarks');
      }
    } catch (error) {
      console.error('Error updating remarks:', error);
      showError('Error', 'Failed to update remarks');
    } finally {
      setSavingRemarks(false);
    }
  };

  const handleCancelEdit = () => {
    setShowRemarksModal(false);
    setSelectedLog(null);
    setRemarksValue('');
  };

  const handleAddTransaction = () => {
    // Placeholder for future implementation
    showSuccess('Info', 'Add Transaction feature will be implemented in future updates');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Complete': return 'text-green-600 bg-green-50';
      case 'Now Serving': return 'text-blue-600 bg-blue-50';
      case 'Waiting': return 'text-yellow-600 bg-yellow-50';
      case 'Skipped': return 'text-orange-600 bg-orange-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / logsPerPage);
  const startIndex = (currentPage - 1) * logsPerPage;
  const endIndex = startIndex + logsPerPage;
  const currentLogs = filteredLogs.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    updateState('currentPage', page);
  };



  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-5">
      {/* Main Content Container - White background similar to Settings.jsx */}
      <div className="bg-white p-3 sm:p-4 md:p-5 border border-gray-200 rounded-xl sm:rounded-2xl">

        {/* Row 1 - Header */}
        <div className="mb-3 sm:mb-4 md:mb-5">
          <div className="flex justify-between items-center">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">Transaction Logs</h1>
            <div className="flex items-center space-x-0.5 sm:space-x-1">
              <p className="text-[7px] sm:text-[8px] text-gray-500 uppercase tracking-wide">
                As of {formatRefreshTime(lastRefreshTime)}
              </p>
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="p-1 sm:p-1.5 transition-colors duration-200 hover:bg-[#1F3463]/10 rounded-lg border border-[#1F3463]/20"
                title="Refresh transaction logs"
              >
                <IoMdRefresh
                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#1F3463] ${isRefreshing ? 'animate-spin' : ''}`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Row 2 - Controls */}
        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3 mb-3 sm:mb-4 md:mb-5">
          {/* Left side - Pagination Control */}
          <div className="flex items-center space-x-1 sm:space-x-1.5 order-2 lg:order-1">
            <span className="text-xs sm:text-sm text-gray-700 font-medium">Showing</span>
            <div className="flex items-center space-x-0.5 sm:space-x-1">
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

          {/* Right side - Date Filter, Search, Filter dropdown, Add button */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-2.5 lg:gap-3 w-full lg:w-auto order-1 lg:order-2">
            {/* Date Filter */}
            <div className="flex items-center space-x-1 sm:space-x-1.5">
              <label className="text-xs sm:text-sm text-gray-700 font-medium whitespace-nowrap">Date:</label>
              <DatePicker
                value={selectedDate}
                onChange={(date) => updateState('selectedDate', date)}
                placeholder="All Dates"
              />
            </div>

            {/* Search */}
            <div className="relative flex-1 md:flex-initial">
              <MdSearch className="absolute left-2 sm:left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 text-base sm:text-lg" />
              <input
                type="text"
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => updateState('searchTerm', e.target.value)}
                className="w-full md:w-44 lg:w-52 pl-7 sm:pl-8 pr-2 sm:pr-3 py-1.5 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent"
              />
            </div>

            {/* Filter */}
            <div className="flex items-center space-x-1 sm:space-x-1.5">
              <label className="text-xs sm:text-sm text-gray-700 font-medium whitespace-nowrap">Filter by:</label>
              <select
                value={filterBy}
                onChange={(e) => updateState('filterBy', e.target.value)}
                className="flex-1 md:flex-initial px-2 sm:px-2.5 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent text-xs sm:text-sm"
              >
                <option value="all">All</option>
                <option value="complete">Complete</option>
                <option value="serving">Now Serving</option>
                <option value="waiting">Waiting</option>
                <option value="skipped">Skipped</option>
                <option value="no-show">No-show/Cancelled</option>
                <option value="priority">Priority</option>
              </select>
            </div>

            {/* Add Button */}
            <button
              onClick={handleAddTransaction}
              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-[#1F3463] text-white rounded-lg hover:bg-[#1F3463]/90 transition-colors text-xs sm:text-sm font-semibold whitespace-nowrap"
            >
              + Add Transaction
            </button>
          </div>
        </div>

        {/* Transaction Logs Table */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {loading ? (
            <>
              {/* Table Header */}
              <div className="bg-gray-50 px-5 py-3 border-b border-gray-200 h-12 flex items-center">
                <div className="grid grid-cols-8 gap-3 text-xs font-medium text-gray-700 w-full">
                  <div>Queue No.</div>
                  <div>Name</div>
                  <div>Purpose of Visit</div>
                  <div>Priority</div>
                  <div>Role</div>
                  <div>Turnaround Time</div>
                  <div>Remarks</div>
                  <div>Status</div>
                </div>
              </div>

              {/* Skeleton Loading Rows */}
              <div className="divide-y divide-gray-200">
                {[...Array(7)].map((_, index) => (
                  <div key={index} className="px-5 py-3 h-12 flex items-center animate-pulse">
                    <div className="grid grid-cols-8 gap-3 items-center w-full">
                      {/* Queue No. Skeleton */}
                      <div className="h-3 bg-gray-200 rounded w-6"></div>

                      {/* Name Skeleton */}
                      <div className="h-3 bg-gray-200 rounded w-20"></div>

                      {/* Purpose of Visit Skeleton */}
                      <div className="h-3 bg-gray-200 rounded w-24"></div>

                      {/* Priority Skeleton */}
                      <div className="h-5 bg-gray-200 rounded-full w-10"></div>

                      {/* Role Skeleton */}
                      <div className="h-3 bg-gray-200 rounded w-12"></div>

                      {/* Turnaround Time Skeleton */}
                      <div className="h-3 bg-gray-200 rounded w-16"></div>

                      {/* Remarks Skeleton */}
                      <div className="flex items-center space-x-1.5">
                        <div className="h-3 bg-gray-200 rounded flex-1"></div>
                        <div className="h-4 w-4 bg-gray-200 rounded"></div>
                      </div>

                      {/* Status Skeleton */}
                      <div className="h-5 bg-gray-200 rounded-full w-12"></div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : currentLogs.length === 0 ? (
            <div className="text-center py-8 sm:py-10">
              <BiSolidNotepad className="text-4xl sm:text-5xl text-gray-300 mx-auto mb-2 sm:mb-3" />
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1 sm:mb-1.5">No transaction logs found</h3>
              <p className="text-xs sm:text-sm text-gray-500">Try adjusting your search or filter criteria</p>
            </div>
          ) : (
            <>
              {/* Table Header - Desktop only */}
              <div className="hidden md:flex bg-gray-50 px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 md:py-3 border-b border-gray-200 items-center">
                <div className="grid grid-cols-8 gap-2 sm:gap-3 text-xs sm:text-sm font-bold text-gray-700 w-full">
                  <div>Queue No.</div>
                  <div>Name</div>
                  <div>Purpose of Visit</div>
                  <div>Priority</div>
                  <div>Role</div>
                  <div>Turnaround Time</div>
                  <div>Remarks</div>
                  <div>Status</div>
                </div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-gray-200">
                {currentLogs.map((log) => (
                  <div key={log.id} className="px-3 sm:px-4 md:px-5 py-2.5 sm:py-3 hover:bg-gray-50 transition-colors md:h-12 flex items-center">
                    {/* Desktop view */}
                    <div className="hidden md:grid md:grid-cols-8 gap-2 sm:gap-3 items-center w-full">
                      {/* Queue No. */}
                      <div className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                        #{log.queueNumber.toString().padStart(2, '0')}
                      </div>

                      {/* Name */}
                      <div className="text-xs sm:text-sm font-medium text-gray-900 truncate" title={log.customerName}>
                        {log.customerName}
                      </div>

                      {/* Purpose of Visit */}
                      <div className="text-xs sm:text-sm font-medium text-gray-900 truncate" title={log.purposeOfVisit}>
                        {log.purposeOfVisit}
                      </div>

                      {/* Priority */}
                      <div className="text-xs truncate">
                        <span className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold ${
                          log.priority === 'Yes' ? 'text-red-600 bg-red-50' : 'text-gray-600 bg-gray-50'
                        }`}>
                          {log.priority}
                        </span>
                      </div>

                      {/* Role */}
                      <div className="text-xs sm:text-sm font-medium text-gray-900 truncate" title={log.role}>
                        {log.role}
                      </div>

                      {/* Turnaround Time */}
                      <div className="text-xs sm:text-sm text-gray-900 font-mono font-semibold truncate">
                        {log.turnaroundTime}
                      </div>

                      {/* Remarks */}
                      <div className="text-xs">
                        <div className="flex items-center space-x-1 sm:space-x-1.5">
                          <span className="text-gray-900 flex-1 truncate text-xs sm:text-sm">
                            {log.remarks || 'No remarks'}
                          </span>
                          <button
                            onClick={() => handleEditRemarks(log)}
                            className="text-gray-400 hover:text-[#1F3463] transition-colors"
                            title="Edit remarks"
                          >
                            <PiNotePencilDuotone className="text-base sm:text-lg" />
                          </button>
                        </div>
                      </div>

                      {/* Status */}
                      <div className="text-xs">
                        <span className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold ${getStatusColor(log.status)}`}>
                          {log.status}
                        </span>
                      </div>
                    </div>

                    {/* Mobile card view */}
                    <div className="md:hidden w-full space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] text-gray-500 uppercase tracking-wide block mb-0.5">Queue No.</span>
                          <div className="text-sm font-bold text-gray-900">
                            #{log.queueNumber.toString().padStart(2, '0')}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            log.priority === 'Yes' ? 'text-red-600 bg-red-50' : 'text-gray-600 bg-gray-50'
                          }`}>
                            {log.priority}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${getStatusColor(log.status)}`}>
                            {log.status}
                          </span>
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase tracking-wide block mb-0.5">Name</span>
                        <div className="text-sm font-medium text-gray-900">{log.customerName}</div>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase tracking-wide block mb-0.5">Purpose</span>
                        <div className="text-sm font-medium text-gray-900">{log.purposeOfVisit}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] text-gray-500 uppercase tracking-wide block mb-0.5">Role</span>
                          <div className="text-sm font-medium text-gray-900">{log.role}</div>
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-500 uppercase tracking-wide block mb-0.5">Time</span>
                          <div className="text-sm text-gray-900 font-mono font-semibold">{log.turnaroundTime}</div>
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase tracking-wide block mb-0.5">Remarks</span>
                        <div className="flex items-center space-x-1.5">
                          <span className="text-sm text-gray-900 flex-1">
                            {log.remarks || 'No remarks'}
                          </span>
                          <button
                            onClick={() => handleEditRemarks(log)}
                            className="text-gray-400 hover:text-[#1F3463] transition-colors"
                            title="Edit remarks"
                          >
                            <PiNotePencilDuotone className="text-lg" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-3 sm:mt-4 md:mt-5 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-0">
            <div className="text-[10px] sm:text-xs text-gray-700 font-medium order-2 sm:order-1">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredLogs.length)} of {filteredLogs.length} logs
            </div>
            <div className="order-1 sm:order-2">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                size="sm"
              />
            </div>
          </div>
        )}

      </div>

      {/* Remarks Modal */}
      {showRemarksModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={handleCancelEdit}
          />

          {/* Modal */}
          <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
            <div
              className="relative bg-white rounded-lg sm:rounded-xl shadow-xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-3 sm:p-4 md:p-5 border-b border-gray-200">
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">
                  Edit Remarks - Queue #{selectedLog?.queueNumber?.toString().padStart(2, '0')}
                </h3>
                <button
                  onClick={handleCancelEdit}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="p-3 sm:p-4 md:p-5">
                <div className="mb-2 sm:mb-3">
                  <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1 sm:mb-1.5">
                    Customer: {selectedLog?.customerName}
                  </label>
                  <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1 sm:mb-1.5">
                    Service: {selectedLog?.purposeOfVisit}
                  </label>
                </div>

                <div className="mb-3 sm:mb-4 md:mb-5">
                  <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1 sm:mb-1.5">
                    Remarks
                  </label>
                  <textarea
                    value={remarksValue}
                    onChange={(e) => setRemarksValue(e.target.value)}
                    className="w-full px-2 sm:px-2.5 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent"
                    rows={4}
                    maxLength={500}
                    placeholder="Add remarks about this transaction..."
                  />
                  <div className="text-[9px] sm:text-[10px] text-gray-500 mt-0.5 sm:mt-1">
                    {remarksValue.length}/500 characters
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 sm:space-x-2.5 justify-end">
                  <button
                    onClick={handleCancelEdit}
                    className="w-full sm:w-auto px-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors order-2 sm:order-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveRemarks}
                    disabled={savingRemarks}
                    className="w-full sm:w-auto px-3 py-1.5 text-xs sm:text-sm bg-[#1F3463] text-white rounded-lg hover:bg-[#1F3463]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed order-1 sm:order-2"
                  >
                    {savingRemarks ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
    </div>
  );
};

export default TransactionLogs;

