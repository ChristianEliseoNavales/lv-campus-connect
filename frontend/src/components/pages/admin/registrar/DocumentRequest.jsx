import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MdSearch, MdKeyboardArrowUp, MdKeyboardArrowDown, MdClose } from 'react-icons/md';
import { IoMdRefresh } from 'react-icons/io';
import { BiSolidNotepad } from 'react-icons/bi';
import { FaCheck, FaTimes, FaEye } from 'react-icons/fa';
import { ToastContainer, DatePicker, ConfirmModal } from '../../../ui';
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

// Helper function to get default school year
const getDefaultSchoolYear = () => {
  const currentYear = new Date().getFullYear();
  return `${currentYear}-${currentYear + 1}`;
};

// Helper function to calculate claim date by adding business days to approval date (excluding weekends)
const calculateClaimDate = (approvalDate, businessDays) => {
  const claimDate = new Date(approvalDate);
  let daysAdded = 0;

  while (daysAdded < businessDays) {
    claimDate.setDate(claimDate.getDate() + 1);

    // Skip weekends (Saturday = 6, Sunday = 0)
    const dayOfWeek = claimDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      daysAdded++;
    }
  }

  return claimDate;
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

  // Approve/Reject/View Modal State
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showApproveConfirmModal, setShowApproveConfirmModal] = useState(false);
  const [showRejectConfirmModal, setShowRejectConfirmModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [claimDate, setClaimDate] = useState(null);
  const [rejectReasons, setRejectReasons] = useState([]);
  const [processing, setProcessing] = useState(false);

  // Add Request Modal State
  const [showAddRequestModal, setShowAddRequestModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    lastSYAttended: getDefaultSchoolYear(),
    programGradeStrand: '',
    contactNumber: '',
    emailAddress: '',
    request: [],
    claimDate: null,
    remarks: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const requestTypes = [
    'Certificate of Enrollment',
    'Form 137',
    'Transcript of Records',
    'Good Moral Certificate',
    'Certified True Copy of Documents',
    'Education Service Contracting Certificate (ESC)'
  ];

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

  // Handle View
  const handleView = (request) => {
    setSelectedRequest(request);
    setShowViewModal(true);
  };

  // Handle Approve
  const handleApprove = (request) => {
    setSelectedRequest(request);
    // Set default claim date to approval date + 5 business days
    const approvalDate = new Date();
    const defaultClaimDate = calculateClaimDate(approvalDate, 5);
    setClaimDate(defaultClaimDate);
    setShowViewModal(false); // Close view modal if open
    setShowApproveModal(true);
  };

  const handleApproveConfirm = () => {
    // Show confirmation modal first
    setShowApproveConfirmModal(true);
  };

  const performApprove = async () => {
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
            claimDate: claimDate
          })
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        showSuccess('Success', 'Document request approved successfully. Email notification sent.');
        setShowApproveModal(false);
        setShowApproveConfirmModal(false);
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
    setShowViewModal(false); // Close view modal if open
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

  const handleRejectConfirm = () => {
    if (!selectedRequest) return;

    if (rejectReasons.length === 0) {
      showError('Validation Error', 'Please select at least one rejection reason');
      return;
    }

    // Show confirmation modal first
    setShowRejectConfirmModal(true);
  };

  const performReject = async () => {
    if (!selectedRequest) return;

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
        setShowRejectConfirmModal(false);
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

  // Handle Add Request button click
  const handleAddRequest = () => {
    // Set default claim date to approval date + 5 business days
    const approvalDate = new Date();
    const defaultClaimDate = calculateClaimDate(approvalDate, 5);
    setFormData({
      name: '',
      lastSYAttended: getDefaultSchoolYear(),
      programGradeStrand: '',
      contactNumber: '',
      emailAddress: '',
      request: [],
      claimDate: defaultClaimDate,
      remarks: ''
    });
    setFormErrors({});
    setShowAddRequestModal(true);
  };

  // Real-time validation function
  const validateField = (field, value) => {
    const errors = { ...formErrors };

    switch (field) {
      case 'name':
        if (value.trim().length > 200) {
          errors.name = 'Name must be 200 characters or less';
        } else if (errors.name && value.trim().length <= 200) {
          delete errors.name;
        }
        break;
      case 'contactNumber':
        if (value.trim() && !/^(\+63|0)[0-9]{10}$/.test(value.trim())) {
          errors.contactNumber = 'Contact number must be a valid Philippine phone number (+63XXXXXXXXXX or 0XXXXXXXXXX)';
        } else if (errors.contactNumber && (!value.trim() || /^(\+63|0)[0-9]{10}$/.test(value.trim()))) {
          delete errors.contactNumber;
        }
        break;
      case 'emailAddress':
        if (value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
          errors.emailAddress = 'Email must be a valid email address';
        } else if (errors.emailAddress && (!value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))) {
          delete errors.emailAddress;
        }
        break;
      case 'programGradeStrand':
        if (value.trim().length > 200) {
          errors.programGradeStrand = 'Program/Grade/Strand must be 200 characters or less';
        } else if (errors.programGradeStrand && value.trim().length <= 200) {
          delete errors.programGradeStrand;
        }
        break;
      case 'claimDate':
        if (value) {
          const approvalDate = new Date();
          const claimDate = new Date(value);
          if (isNaN(claimDate.getTime())) {
            errors.claimDate = 'Invalid claim date';
          } else if (claimDate < approvalDate) {
            errors.claimDate = 'Claim date cannot be before approval date';
          } else if (errors.claimDate) {
            delete errors.claimDate;
          }
        }
        break;
      default:
        break;
    }

    setFormErrors(errors);
  };

  // Handle form field changes with real-time validation
  const handleFormChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Real-time validation for format-sensitive fields
    if (['name', 'contactNumber', 'emailAddress', 'programGradeStrand', 'claimDate'].includes(field)) {
      validateField(field, value);
    } else {
      // Clear error for other fields when user starts typing
      if (formErrors[field]) {
        setFormErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }
    }
  };

  // Handle document checkbox change
  const handleDocumentCheckboxChange = (documentType) => {
    setFormData(prev => {
      const currentRequest = prev.request || [];
      if (currentRequest.includes(documentType)) {
        return {
          ...prev,
          request: currentRequest.filter(doc => doc !== documentType)
        };
      } else {
        return {
          ...prev,
          request: [...currentRequest, documentType]
        };
      }
    });
    // Clear error when document is selected
    if (formErrors.request) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.request;
        return newErrors;
      });
    }
  };

  // Validate form
  const validateForm = () => {
    const errors = {};

    // Name validation
    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    } else if (formData.name.trim().length > 200) {
      errors.name = 'Name must be 200 characters or less';
    }

    // Last S.Y. Attended validation
    if (!formData.lastSYAttended) {
      errors.lastSYAttended = 'Last S.Y. Attended is required';
    }

    // Program/Grade/Strand validation
    if (!formData.programGradeStrand.trim()) {
      errors.programGradeStrand = 'Program/Grade/Strand is required';
    } else if (formData.programGradeStrand.trim().length > 200) {
      errors.programGradeStrand = 'Program/Grade/Strand must be 200 characters or less';
    }

    // Contact Number validation
    if (!formData.contactNumber.trim()) {
      errors.contactNumber = 'Contact number is required';
    } else if (!/^(\+63|0)[0-9]{10}$/.test(formData.contactNumber.trim())) {
      errors.contactNumber = 'Contact number must be a valid Philippine phone number';
    }

    // Email validation
    if (!formData.emailAddress.trim()) {
      errors.emailAddress = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.emailAddress.trim())) {
      errors.emailAddress = 'Email must be valid';
    }

    // Request validation
    if (!formData.request || formData.request.length === 0) {
      errors.request = 'At least one document must be selected';
    }

    // Claim Date validation
    if (!formData.claimDate) {
      errors.claimDate = 'Claim date is required';
    } else {
      const approvalDate = new Date();
      const claimDate = new Date(formData.claimDate);
      if (isNaN(claimDate.getTime())) {
        errors.claimDate = 'Invalid claim date';
      } else if (claimDate < approvalDate) {
        errors.claimDate = 'Claim date cannot be before approval date';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      const response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/document-requests/registrar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          lastSYAttended: formData.lastSYAttended,
          programGradeStrand: formData.programGradeStrand.trim(),
          contactNumber: formData.contactNumber.trim(),
          emailAddress: formData.emailAddress.trim().toLowerCase(),
          request: formData.request,
          claimDate: formData.claimDate,
          remarks: formData.remarks?.trim() || ''
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        showSuccess('Success', 'Document request created and approved successfully');
        setShowAddRequestModal(false);
        handleCloseModal();
        // Refresh document requests
        fetchDocumentRequests();
      } else {
        throw new Error(result.error || 'Failed to create document request');
      }
    } catch (error) {
      console.error('Error creating document request:', error);
      showError('Error', error.message || 'Failed to create document request');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle modal close
  const handleCloseModal = () => {
    setShowAddRequestModal(false);
    // Set default claim date to approval date + 5 business days
    const approvalDate = new Date();
    const defaultClaimDate = calculateClaimDate(approvalDate, 5);
    setFormData({
      name: '',
      lastSYAttended: getDefaultSchoolYear(),
      programGradeStrand: '',
      contactNumber: '',
      emailAddress: '',
      request: [],
      claimDate: defaultClaimDate,
      remarks: ''
    });
    setFormErrors({});
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
                className="w-10 sm:w-12 px-1 sm:px-1.5 py-0.5 text-xs sm:text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield] text-center"
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

            {/* Add Request Button */}
            <button
              onClick={handleAddRequest}
              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-[#1F3463] text-white rounded-lg hover:bg-[#1F3463]/90 transition-all duration-200 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:ring-offset-2 shadow-lg shadow-[#1F3463]/20 hover:shadow-[#1F3463]/30 text-xs sm:text-sm font-semibold whitespace-nowrap"
            >
              + Add Request
            </button>
          </div>
        </div>

        {/* Document Requests Table */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {loading ? (
            <>
              {/* Table Header */}
              <div className="bg-[#1F3463] px-3 sm:px-4 md:px-5 py-2.5 sm:py-3 md:py-3 border-b border-[#1F3463] min-h-[2.5rem] sm:min-h-[2.75rem] md:min-h-[3rem] flex items-center">
                <div className="grid grid-cols-10 gap-2 sm:gap-2.5 md:gap-3 text-xs font-medium text-white w-full">
                  <div className="whitespace-normal break-words leading-tight">Transaction No.</div>
                  <div className="whitespace-normal break-words leading-tight">Name</div>
                  <div className="whitespace-normal break-words leading-tight">Last S.Y. Attended</div>
                  <div className="whitespace-normal break-words leading-tight">Program/Grade/Strand</div>
                  <div className="whitespace-normal break-words leading-tight">Contact No.</div>
                  <div className="whitespace-normal break-words leading-tight">Email Address</div>
                  <div className="whitespace-normal break-words leading-tight">Request</div>
                  <div className="whitespace-normal break-words leading-tight">Date of Request</div>
                  <div className="whitespace-normal break-words leading-tight">Status</div>
                  <div className="whitespace-normal break-words leading-tight">Action</div>
                </div>
              </div>

              {/* Skeleton Loading Rows */}
              <div className="divide-y divide-gray-200">
                {[...Array(7)].map((_, index) => (
                  <div key={index} className="px-3 sm:px-4 md:px-5 py-2.5 sm:py-3 md:py-3 md:h-12 flex items-center animate-pulse">
                    <div className="grid grid-cols-10 gap-2 sm:gap-2.5 md:gap-3 items-center w-full">
                      {[...Array(10)].map((_, i) => (
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
                <div className="grid grid-cols-10 gap-2 sm:gap-3 text-xs sm:text-sm font-bold text-white w-full">
                  <div className="whitespace-normal break-words leading-tight">Transaction No.</div>
                  <div className="whitespace-normal break-words leading-tight">Name</div>
                  <div className="whitespace-normal break-words leading-tight">Last S.Y. Attended</div>
                  <div className="whitespace-normal break-words leading-tight">Program/Grade/Strand</div>
                  <div className="whitespace-normal break-words leading-tight">Contact No.</div>
                  <div className="whitespace-normal break-words leading-tight">Email Address</div>
                  <div className="whitespace-normal break-words leading-tight">Request</div>
                  <div className="whitespace-normal break-words leading-tight">Date of Request</div>
                  <div className="whitespace-normal break-words leading-tight">Status</div>
                  <div className="whitespace-normal break-words leading-tight">Action</div>
                </div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-gray-200">
                {currentRequests.map((request, index) => (
                  <div key={request.id} className={`px-3 sm:px-4 md:px-5 py-2.5 sm:py-3 hover:bg-gray-50 transition-colors duration-200 md:h-12 flex items-center ${index % 2 === 0 ? 'bg-white' : 'bg-slate-100'}`}>
                    {/* Desktop view */}
                    <div className="hidden md:grid md:grid-cols-10 gap-2 sm:gap-3 items-center w-full">
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

                      {/* Status */}
                      <div className="flex items-center">
                        <span className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold shadow-sm transition-all duration-200 ${getStatusColor(request.status)}`}>
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </span>
                      </div>

                      {/* Action */}
                      <div className="flex items-center space-x-1 sm:space-x-1.5">
                        <button
                          onClick={() => handleView(request)}
                          className="p-1.5 sm:p-2 text-[#1F3463] hover:text-white hover:bg-[#1F3463] rounded-lg transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:ring-offset-1"
                          title="View"
                        >
                          <FaEye className="text-sm sm:text-base" />
                        </button>
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
                      <div className="flex space-x-2 pt-2">
                        <button
                          onClick={() => handleView(request)}
                          className="flex-1 px-3 py-1.5 bg-[#1F3463] text-white rounded-lg hover:bg-[#1F3463]/90 transition-colors text-xs font-semibold"
                        >
                          View
                        </button>
                        {request.status === 'pending' && (
                          <>
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
                          </>
                        )}
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
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md transform transition-all duration-300 scale-100" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setShowApproveModal(false)}
                className="absolute -top-1.5 -right-1.5 z-10 w-6 h-6 bg-[#1F3463] border-2 border-white rounded-full flex items-center justify-center text-white hover:bg-opacity-90 transition-all duration-200 hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:ring-offset-1"
              >
                <MdClose className="w-3 h-3 transition-transform duration-200" />
              </button>
              <div className="p-3 sm:p-4 md:p-5 border-b border-gray-200">
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">Approve Document Request</h3>
              </div>
              <div className="p-3 sm:p-4 md:p-5">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1 sm:mb-1.5">
                      Claim Date <span className="text-red-500">*</span>
                    </label>
                    <DatePicker
                      value={claimDate}
                      onChange={(date) => setClaimDate(date)}
                      placeholder="Select claim date"
                      allowFutureDates={true}
                      showAllDates={false}
                    />
                    {!claimDate && (
                      <p className="text-red-600 text-[10px] sm:text-xs mt-0.5">Claim date is required</p>
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
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md transform transition-all duration-300 scale-100" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setShowRejectModal(false)}
                className="absolute -top-1.5 -right-1.5 z-10 w-6 h-6 bg-[#1F3463] border-2 border-white rounded-full flex items-center justify-center text-white hover:bg-opacity-90 transition-all duration-200 hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:ring-offset-1"
              >
                <MdClose className="w-3 h-3 transition-transform duration-200" />
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
                    disabled={processing || rejectReasons.length === 0}
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

      {/* View Modal */}
      {showViewModal && selectedRequest && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity" onClick={() => setShowViewModal(false)} />
          <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl transform transition-all duration-300 scale-100" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setShowViewModal(false)}
                className="absolute -top-1.5 -right-1.5 z-10 w-6 h-6 bg-[#1F3463] border-2 border-white rounded-full flex items-center justify-center text-white hover:bg-opacity-90 transition-all duration-200 hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:ring-offset-1"
              >
                <MdClose className="w-3 h-3 transition-transform duration-200" />
              </button>
              <div className="p-3 sm:p-4 md:p-5 border-b border-gray-200">
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">Document Request Details</h3>
              </div>
              <div className="p-3 sm:p-4 md:p-5 max-h-[70vh] overflow-y-auto">
                <div className="space-y-4">
                  {/* Basic Information Section */}
                  <div>
                    <h4 className="text-xs sm:text-sm font-semibold text-gray-900 mb-2 sm:mb-3 pb-1 border-b border-gray-200">Basic Information</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-[10px] sm:text-xs font-medium text-gray-500 mb-1">Transaction No.</label>
                        <p className="text-xs sm:text-sm text-gray-900 font-medium">{selectedRequest.transactionNo}</p>
                      </div>
                      <div>
                        <label className="block text-[10px] sm:text-xs font-medium text-gray-500 mb-1">Status</label>
                        <span className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold ${getStatusColor(selectedRequest.status)}`}>
                          {selectedRequest.status.charAt(0).toUpperCase() + selectedRequest.status.slice(1)}
                        </span>
                      </div>
                      <div>
                        <label className="block text-[10px] sm:text-xs font-medium text-gray-500 mb-1">Name</label>
                        <p className="text-xs sm:text-sm text-gray-900">{selectedRequest.name}</p>
                      </div>
                      <div>
                        <label className="block text-[10px] sm:text-xs font-medium text-gray-500 mb-1">Last S.Y. Attended</label>
                        <p className="text-xs sm:text-sm text-gray-900">{selectedRequest.lastSYAttended}</p>
                      </div>
                      <div>
                        <label className="block text-[10px] sm:text-xs font-medium text-gray-500 mb-1">Program/Grade/Strand</label>
                        <p className="text-xs sm:text-sm text-gray-900">{selectedRequest.programGradeStrand}</p>
                      </div>
                      <div>
                        <label className="block text-[10px] sm:text-xs font-medium text-gray-500 mb-1">Contact Number</label>
                        <p className="text-xs sm:text-sm text-gray-900">{selectedRequest.contactNumber}</p>
                      </div>
                      <div>
                        <label className="block text-[10px] sm:text-xs font-medium text-gray-500 mb-1">Email Address</label>
                        <p className="text-xs sm:text-sm text-gray-900 break-all">{selectedRequest.emailAddress}</p>
                      </div>
                      <div>
                        <label className="block text-[10px] sm:text-xs font-medium text-gray-500 mb-1">Date of Request</label>
                        <p className="text-xs sm:text-sm text-gray-900">{formatDate(selectedRequest.dateOfRequest)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Request Details Section */}
                  <div>
                    <h4 className="text-xs sm:text-sm font-semibold text-gray-900 mb-2 sm:mb-3 pb-1 border-b border-gray-200">Request Details</h4>
                    <div>
                      <label className="block text-[10px] sm:text-xs font-medium text-gray-500 mb-1">Request Types</label>
                      <ul className="list-disc list-inside text-xs sm:text-sm text-gray-900 space-y-1">
                        {selectedRequest.request.map((req, index) => (
                          <li key={index}>{req}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Status-Specific Information */}
                  {selectedRequest.status === 'approved' && (
                    <div>
                      <h4 className="text-xs sm:text-sm font-semibold text-gray-900 mb-2 sm:mb-3 pb-1 border-b border-gray-200">Approval Information</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        {selectedRequest.approvedAt && (
                          <div>
                            <label className="block text-[10px] sm:text-xs font-medium text-gray-500 mb-1">Approved At</label>
                            <p className="text-xs sm:text-sm text-gray-900">{formatDate(selectedRequest.approvedAt)}</p>
                          </div>
                        )}
                        {selectedRequest.businessDays && (
                          <div>
                            <label className="block text-[10px] sm:text-xs font-medium text-gray-500 mb-1">Business Days</label>
                            <p className="text-xs sm:text-sm text-gray-900">{selectedRequest.businessDays} days</p>
                          </div>
                        )}
                        {selectedRequest.claimDate && (
                          <div>
                            <label className="block text-[10px] sm:text-xs font-medium text-gray-500 mb-1">Claim Date</label>
                            <p className="text-xs sm:text-sm text-gray-900">{formatDate(selectedRequest.claimDate)}</p>
                          </div>
                        )}
                        {selectedRequest.claimedAt && (
                          <div>
                            <label className="block text-[10px] sm:text-xs font-medium text-gray-500 mb-1">Claimed At</label>
                            <p className="text-xs sm:text-sm text-gray-900">{formatDate(selectedRequest.claimedAt)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedRequest.status === 'rejected' && (
                    <div>
                      <h4 className="text-xs sm:text-sm font-semibold text-gray-900 mb-2 sm:mb-3 pb-1 border-b border-gray-200">Rejection Information</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        {selectedRequest.rejectedAt && (
                          <div>
                            <label className="block text-[10px] sm:text-xs font-medium text-gray-500 mb-1">Rejected At</label>
                            <p className="text-xs sm:text-sm text-gray-900">{formatDate(selectedRequest.rejectedAt)}</p>
                          </div>
                        )}
                        {selectedRequest.remarks && (
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] sm:text-xs font-medium text-gray-500 mb-1">Remarks/Rejection Reasons</label>
                            <p className="text-xs sm:text-sm text-gray-900 whitespace-pre-wrap">{selectedRequest.remarks}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons - Only for pending requests */}
                {selectedRequest.status === 'pending' && (
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 sm:space-x-2.5 justify-end mt-4 sm:mt-5 pt-4 sm:pt-5 border-t border-gray-200">
                    <button
                      onClick={() => handleReject(selectedRequest)}
                      disabled={processing}
                      className="w-full sm:w-auto px-3 py-1.5 text-xs sm:text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:text-gray-600 disabled:cursor-not-allowed disabled:hover:bg-gray-400 order-2 sm:order-1"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleApprove(selectedRequest)}
                      disabled={processing}
                      className="w-full sm:w-auto px-3 py-1.5 text-xs sm:text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:text-gray-600 disabled:cursor-not-allowed disabled:hover:bg-gray-400 order-1 sm:order-2"
                    >
                      Approve
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Request Modal */}
      {showAddRequestModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity"
            onClick={handleCloseModal}
          />

          {/* Modal */}
          <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
            <div
              className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl transform transition-all duration-300 scale-100"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={handleCloseModal}
                className="absolute -top-1.5 -right-1.5 z-10 w-6 h-6 bg-[#1F3463] border-2 border-white rounded-full flex items-center justify-center text-white hover:bg-opacity-90 transition-all duration-200 hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:ring-offset-1"
              >
                <MdClose className="w-3 h-3 transition-transform duration-200" />
              </button>

              {/* Header */}
              <div className="p-3 sm:p-4 md:p-5 border-b border-gray-200">
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">
                  Add Document Request
                </h3>
              </div>

              {/* Content */}
              <div className="p-3 sm:p-4 md:p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {/* Column 1 */}
                  <div className="space-y-3 sm:space-y-4">
                    {/* Name */}
                    <div>
                      <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1 sm:mb-1.5">
                        Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => handleFormChange('name', e.target.value)}
                        onBlur={(e) => validateField('name', e.target.value)}
                        className={`w-full px-2 sm:px-2.5 py-1.5 text-xs sm:text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent ${
                          formErrors.name ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="Enter full name"
                      />
                      {formErrors.name && (
                        <p className="text-red-600 text-[10px] sm:text-xs mt-0.5">{formErrors.name}</p>
                      )}
                    </div>

                    {/* Last S.Y. Attended */}
                    <div>
                      <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1 sm:mb-1.5">
                        Last S.Y. Attended <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.lastSYAttended}
                        onChange={(e) => handleFormChange('lastSYAttended', e.target.value)}
                        className="w-full px-2 sm:px-2.5 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent"
                      >
                        <option value="">Select S.Y.</option>
                        {(() => {
                          const currentYear = new Date().getFullYear();
                          const yearOptions = [];
                          for (let year = currentYear + 1; year >= 2000; year--) {
                            yearOptions.push(`${year}-${year + 1}`);
                          }
                          return yearOptions.map(year => (
                            <option key={year} value={year}>{year}</option>
                          ));
                        })()}
                      </select>
                      {formErrors.lastSYAttended && (
                        <p className="text-red-600 text-[10px] sm:text-xs mt-0.5">{formErrors.lastSYAttended}</p>
                      )}
                    </div>

                    {/* Program/Grade/Strand */}
                    <div>
                      <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1 sm:mb-1.5">
                        Program/Grade/Strand <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.programGradeStrand}
                        onChange={(e) => handleFormChange('programGradeStrand', e.target.value)}
                        onBlur={(e) => validateField('programGradeStrand', e.target.value)}
                        className={`w-full px-2 sm:px-2.5 py-1.5 text-xs sm:text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent ${
                          formErrors.programGradeStrand ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="Enter program, grade, or strand"
                      />
                      {formErrors.programGradeStrand && (
                        <p className="text-red-600 text-[10px] sm:text-xs mt-0.5">{formErrors.programGradeStrand}</p>
                      )}
                    </div>

                    {/* Contact Number */}
                    <div>
                      <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1 sm:mb-1.5">
                        Contact Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.contactNumber}
                        onChange={(e) => handleFormChange('contactNumber', e.target.value)}
                        onBlur={(e) => validateField('contactNumber', e.target.value)}
                        className={`w-full px-2 sm:px-2.5 py-1.5 text-xs sm:text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent ${
                          formErrors.contactNumber ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="+63XXXXXXXXXX or 0XXXXXXXXXX"
                      />
                      {formErrors.contactNumber && (
                        <p className="text-red-600 text-[10px] sm:text-xs mt-0.5">{formErrors.contactNumber}</p>
                      )}
                    </div>

                    {/* Email Address */}
                    <div>
                      <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1 sm:mb-1.5">
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={formData.emailAddress}
                        onChange={(e) => handleFormChange('emailAddress', e.target.value)}
                        onBlur={(e) => validateField('emailAddress', e.target.value)}
                        className={`w-full px-2 sm:px-2.5 py-1.5 text-xs sm:text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent ${
                          formErrors.emailAddress ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="your.email@example.com"
                      />
                      {formErrors.emailAddress && (
                        <p className="text-red-600 text-[10px] sm:text-xs mt-0.5">{formErrors.emailAddress}</p>
                      )}
                    </div>
                  </div>

                  {/* Column 2 */}
                  <div className="space-y-3 sm:space-y-4">

                    {/* Documents Checkboxes */}
                    <div>
                      <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1 sm:mb-1.5">
                        Documents <span className="text-red-500">*</span>
                      </label>
                      <div className="space-y-2 border-2 border-gray-300 rounded-lg p-3 bg-gray-50">
                        {requestTypes.map((requestType) => (
                          <label key={requestType} className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.request.includes(requestType)}
                              onChange={() => handleDocumentCheckboxChange(requestType)}
                              className="w-4 h-4 text-[#1F3463] border-gray-300 rounded focus:ring-[#1F3463]"
                            />
                            <span className="text-xs sm:text-sm text-gray-700">{requestType}</span>
                          </label>
                        ))}
                      </div>
                      {formErrors.request && (
                        <p className="text-red-600 text-[10px] sm:text-xs mt-0.5">{formErrors.request}</p>
                      )}
                    </div>

                    {/* Claim Date */}
                    <div>
                      <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1 sm:mb-1.5">
                        Claim Date <span className="text-red-500">*</span>
                      </label>
                      <div className={formErrors.claimDate ? 'border border-red-500 rounded-lg' : ''}>
                        <DatePicker
                          value={formData.claimDate}
                          onChange={(date) => handleFormChange('claimDate', date)}
                          placeholder="Select claim date"
                          allowFutureDates={true}
                          showAllDates={false}
                        />
                      </div>
                      {formErrors.claimDate && (
                        <p className="text-red-600 text-[10px] sm:text-xs mt-0.5">{formErrors.claimDate}</p>
                      )}
                    </div>

                    {/* Remarks */}
                    <div>
                      <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1 sm:mb-1.5">
                        Remarks
                      </label>
                      <textarea
                        value={formData.remarks || ''}
                        onChange={(e) => handleFormChange('remarks', e.target.value)}
                        className="w-full px-2 sm:px-2.5 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent resize-none"
                        placeholder="Enter any additional remarks or notes..."
                        rows={3}
                      />
                    </div>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 sm:space-x-2.5 justify-end mt-4 sm:mt-5 pt-4 sm:pt-5 border-t border-gray-200">
                  <button
                    onClick={handleCloseModal}
                    disabled={submitting}
                    className="w-full sm:w-auto px-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors order-2 sm:order-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="w-full sm:w-auto px-3 py-1.5 text-xs sm:text-sm bg-[#1F3463] text-white rounded-lg hover:bg-[#1F3463]/90 transition-colors disabled:bg-gray-400 disabled:text-gray-600 disabled:cursor-not-allowed disabled:hover:bg-gray-400 order-1 sm:order-2"
                  >
                    {submitting ? 'Creating...' : 'Create Request'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approve Confirmation Modal */}
      <ConfirmModal
        isOpen={showApproveConfirmModal}
        onClose={() => {
          setShowApproveConfirmModal(false);
        }}
        onConfirm={performApprove}
        title="Approve Document Request"
        message={`Are you sure you want to approve this document request? Transaction No.: ${selectedRequest?.transactionNo || 'N/A'}. This action will send an email notification to the requester.`}
        confirmText="Approve"
        cancelText="Cancel"
        type="info"
      />

      {/* Reject Confirmation Modal */}
      <ConfirmModal
        isOpen={showRejectConfirmModal}
        onClose={() => {
          setShowRejectConfirmModal(false);
        }}
        onConfirm={performReject}
        title="Reject Document Request"
        message={`Are you sure you want to reject this document request? Transaction No.: ${selectedRequest?.transactionNo || 'N/A'}. This action will send an email notification to the requester.`}
        confirmText="Reject"
        cancelText="Cancel"
        type="danger"
      />

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
    </div>
  );
};

export default DocumentRequest;
