import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MdSearch, MdKeyboardArrowUp, MdKeyboardArrowDown, MdClose } from 'react-icons/md';
import { IoMdRefresh } from 'react-icons/io';
import { BiSolidNotepad } from 'react-icons/bi';
import { FaCheck, FaTimes } from 'react-icons/fa';
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

const DocumentRequest = () => {
  // URL-persisted state management
  const { state: urlState, updateState } = useURLState(INITIAL_URL_STATE);

  // Extract URL state values
  const { searchTerm, filterBy, selectedDate, logsPerPage, currentPage } = urlState;

  // Non-persisted state (resets on navigation)
  const [documentRequests, setDocumentRequests] = useState([]);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalCount: 0, limit: 10 });
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(new Date());

  // Approve/Reject Modal State
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [businessDays, setBusinessDays] = useState(5);
  const [rejectReasons, setRejectReasons] = useState([]);
  const [processing, setProcessing] = useState(false);

  // Predefined rejection reasons
  const rejectionReasons = [
    'Incomplete or missing required information',
    'Invalid or expired documents submitted',
    'Request does not meet eligibility requirements',
    'Duplicate request already processed',
    'Incorrect transaction number or reference',
    'Request submitted outside of processing hours',
    'Required supporting documents not provided',
    'Other (please specify in remarks)'
  ];

  // Ref to track if we've shown an error for the current fetch attempt
  const errorShownRef = useRef(false);

  // Notifications (saves to database)
  const { toasts, removeToast, showSuccess, showError } = useNotification();

  // Memoize the date parameter to prevent unnecessary API calls
  const dateParam = useMemo(() => {
    if (!selectedDate) return null;
    return formatDateForAPI(selectedDate);
  }, [selectedDate]);

  // Fetch document requests - depends on pagination and filter changes
  const fetchDocumentRequests = useCallback(async () => {
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
        params.append('date', dateParam);
      }
      if (searchTerm && searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }
      if (filterBy && filterBy !== 'all') {
        params.append('filterBy', filterBy);
      }

      const url = `${API_CONFIG.getAdminUrl()}/api/document-requests/registrar?${params.toString()}`;

      const response = await authFetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setDocumentRequests(result.data);
        setPagination(result.pagination || { currentPage: 1, totalPages: 1, totalCount: 0, limit: logsPerPage });
        setLastRefreshTime(new Date());
      } else {
        throw new Error(result.error || 'Failed to fetch document requests');
      }
    } catch (error) {
      console.error('Error fetching document requests:', error);
      setFetchError(error.message);
      setDocumentRequests([]);
      setPagination({ currentPage: 1, totalPages: 1, totalCount: 0, limit: logsPerPage });
    } finally {
      setLoading(false);
    }
  }, [currentPage, logsPerPage, dateParam, searchTerm, filterBy]);

  // Manual refresh function
  const handleManualRefresh = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      await fetchDocumentRequests();
      showSuccess('Refreshed', 'Document requests updated successfully');
    } catch (error) {
      console.error('Manual refresh error:', error);
      showError('Refresh Failed', 'Unable to update document requests');
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

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Effect for fetching data - triggers on filter/pagination changes
  useEffect(() => {
    fetchDocumentRequests();
  }, [fetchDocumentRequests]);

  // Effect for resetting page when filters change
  useEffect(() => {
    if (currentPage > 1) {
      updateState('currentPage', 1);
    }
  }, [searchTerm, filterBy, updateState]);

  // Effect for handling fetch errors
  useEffect(() => {
    if (fetchError && !errorShownRef.current) {
      showError('Error', 'Failed to load document requests');
      errorShownRef.current = true;
      setFetchError(null);
    }
  }, [fetchError, showError]);

  const handleLogsPerPageChange = (increment) => {
    const newValue = Math.max(5, Math.min(50, logsPerPage + increment));
    updateState('logsPerPage', newValue);
    updateState('currentPage', 1);
  };

  // Handle Approve
  const handleApprove = (request) => {
    setSelectedRequest(request);
    setBusinessDays(5); // Default to 5 days
    setShowApproveModal(true);
  };

  const handleApproveConfirm = async () => {
    if (!selectedRequest) return;

    setProcessing(true);
    try {
      const response = await authFetch(
        `${API_CONFIG.getAdminUrl()}/api/document-requests/registrar/${selectedRequest.id}/approve`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            businessDays: businessDays
          })
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        showSuccess('Success', 'Document request approved successfully. Email notification sent.');
        setShowApproveModal(false);
        setSelectedRequest(null);
        fetchDocumentRequests();
      } else {
        throw new Error(result.error || 'Failed to approve document request');
      }
    } catch (error) {
      console.error('Error approving document request:', error);
      showError('Error', error.message || 'Failed to approve document request');
    } finally {
      setProcessing(false);
    }
  };

  // Handle Reject
  const handleReject = (request) => {
    setSelectedRequest(request);
    setRejectReasons([]);
    setShowRejectModal(true);
  };

  const handleRejectReasonChange = (reason) => {
    setRejectReasons(prev => {
      if (prev.includes(reason)) {
        return prev.filter(r => r !== reason);
      } else {
        return [...prev, reason];
      }
    });
  };

  const handleRejectConfirm = async () => {
    if (!selectedRequest) return;

    if (rejectReasons.length === 0) {
      showError('Validation Error', 'Please select at least one rejection reason');
      return;
    }

    setProcessing(true);
    try {
      const response = await authFetch(
        `${API_CONFIG.getAdminUrl()}/api/document-requests/registrar/${selectedRequest.id}/reject`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            rejectionReasons: rejectReasons
          })
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        showSuccess('Success', 'Document request rejected successfully. Email notification sent.');
        setShowRejectModal(false);
        setSelectedRequest(null);
        setRejectReasons([]);
        fetchDocumentRequests();
      } else {
        throw new Error(result.error || 'Failed to reject document request');
      }
    } catch (error) {
      console.error('Error rejecting document request:', error);
      showError('Error', error.message || 'Failed to reject document request');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'text-green-600 bg-green-50';
      case 'rejected': return 'text-red-600 bg-red-50';
      case 'pending': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  // Pagination
  const totalPages = pagination.totalPages || 1;
  const totalCount = pagination.totalCount || 0;
  const currentRequests = documentRequests;

  const handlePageChange = (page) => {
    updateState('currentPage', page);
  };

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-5">
      {/* Main Content Container */}
      <div className="bg-white p-3 sm:p-4 md:p-5 border border-gray-200 rounded-xl sm:rounded-2xl">
        {/* Row 1 - Header */}
        <div className="mb-3 sm:mb-4 md:mb-5">
          <div className="flex justify-between items-center">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">Document Requests</h1>
            <div className="flex items-center space-x-0.5 sm:space-x-1">
              <p className="text-[7px] sm:text-[8px] text-gray-500 uppercase tracking-wide">
                As of {formatRefreshTime(lastRefreshTime)}
              </p>
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="p-1 sm:p-1.5 transition-all duration-200 hover:bg-[#1F3463]/10 rounded-lg border border-[#1F3463]/20 hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:ring-offset-1"
                title="Refresh document requests"
              >
                <IoMdRefresh
                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#1F3463] transition-transform duration-200 ${isRefreshing ? 'animate-spin' : ''}`}
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
            <span className="text-xs sm:text-sm text-gray-700 font-medium">Requests</span>
          </div>

          {/* Right side - Date Filter, Search, Filter dropdown */}
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
                placeholder="Search requests..."
                value={searchTerm}
                onChange={(e) => updateState('searchTerm', e.target.value)}
                className="w-full md:w-44 lg:w-52 pl-7 sm:pl-8 pr-2 sm:pr-3 py-1.5 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-[#1F3463] focus:border-transparent transition-all duration-200"
              />
            </div>

            {/* Filter */}
            <div className="flex items-center space-x-1 sm:space-x-1.5">
              <label className="text-xs sm:text-sm text-gray-700 font-medium whitespace-nowrap">Filter by:</label>
              <select
                value={filterBy}
                onChange={(e) => updateState('filterBy', e.target.value)}
                className="flex-1 md:flex-initial px-2 sm:px-2.5 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-[#1F3463] focus:border-transparent transition-all duration-200 text-xs sm:text-sm"
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        </div>

        {/* Document Requests Table */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {loading ? (
            <>
              {/* Table Header */}
              <div className="bg-[#1F3463] px-3 sm:px-4 md:px-5 py-2.5 sm:py-3 md:py-3 border-b border-[#1F3463] min-h-[2.5rem] sm:min-h-[2.75rem] md:min-h-[3rem] flex items-center">
                <div className="grid grid-cols-9 gap-2 sm:gap-2.5 md:gap-3 text-xs font-medium text-white w-full">
                  <div className="whitespace-normal break-words leading-tight">Transaction No.</div>
                  <div className="whitespace-normal break-words leading-tight">Name</div>
                  <div className="whitespace-normal break-words leading-tight">Last S.Y. Attended</div>
                  <div className="whitespace-normal break-words leading-tight">Program/Grade/Strand</div>
                  <div className="whitespace-normal break-words leading-tight">Contact No.</div>
                  <div className="whitespace-normal break-words leading-tight">Email Address</div>
                  <div className="whitespace-normal break-words leading-tight">Request</div>
                  <div className="whitespace-normal break-words leading-tight">Date of Request</div>
                  <div className="whitespace-normal break-words leading-tight">Action</div>
                </div>
              </div>

              {/* Skeleton Loading Rows */}
              <div className="divide-y divide-gray-200">
                {[...Array(7)].map((_, index) => (
                  <div key={index} className="px-3 sm:px-4 md:px-5 py-2.5 sm:py-3 md:py-3 md:h-12 flex items-center animate-pulse">
                    <div className="grid grid-cols-9 gap-2 sm:gap-2.5 md:gap-3 items-center w-full">
                      {[...Array(9)].map((_, i) => (
                        <div key={i} className="h-2.5 sm:h-3 bg-gray-200 rounded w-full"></div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : currentRequests.length === 0 ? (
            <div className="text-center py-8 sm:py-10">
              <BiSolidNotepad className="text-4xl sm:text-5xl text-gray-300 mx-auto mb-2 sm:mb-3" />
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1 sm:mb-1.5">No document requests found</h3>
              <p className="text-xs sm:text-sm text-gray-500">Try adjusting your search or filter criteria</p>
            </div>
          ) : (
            <>
              {/* Table Header */}
              <div className="hidden md:flex bg-[#1F3463] px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 md:py-3 border-b border-[#1F3463] items-center shadow-sm min-h-[2.5rem] sm:min-h-[2.75rem] md:min-h-[3rem]">
                <div className="grid grid-cols-9 gap-2 sm:gap-3 text-xs sm:text-sm font-bold text-white w-full">
                  <div className="whitespace-normal break-words leading-tight">Transaction No.</div>
                  <div className="whitespace-normal break-words leading-tight">Name</div>
                  <div className="whitespace-normal break-words leading-tight">Last S.Y. Attended</div>
                  <div className="whitespace-normal break-words leading-tight">Program/Grade/Strand</div>
                  <div className="whitespace-normal break-words leading-tight">Contact No.</div>
                  <div className="whitespace-normal break-words leading-tight">Email Address</div>
                  <div className="whitespace-normal break-words leading-tight">Request</div>
                  <div className="whitespace-normal break-words leading-tight">Date of Request</div>
                  <div className="whitespace-normal break-words leading-tight">Action</div>
                </div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-gray-200">
                {currentRequests.map((request, index) => (
                  <div key={request.id} className={`px-3 sm:px-4 md:px-5 py-2.5 sm:py-3 hover:bg-gray-50 transition-colors duration-200 md:h-12 flex items-center ${index % 2 === 0 ? 'bg-white' : 'bg-slate-100'}`}>
                    {/* Desktop view */}
                    <div className="hidden md:grid md:grid-cols-9 gap-2 sm:gap-3 items-center w-full">
                      {/* Transaction No. */}
                      <div className="text-xs sm:text-sm font-bold text-gray-900 truncate" title={request.transactionNo}>
                        {request.transactionNo}
                      </div>

                      {/* Name */}
                      <div className="text-xs sm:text-sm font-medium text-gray-900 truncate" title={request.name}>
                        {request.name}
                      </div>

                      {/* Last S.Y. Attended */}
                      <div className="text-xs sm:text-sm font-medium text-gray-900 truncate" title={request.lastSYAttended}>
                        {request.lastSYAttended}
                      </div>

                      {/* Program/Grade/Strand */}
                      <div className="text-xs sm:text-sm font-medium text-gray-900 truncate" title={request.programGradeStrand}>
                        {request.programGradeStrand}
                      </div>

                      {/* Contact No. */}
                      <div className="text-xs sm:text-sm font-medium text-gray-900 truncate" title={request.contactNumber}>
                        {request.contactNumber}
                      </div>

                      {/* Email Address */}
                      <div className="text-xs sm:text-sm font-medium text-gray-900 truncate" title={request.emailAddress}>
                        {request.emailAddress}
                      </div>

                      {/* Request */}
                      <div className="text-xs sm:text-sm font-medium text-gray-900 truncate" title={request.request.join(', ')}>
                        {request.request.join(', ')}
                      </div>

                      {/* Date of Request */}
                      <div className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                        {formatDate(request.dateOfRequest)}
                      </div>

                      {/* Action */}
                      <div className="flex items-center space-x-1 sm:space-x-1.5">
                        {request.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(request)}
                              className="p-1.5 sm:p-2 text-green-600 hover:text-white hover:bg-green-600 rounded-lg transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1"
                              title="Approve"
                            >
                              <FaCheck className="text-sm sm:text-base" />
                            </button>
                            <button
                              onClick={() => handleReject(request)}
                              className="p-1.5 sm:p-2 text-red-600 hover:text-white hover:bg-red-600 rounded-lg transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                              title="Reject"
                            >
                              <FaTimes className="text-sm sm:text-base" />
                            </button>
                          </>
                        )}
                        {request.status !== 'pending' && (
                          <span className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold shadow-sm transition-all duration-200 ${getStatusColor(request.status)}`}>
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Mobile card view */}
                    <div className="md:hidden w-full space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] text-gray-500 uppercase tracking-wide block mb-0.5">Transaction No.</span>
                          <div className="text-sm font-bold text-gray-900">{request.transactionNo}</div>
                        </div>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${getStatusColor(request.status)}`}>
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase tracking-wide block mb-0.5">Name</span>
                        <div className="text-sm font-medium text-gray-900">{request.name}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] text-gray-500 uppercase tracking-wide block mb-0.5">Last S.Y.</span>
                          <div className="text-xs text-gray-900">{request.lastSYAttended}</div>
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-500 uppercase tracking-wide block mb-0.5">Date</span>
                          <div className="text-xs text-gray-900">{formatDate(request.dateOfRequest)}</div>
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase tracking-wide block mb-0.5">Request</span>
                        <div className="text-xs text-gray-900">{request.request.join(', ')}</div>
                      </div>
                      {request.status === 'pending' && (
                        <div className="flex space-x-2 pt-2">
                          <button
                            onClick={() => handleApprove(request)}
                            className="flex-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs font-semibold"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(request)}
                            className="flex-1 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-xs font-semibold"
                          >
                            Reject
                          </button>
                        </div>
                      )}
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
            <div className="text-[10px] sm:text-xs md:text-sm text-gray-700 font-medium order-2 sm:order-1">
              Showing {((currentPage - 1) * logsPerPage) + 1} to {Math.min(currentPage * logsPerPage, totalCount)} of {totalCount} requests
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

      {/* Approve Modal */}
      {showApproveModal && selectedRequest && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity" onClick={() => setShowApproveModal(false)} />
          <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md transform transition-all duration-300 scale-100 overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setShowApproveModal(false)}
                className="absolute top-3 right-3 z-10 w-6 h-6 bg-[#1F3463] border-2 border-white rounded-full flex items-center justify-center text-white hover:bg-opacity-90 transition-colors"
              >
                <MdClose className="w-3 h-3" />
              </button>
              <div className="p-3 sm:p-4 md:p-5 border-b border-gray-200">
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">Approve Document Request</h3>
              </div>
              <div className="p-3 sm:p-4 md:p-5">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1 sm:mb-1.5">
                      Business Days (3-5) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="3"
                      max="5"
                      value={businessDays}
                      onChange={(e) => setBusinessDays(Math.max(3, Math.min(5, parseInt(e.target.value) || 5)))}
                      className="w-full px-2 sm:px-2.5 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent"
                    />
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600">
                    <p className="font-semibold mb-1">Request Details:</p>
                    <p>Transaction No.: {selectedRequest.transactionNo}</p>
                    <p>Name: {selectedRequest.name}</p>
                    <p>Request: {selectedRequest.request.join(', ')}</p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 sm:space-x-2.5 justify-end mt-4 sm:mt-5 pt-4 sm:pt-5 border-t border-gray-200">
                  <button
                    onClick={() => setShowApproveModal(false)}
                    disabled={processing}
                    className="w-full sm:w-auto px-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors order-2 sm:order-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApproveConfirm}
                    disabled={processing}
                    className="w-full sm:w-auto px-3 py-1.5 text-xs sm:text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:text-gray-600 disabled:cursor-not-allowed disabled:hover:bg-gray-400 order-1 sm:order-2"
                  >
                    {processing ? 'Approving...' : 'Approve'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedRequest && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity" onClick={() => setShowRejectModal(false)} />
          <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md transform transition-all duration-300 scale-100 overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setShowRejectModal(false)}
                className="absolute top-3 right-3 z-10 w-6 h-6 bg-[#1F3463] border-2 border-white rounded-full flex items-center justify-center text-white hover:bg-opacity-90 transition-colors"
              >
                <MdClose className="w-3 h-3" />
              </button>
              <div className="p-3 sm:p-4 md:p-5 border-b border-gray-200">
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">Reject Document Request</h3>
              </div>
              <div className="p-3 sm:p-4 md:p-5">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-2 sm:mb-2.5">
                      Rejection Reason(s) <span className="text-red-500">*</span>
                    </label>
                    <div className="border border-gray-300 rounded-lg p-2 sm:p-3 max-h-48 overflow-y-auto">
                      <div className="space-y-2">
                        {rejectionReasons.map((reason, index) => (
                          <label
                            key={index}
                            className="flex items-start space-x-2 cursor-pointer hover:bg-gray-50 p-1.5 rounded transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={rejectReasons.includes(reason)}
                              onChange={() => handleRejectReasonChange(reason)}
                              className="mt-0.5 rounded border-gray-300 text-[#1F3463] focus:ring-[#1F3463] w-3.5 h-3.5 flex-shrink-0"
                            />
                            <span className="text-[10px] sm:text-xs text-gray-700 flex-1">{reason}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    {rejectReasons.length === 0 && (
                      <p className="mt-1.5 text-[9px] sm:text-[10px] text-red-600">Please select at least one rejection reason</p>
                    )}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600">
                    <p className="font-semibold mb-1">Request Details:</p>
                    <p>Transaction No.: {selectedRequest.transactionNo}</p>
                    <p>Name: {selectedRequest.name}</p>
                    <p>Request: {selectedRequest.request.join(', ')}</p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 sm:space-x-2.5 justify-end mt-4 sm:mt-5 pt-4 sm:pt-5 border-t border-gray-200">
                  <button
                    onClick={() => setShowRejectModal(false)}
                    disabled={processing}
                    className="w-full sm:w-auto px-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors order-2 sm:order-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRejectConfirm}
                    disabled={processing}
                    className="w-full sm:w-auto px-3 py-1.5 text-xs sm:text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:text-gray-600 disabled:cursor-not-allowed disabled:hover:bg-gray-400 order-1 sm:order-2"
                  >
                    {processing ? 'Rejecting...' : 'Reject'}
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

export default DocumentRequest;
