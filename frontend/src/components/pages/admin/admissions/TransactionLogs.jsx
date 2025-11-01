import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MdSearch, MdKeyboardArrowUp, MdKeyboardArrowDown } from 'react-icons/md';
import { IoMdRefresh } from 'react-icons/io';
import { BiSolidNotepad } from 'react-icons/bi';
import { PiNotePencilDuotone } from 'react-icons/pi';
import { useToast, ToastContainer, DatePicker } from '../../../ui';
import useURLState from '../../../../hooks/useURLState';
import { formatDateForAPI } from '../../../../utils/philippineTimezone';

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

  // Toast notifications
  const { toasts, removeToast, showSuccess, showError } = useToast();


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
      const url = `http://localhost:5000/api/transactions/admissions${dateParam ? `?date=${dateParam}` : ''}`;

      const response = await fetch(url);

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
      const response = await fetch(`http://localhost:5000/api/transactions/${selectedLog.id}/remarks`, {
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
    <div className="space-y-6">
      {/* Main Content Container - White background similar to Settings.jsx */}
      <div className="bg-white p-6 border border-gray-200 rounded-xl">

        {/* Row 1 - Header */}
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <h1 className="text-4xl font-semibold text-gray-900">Transaction Logs</h1>
            <div className="flex items-center space-x-1">
              <p className="text-xs text-gray-500">
                As of {formatRefreshTime(lastRefreshTime)}
              </p>
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="p-2 transition-colors duration-200 hover:bg-[#1F3463]/10 rounded-lg border border-[#1F3463]/20"
                title="Refresh transaction logs"
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
            <span className="text-sm text-gray-700">Showing</span>
            <div className="flex items-center space-x-1">
              <input
                type="number"
                value={logsPerPage}
                onChange={(e) => updateState('logsPerPage', Math.max(5, Math.min(50, parseInt(e.target.value) || 10)))}
                className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent"
                min="5"
                max="50"
              />
              <div className="flex flex-col">
                <button
                  onClick={() => handleLogsPerPageChange(1)}
                  className="p-1 text-gray-500 hover:text-[#1F3463] transition-colors"
                >
                  <MdKeyboardArrowUp className="text-sm" />
                </button>
                <button
                  onClick={() => handleLogsPerPageChange(-1)}
                  className="p-1 text-gray-500 hover:text-[#1F3463] transition-colors"
                >
                  <MdKeyboardArrowDown className="text-sm" />
                </button>
              </div>
            </div>
            <span className="text-sm text-gray-700">Logs</span>
          </div>

          {/* Right side - Date Filter, Search, Filter dropdown, Add button */}
          <div className="flex items-center space-x-4">
            {/* Date Filter */}
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-700">Date:</label>
              <DatePicker
                value={selectedDate}
                onChange={(date) => updateState('selectedDate', date)}
                placeholder="All Dates"
              />
            </div>

            {/* Search */}
            <div className="relative">
              <MdSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-lg" />
              <input
                type="text"
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => updateState('searchTerm', e.target.value)}
                className="w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent"
              />
            </div>

            {/* Filter */}
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-700">Filter by:</label>
              <select
                value={filterBy}
                onChange={(e) => updateState('filterBy', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent text-sm"
              >
                <option value="all">All</option>
                <option value="complete">Complete</option>
                <option value="serving">Now Serving</option>
                <option value="waiting">Waiting</option>
                <option value="skipped">Skipped</option>
                <option value="priority">Priority</option>
              </select>
            </div>

            {/* Add Button */}
            <button
              onClick={handleAddTransaction}
              className="px-4 py-2 bg-[#1F3463] text-white rounded-lg hover:bg-[#1F3463]/90 transition-colors text-sm font-medium"
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
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 h-16 flex items-center">
                <div className="grid grid-cols-8 gap-4 text-sm font-medium text-gray-700 w-full">
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
                  <div key={index} className="px-6 py-4 h-16 flex items-center animate-pulse">
                    <div className="grid grid-cols-8 gap-4 items-center w-full">
                      {/* Queue No. Skeleton */}
                      <div className="h-4 bg-gray-200 rounded w-8"></div>

                      {/* Name Skeleton */}
                      <div className="h-4 bg-gray-200 rounded w-24"></div>

                      {/* Purpose of Visit Skeleton */}
                      <div className="h-4 bg-gray-200 rounded w-32"></div>

                      {/* Priority Skeleton */}
                      <div className="h-6 bg-gray-200 rounded-full w-12"></div>

                      {/* Role Skeleton */}
                      <div className="h-4 bg-gray-200 rounded w-16"></div>

                      {/* Turnaround Time Skeleton */}
                      <div className="h-4 bg-gray-200 rounded w-20"></div>

                      {/* Remarks Skeleton */}
                      <div className="flex items-center space-x-2">
                        <div className="h-4 bg-gray-200 rounded flex-1"></div>
                        <div className="h-5 w-5 bg-gray-200 rounded"></div>
                      </div>

                      {/* Status Skeleton */}
                      <div className="h-6 bg-gray-200 rounded-full w-16"></div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : currentLogs.length === 0 ? (
            <div className="text-center py-12">
              <BiSolidNotepad className="text-6xl text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No transaction logs found</h3>
              <p className="text-gray-500">Try adjusting your search or filter criteria</p>
            </div>
          ) : (
            <>
              {/* Table Header */}
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 h-16 flex items-center">
                <div className="grid grid-cols-8 gap-4 text-sm font-medium text-gray-700 w-full">
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
                  <div key={log.id} className="px-6 py-4 hover:bg-gray-50 transition-colors h-16 flex items-center">
                    <div className="grid grid-cols-8 gap-4 items-center w-full">
                      {/* Queue No. */}
                      <div className="text-sm font-medium text-gray-900">
                        #{log.queueNumber.toString().padStart(2, '0')}
                      </div>

                      {/* Name */}
                      <div className="text-sm text-gray-900">
                        {log.customerName}
                      </div>

                      {/* Purpose of Visit */}
                      <div className="text-sm text-gray-900">
                        {log.purposeOfVisit}
                      </div>

                      {/* Priority */}
                      <div className="text-sm">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          log.priority === 'Yes' ? 'text-red-600 bg-red-50' : 'text-gray-600 bg-gray-50'
                        }`}>
                          {log.priority}
                        </span>
                      </div>

                      {/* Role */}
                      <div className="text-sm text-gray-900">
                        {log.role}
                      </div>

                      {/* Turnaround Time */}
                      <div className="text-sm text-gray-900 font-mono">
                        {log.turnaroundTime}
                      </div>

                      {/* Remarks */}
                      <div className="text-sm">
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-900 flex-1 truncate">
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

                      {/* Status */}
                      <div className="text-sm">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(log.status)}`}>
                          {log.status}
                        </span>
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
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredLogs.length)} of {filteredLogs.length} logs
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              {/* Current Page Number */}
              <button
                className="px-3 py-2 text-sm font-medium text-white bg-[#1F3463] border border-[#1F3463] rounded-md"
              >
                {currentPage}
              </button>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
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
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="relative bg-white rounded-lg shadow-xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  Edit Remarks - Queue #{selectedLog?.queueNumber?.toString().padStart(2, '0')}
                </h3>
                <button
                  onClick={handleCancelEdit}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer: {selectedLog?.customerName}
                  </label>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Service: {selectedLog?.purposeOfVisit}
                  </label>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Remarks
                  </label>
                  <textarea
                    value={remarksValue}
                    onChange={(e) => setRemarksValue(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent"
                    rows={4}
                    maxLength={500}
                    placeholder="Add remarks about this transaction..."
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    {remarksValue.length}/500 characters
                  </div>
                </div>

                <div className="flex space-x-3 justify-end">
                  <button
                    onClick={handleCancelEdit}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveRemarks}
                    disabled={savingRemarks}
                    className="px-4 py-2 bg-[#1F3463] text-white rounded-lg hover:bg-[#1F3463]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

