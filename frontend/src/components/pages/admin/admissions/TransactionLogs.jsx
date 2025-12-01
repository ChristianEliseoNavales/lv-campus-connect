import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MdSearch, MdKeyboardArrowUp, MdKeyboardArrowDown, MdClose } from 'react-icons/md';
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
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalCount: 0, limit: 10 });
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [transactionDetails, setTransactionDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [viewStatus, setViewStatus] = useState('');
  const [viewRemarks, setViewRemarks] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [fetchError, setFetchError] = useState(null); // Track fetch errors separately
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(new Date());

  // Add Transaction Modal State
  const [showAddTransactionModal, setShowAddTransactionModal] = useState(false);
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    contactNumber: '',
    email: '',
    address: '',
    service: '',
    specialRequest: false,
    priority: 'No',
    idNumber: '',
    role: 'Visitor',
    status: 'Waiting'
  });
  const [formErrors, setFormErrors] = useState({});

  // Autocomplete state for Purpose of Visit
  const [serviceInput, setServiceInput] = useState('');
  const [filteredServices, setFilteredServices] = useState([]);
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);

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

  // Fetch transaction logs - depends on pagination and filter changes
  const fetchTransactionLogs = useCallback(async () => {
    setLoading(true);
    setFetchError(null); // Clear previous errors
    errorShownRef.current = false; // Reset error shown flag

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

      const url = `${API_CONFIG.getAdminUrl()}/api/transactions/admissions?${params.toString()}`;

      const response = await authFetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setTransactionLogs(result.data);
        setPagination(result.pagination || { currentPage: 1, totalPages: 1, totalCount: 0, limit: logsPerPage });
        // Update refresh timestamp
        setLastRefreshTime(new Date());
      } else {
        throw new Error(result.error || 'Failed to fetch transaction logs');
      }
    } catch (error) {
      console.error('Error fetching transaction logs:', error);
      setFetchError(error.message); // Set error state instead of calling showError directly
      setTransactionLogs([]); // Set empty array on error
      setPagination({ currentPage: 1, totalPages: 1, totalCount: 0, limit: logsPerPage });
    } finally {
      setLoading(false);
    }
  }, [currentPage, logsPerPage, dateParam, searchTerm, filterBy]); // Dependencies include all filter params

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

  // Effect for fetching data - triggers on filter/pagination changes
  useEffect(() => {
    fetchTransactionLogs();
  }, [fetchTransactionLogs]);

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
    handleViewTransaction(log);
  };

  // Handle View Transaction
  const handleViewTransaction = async (log) => {
    setSelectedLog(log);
    setShowViewModal(true);
    setLoadingDetails(true);
    setTransactionDetails(null);

    try {
      const response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/admin/transactions/${log.id}/details`);
      const result = await response.json();

      if (response.ok && result.success) {
        setTransactionDetails(result.data);
        setViewStatus(result.data.statusValue);
        setViewRemarks(result.data.remarks || '');
      } else {
        throw new Error(result.error || 'Failed to fetch transaction details');
      }
    } catch (error) {
      console.error('Error fetching transaction details:', error);
      showError('Error', error.message || 'Failed to fetch transaction details');
      setShowViewModal(false);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Handle Update Status and Remarks
  const handleUpdateStatus = async () => {
    if (!transactionDetails || !selectedLog) return;

    setUpdatingStatus(true);
    try {
      const response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/admin/transactions/${selectedLog.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: viewStatus,
          remarks: viewRemarks
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        showSuccess('Success', 'Transaction updated successfully');
        setShowViewModal(false);
        handleCloseViewModal();
        // Refresh transaction logs
        fetchTransactionLogs();
      } else {
        throw new Error(result.error || 'Failed to update transaction');
      }
    } catch (error) {
      console.error('Error updating transaction:', error);
      showError('Error', error.message || 'Failed to update transaction');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Handle Close View Modal
  const handleCloseViewModal = () => {
    setShowViewModal(false);
    setTransactionDetails(null);
    setSelectedLog(null);
    setViewStatus('');
    setViewRemarks('');
  };

  // Fetch services for dropdown
  const fetchServices = useCallback(async () => {
    setLoadingServices(true);
    try {
      const response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/services/admissions`);
      if (response.ok) {
        const data = await response.json();
        const activeServices = data.filter(service => service.isActive);
        setServices(activeServices);
        setFilteredServices(activeServices);
      } else {
        showError('Error', 'Failed to fetch services');
      }
    } catch (error) {
      console.error('Error fetching services:', error);
      showError('Error', 'Failed to fetch services');
    } finally {
      setLoadingServices(false);
    }
  }, [showError]);

  // Filter services for autocomplete
  useEffect(() => {
    if (serviceInput.trim()) {
      const filtered = services.filter(service =>
        service.name.toLowerCase().includes(serviceInput.toLowerCase())
      );
      setFilteredServices(filtered);
    } else {
      setFilteredServices(services);
    }
  }, [serviceInput, services]);

  // Handle service selection from autocomplete
  const handleServiceSelect = (serviceName) => {
    setServiceInput(serviceName);
    handleFormChange('service', serviceName);
    setShowServiceDropdown(false);
  };

  // Handle form field changes
  const handleFormChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear error for this field when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
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

    // Contact Number validation
    if (!formData.contactNumber.trim()) {
      errors.contactNumber = 'Contact number is required';
    } else if (!/^(\+63|0)[0-9]{10}$/.test(formData.contactNumber.trim())) {
      errors.contactNumber = 'Contact number must be a valid Philippine phone number';
    }

    // Email validation
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = 'Email must be valid';
    }

    // Address validation (optional)
    if (formData.address && formData.address.trim().length > 500) {
      errors.address = 'Address must be 500 characters or less';
    }

    // Service validation
    if (!formData.service || !formData.service.trim()) {
      errors.service = 'Service is required';
    }

    // ID Number validation (required if priority)
    if (formData.priority === 'Yes' && !formData.idNumber.trim()) {
      errors.idNumber = 'ID Number is required for priority transactions';
    } else if (formData.idNumber && formData.idNumber.trim().length > 50) {
      errors.idNumber = 'ID Number must be 50 characters or less';
    }

    // Role validation
    if (!formData.role) {
      errors.role = 'Role is required';
    }

    // Status validation
    if (!formData.status) {
      errors.status = 'Status is required';
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
      const payload = {
        customerName: formData.name.trim(),
        contactNumber: formData.contactNumber.trim(),
        email: formData.email.trim(),
        address: formData.address.trim() || '',
        priority: formData.priority === 'Yes',
        idNumber: formData.priority === 'Yes' ? formData.idNumber.trim() : '',
        role: formData.role,
        status: formData.status === 'Now Serving' ? 'serving' :
                formData.status === 'Complete' ? 'completed' :
                formData.status === 'No-show/Cancelled' ? 'no-show' :
                formData.status.toLowerCase()
      };

      // Add service or special request
      if (formData.specialRequest) {
        payload.specialRequest = true;
        payload.specialRequestName = formData.service.trim(); // Use service input as special request name
      } else {
        payload.service = formData.service;
      }

      const response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/admin/transactions/admissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        showSuccess('Success', 'Transaction created successfully');
        setShowAddTransactionModal(false);
        handleCloseModal();
        // Refresh transaction logs
        fetchTransactionLogs();
      } else {
        throw new Error(result.error || 'Failed to create transaction');
      }
    } catch (error) {
      console.error('Error creating transaction:', error);
      showError('Error', error.message || 'Failed to create transaction');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle modal close
  const handleCloseModal = () => {
    setShowAddTransactionModal(false);
    setFormData({
      name: '',
      contactNumber: '',
      email: '',
      address: '',
      service: '',
      specialRequest: false,
      priority: 'No',
      idNumber: '',
      role: 'Visitor',
      status: 'Waiting'
    });
    setFormErrors({});
    setServiceInput('');
    setFilteredServices(services);
    setShowServiceDropdown(false);
  };

  // Handle Add Transaction button click
  const handleAddTransaction = () => {
    setShowAddTransactionModal(true);
    setServiceInput('');
    fetchServices();
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

  // Pagination - use backend pagination data
  const totalPages = pagination.totalPages || 1;
  const totalCount = pagination.totalCount || 0;
  const currentLogs = transactionLogs; // Backend already returns paginated data

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
            <div className="flex items-center space-x-0.5">
              <p className="text-[7px] sm:text-[8px] text-gray-500 uppercase tracking-wide">
                As of {formatRefreshTime(lastRefreshTime)}
              </p>
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="p-1 sm:p-1.5 transition-all duration-200 hover:bg-[#1F3463]/10 rounded-lg border border-[#1F3463]/20 hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:ring-offset-1"
                title="Refresh transaction logs"
              >
                <IoMdRefresh
                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#1F3463] transition-transform duration-200 ${isRefreshing ? 'animate-spin' : ''}`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Row 2 - Controls */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 mb-3 sm:mb-4 md:mb-5">
          {/* Left side - Pagination Control */}
          <div className="flex items-center space-x-1 sm:space-x-1.5 order-2 lg:order-1">
            <span className="text-xs sm:text-sm text-gray-700 font-medium">Showing</span>
            <div className="flex items-center space-x-0.5">
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
                <option value="complete">Complete</option>
                <option value="serving">Now Serving</option>
                <option value="waiting">Waiting</option>
                <option value="skipped">Skipped</option>
                <option value="no-show">No-show/Cancelled</option>
                <option value="priority">Priority</option>
                <option value="special-request">Special Request</option>
              </select>
            </div>

            {/* Add Button */}
            <button
              onClick={handleAddTransaction}
              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-[#1F3463] text-white rounded-lg hover:bg-[#1F3463]/90 transition-all duration-200 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:ring-offset-2 shadow-lg shadow-[#1F3463]/20 hover:shadow-[#1F3463]/30 text-xs sm:text-sm font-semibold whitespace-nowrap"
            >
              + Add Transaction
            </button>
          </div>
        </div>

        {/* Transaction Logs Table */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {loading ? (
            <>
              {/* Table Header - Desktop only */}
              <div className="hidden md:flex bg-[#1F3463] px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 md:py-3 border-b border-[#1F3463] h-10 sm:h-11 md:h-12 items-center">
                <div className="grid grid-cols-8 gap-2 sm:gap-2.5 md:gap-3 text-[10px] sm:text-xs font-medium text-white w-full">
                  <div>Queue No.</div>
                  <div>Name</div>
                  <div>Purpose of Visit</div>
                  <div>Priority</div>
                  <div>Role</div>
                  <div>Turnaround Time</div>
                  <div>Status</div>
                  <div>Remarks</div>
                </div>
              </div>

              {/* Skeleton Loading Rows */}
              <div className="divide-y divide-gray-200">
                {[...Array(7)].map((_, index) => (
                  <div key={index} className="px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 md:py-3 h-16 sm:h-14 md:h-12 flex items-center animate-pulse">
                    <div className="hidden md:grid md:grid-cols-8 gap-2 sm:gap-2.5 md:gap-3 items-center w-full">
                      <div className="h-2.5 sm:h-3 bg-gray-200 rounded w-6"></div>
                      <div className="h-2.5 sm:h-3 bg-gray-200 rounded w-16 sm:w-20"></div>
                      <div className="h-2.5 sm:h-3 bg-gray-200 rounded w-20 sm:w-24"></div>
                      <div className="h-4 sm:h-5 bg-gray-200 rounded-full w-8 sm:w-10"></div>
                      <div className="h-2.5 sm:h-3 bg-gray-200 rounded w-10 sm:w-12"></div>
                      <div className="h-2.5 sm:h-3 bg-gray-200 rounded w-12 sm:w-16"></div>
                      <div className="h-4 sm:h-5 bg-gray-200 rounded-full w-10 sm:w-12"></div>
                      <div className="flex items-center space-x-1 sm:space-x-1.5">
                        <div className="h-2.5 sm:h-3 bg-gray-200 rounded flex-1"></div>
                        <div className="h-3.5 w-3.5 sm:h-4 sm:w-4 bg-gray-200 rounded"></div>
                      </div>
                    </div>
                    {/* Mobile skeleton */}
                    <div className="md:hidden w-full space-y-2">
                      <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-2.5 bg-gray-200 rounded w-1/2"></div>
                      <div className="h-2.5 bg-gray-200 rounded w-2/3"></div>
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
              <div className="hidden md:flex bg-[#1F3463] px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 md:py-3 border-b border-[#1F3463] h-10 sm:h-11 md:h-12 items-center shadow-sm">
                <div className="grid grid-cols-8 gap-2 sm:gap-2.5 md:gap-3 text-xs sm:text-sm font-bold text-white w-full">
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
                {currentLogs.map((log, index) => (
                  <div key={log.id} className={`px-3 sm:px-4 md:px-5 py-2.5 sm:py-3 md:py-3 hover:bg-gray-50 transition-colors duration-200 md:h-12 flex items-center ${index % 2 === 0 ? 'bg-white' : 'bg-slate-100'}`}>
                    {/* Desktop view */}
                    <div className="hidden md:grid md:grid-cols-8 gap-2 sm:gap-2.5 md:gap-3 items-center w-full">
                      <div className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                        #{log.queueNumber.toString().padStart(2, '0')}
                      </div>
                      <div className="text-xs sm:text-sm font-medium text-gray-900 truncate" title={log.customerName}>
                        {log.customerName}
                      </div>
                      <div className="text-xs sm:text-sm font-medium text-gray-900 truncate" title={log.purposeOfVisit}>
                        {log.purposeOfVisit}
                      </div>
                      <div className="text-[10px] sm:text-xs truncate">
                        <span className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold shadow-sm transition-all duration-200 ${
                          log.priority === 'Yes' ? 'text-red-600 bg-red-50' : 'text-gray-600 bg-gray-50'
                        }`}>
                          {log.priority}
                        </span>
                      </div>
                      <div className="text-xs sm:text-sm font-medium text-gray-900 truncate" title={log.role}>
                        {log.role}
                      </div>
                      <div className="text-xs sm:text-sm text-gray-900 font-mono font-semibold truncate">
                        {log.turnaroundTime}
                      </div>
                      <div className="text-[10px] sm:text-xs">
                        <span className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold shadow-sm transition-all duration-200 ${getStatusColor(log.status)}`}>
                          {log.status}
                        </span>
                      </div>
                      <div className="text-[10px] sm:text-xs">
                        <div className="flex items-center space-x-1 sm:space-x-1.5">
                          <span className="text-gray-900 flex-1 truncate text-xs sm:text-sm">
                            {log.remarks || 'No remarks'}
                          </span>
                          <button
                            onClick={() => handleEditRemarks(log)}
                            className="text-gray-400 hover:text-[#1F3463] transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:ring-offset-1 rounded"
                            title="Edit transaction details"
                          >
                            <PiNotePencilDuotone className="text-base sm:text-lg transition-transform duration-200" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Mobile card view */}
                    <div className="md:hidden w-full space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] text-gray-500 uppercase tracking-wide block mb-0.5">Queue No.</span>
                          <div className="text-sm font-bold text-gray-900">#{log.queueNumber.toString().padStart(2, '0')}</div>
                        </div>
                        <div className="flex items-center space-x-1.5">
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
                        <div className="text-xs text-gray-900">{log.purposeOfVisit}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] text-gray-500 uppercase tracking-wide block mb-0.5">Role</span>
                          <div className="text-xs text-gray-900">{log.role}</div>
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-500 uppercase tracking-wide block mb-0.5">Time</span>
                          <div className="text-xs text-gray-900 font-mono font-semibold">{log.turnaroundTime}</div>
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase tracking-wide block mb-0.5">Status</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${getStatusColor(log.status)}`}>
                          {log.status}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase tracking-wide block mb-0.5">Remarks</span>
                        <div className="flex items-center space-x-1.5">
                          <span className="text-xs text-gray-900 flex-1">{log.remarks || 'No remarks'}</span>
                          <button
                            onClick={() => handleEditRemarks(log)}
                            className="text-gray-400 hover:text-[#1F3463] transition-colors"
                            title="Edit transaction details"
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

      {/* Add Transaction Modal */}
      {showAddTransactionModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity"
            onClick={handleCloseModal}
          />

          {/* Modal */}
          <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
            <div
              className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl transform transition-all duration-300 scale-100 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={handleCloseModal}
                className="absolute top-3 right-3 z-10 w-6 h-6 bg-[#1F3463] border-2 border-white rounded-full flex items-center justify-center text-white hover:bg-opacity-90 transition-colors"
              >
                <MdClose className="w-3 h-3" />
              </button>

              {/* Header */}
              <div className="p-3 sm:p-4 md:p-5 border-b border-gray-200">
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">
                  Add Transaction
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
                        className="w-full px-2 sm:px-2.5 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent"
                        placeholder="Enter customer name"
                      />
                      {formErrors.name && (
                        <p className="text-red-600 text-[10px] sm:text-xs mt-0.5">{formErrors.name}</p>
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
                        className="w-full px-2 sm:px-2.5 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent"
                        placeholder="+63XXXXXXXXXX or 0XXXXXXXXXX"
                      />
                      {formErrors.contactNumber && (
                        <p className="text-red-600 text-[10px] sm:text-xs mt-0.5">{formErrors.contactNumber}</p>
                      )}
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1 sm:mb-1.5">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleFormChange('email', e.target.value)}
                        className="w-full px-2 sm:px-2.5 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent"
                        placeholder="customer@example.com"
                      />
                      {formErrors.email && (
                        <p className="text-red-600 text-[10px] sm:text-xs mt-0.5">{formErrors.email}</p>
                      )}
                    </div>

                    {/* Address */}
                    <div>
                      <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1 sm:mb-1.5">
                        Address
                      </label>
                      <input
                        type="text"
                        value={formData.address}
                        onChange={(e) => handleFormChange('address', e.target.value)}
                        className="w-full px-2 sm:px-2.5 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent"
                        placeholder="Enter address (optional)"
                      />
                      {formErrors.address && (
                        <p className="text-red-600 text-[10px] sm:text-xs mt-0.5">{formErrors.address}</p>
                      )}
                    </div>

                    {/* Purpose of Visit / Service - Hybrid Autocomplete */}
                    <div>
                      <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1 sm:mb-1.5">
                        Purpose of Visit <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={serviceInput}
                          onChange={(e) => {
                            const value = e.target.value;
                            setServiceInput(value);
                            handleFormChange('service', value);
                            setShowServiceDropdown(value.trim().length > 0 && filteredServices.length > 0);
                          }}
                          onFocus={() => {
                            if (serviceInput.trim() && filteredServices.length > 0) {
                              setShowServiceDropdown(true);
                            }
                          }}
                          onBlur={() => {
                            // Delay closing to allow option selection
                            setTimeout(() => setShowServiceDropdown(false), 150);
                          }}
                          disabled={loadingServices}
                          className="w-full px-2 sm:px-2.5 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent"
                          placeholder="Type or select service..."
                        />
                        {/* Dropdown */}
                        {showServiceDropdown && filteredServices.length > 0 && !loadingServices && (
                          <div className="absolute top-full left-0 right-0 mt-0.5 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto z-20">
                            {filteredServices.map((service) => (
                              <button
                                key={service.id}
                                type="button"
                                onClick={() => handleServiceSelect(service.name)}
                                className="w-full text-left px-2 sm:px-2.5 py-1.5 text-xs sm:text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none transition-colors"
                              >
                                {service.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {formErrors.service && (
                        <p className="text-red-600 text-[10px] sm:text-xs mt-0.5">{formErrors.service}</p>
                      )}
                    </div>
                  </div>

                  {/* Column 2 */}
                  <div className="space-y-3 sm:space-y-4">

                    {/* Priority */}
                    <div>
                      <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1 sm:mb-1.5">
                        Priority <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.priority}
                        onChange={(e) => {
                          handleFormChange('priority', e.target.value);
                          if (e.target.value === 'No') {
                            handleFormChange('idNumber', '');
                          }
                        }}
                        className="w-full px-2 sm:px-2.5 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent"
                      >
                        <option value="No">No</option>
                        <option value="Yes">Yes</option>
                      </select>
                    </div>

                    {/* ID Number (shown when Priority=Yes) */}
                    {formData.priority === 'Yes' && (
                      <div>
                        <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1 sm:mb-1.5">
                          ID Number <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.idNumber}
                          onChange={(e) => handleFormChange('idNumber', e.target.value)}
                          className="w-full px-2 sm:px-2.5 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent"
                          placeholder="Enter ID number"
                        />
                        {formErrors.idNumber && (
                          <p className="text-red-600 text-[10px] sm:text-xs mt-0.5">{formErrors.idNumber}</p>
                        )}
                      </div>
                    )}

                    {/* Role */}
                    <div>
                      <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1 sm:mb-1.5">
                        Role <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.role}
                        onChange={(e) => handleFormChange('role', e.target.value)}
                        className="w-full px-2 sm:px-2.5 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent"
                      >
                        <option value="Visitor">Visitor</option>
                        <option value="Student">Student</option>
                        <option value="Teacher">Teacher</option>
                        <option value="Alumni">Alumni</option>
                      </select>
                      {formErrors.role && (
                        <p className="text-red-600 text-[10px] sm:text-xs mt-0.5">{formErrors.role}</p>
                      )}
                    </div>

                    {/* Status */}
                    <div>
                      <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1 sm:mb-1.5">
                        Status <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) => handleFormChange('status', e.target.value)}
                        className="w-full px-2 sm:px-2.5 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent"
                      >
                        <option value="Waiting">Waiting</option>
                        <option value="Now Serving">Now Serving</option>
                        <option value="Complete">Complete</option>
                        <option value="Skipped">Skipped</option>
                        <option value="No-show/Cancelled">No-show/Cancelled</option>
                      </select>
                      {formErrors.status && (
                        <p className="text-red-600 text-[10px] sm:text-xs mt-0.5">{formErrors.status}</p>
                      )}
                    </div>

                    {/* Special Request Checkbox */}
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="specialRequest"
                        checked={formData.specialRequest}
                        onChange={(e) => {
                          handleFormChange('specialRequest', e.target.checked);
                        }}
                        className="w-4 h-4 text-[#1F3463] border-gray-300 rounded focus:ring-[#1F3463]"
                      />
                      <label htmlFor="specialRequest" className="ml-2 text-[10px] sm:text-xs font-medium text-gray-700">
                        Special Request
                      </label>
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
                    {submitting ? 'Creating...' : 'Create Transaction'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Transaction Modal */}
      {showViewModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity"
            onClick={handleCloseViewModal}
          />

          {/* Modal */}
          <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
            <div
              className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl transform transition-all duration-300 scale-100"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={handleCloseViewModal}
                className="absolute -top-1.5 -right-1.5 z-10 w-6 h-6 bg-[#1F3463] border-2 border-white rounded-full flex items-center justify-center text-white hover:bg-opacity-90 transition-colors"
              >
                <MdClose className="w-3 h-3" />
              </button>

              {/* Header */}
              <div className="p-3 sm:p-4 md:p-5 border-b border-gray-200">
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">
                  Transaction Details - Queue #{transactionDetails?.queueNumber?.toString().padStart(2, '0') || selectedLog?.queueNumber?.toString().padStart(2, '0')}
                </h3>
                {(transactionDetails?.isAdminCreated || transactionDetails?.isSpecialRequest) && (
                  <div className="flex items-center gap-2 mt-2">
                    {transactionDetails?.isAdminCreated && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800">
                        Admin Created
                      </span>
                    )}
                    {transactionDetails?.isSpecialRequest && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-800">
                        Special Request
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4 sm:p-5 md:p-6">
                {loadingDetails ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-pulse text-gray-400 text-sm">Loading transaction details...</div>
                  </div>
                ) : transactionDetails ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                    {/* Left Column */}
                    <div className="space-y-4 sm:space-y-5">
                      {/* Queue Information Section */}
                      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
                        <h4 className="text-xs sm:text-sm font-bold text-[#1F3463] mb-3 pb-2 border-b-2 border-[#1F3463]/20">
                          Queue Information
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                          <div className="space-y-1">
                            <span className="text-[10px] sm:text-xs text-gray-500 font-medium uppercase tracking-wider block">Queue Number</span>
                            <div className="text-sm sm:text-base font-bold text-[#1F3463]">#{transactionDetails.queueNumber.toString().padStart(2, '0')}</div>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] sm:text-xs text-gray-500 font-medium uppercase tracking-wider block">Office</span>
                            <div className="text-xs sm:text-sm font-semibold text-gray-900 capitalize">{transactionDetails.office}</div>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] sm:text-xs text-gray-500 font-medium uppercase tracking-wider block">Service</span>
                            <div className="text-xs sm:text-sm font-semibold text-gray-900">{transactionDetails.service}</div>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] sm:text-xs text-gray-500 font-medium uppercase tracking-wider block">Window</span>
                            <div className="text-xs sm:text-sm font-semibold text-gray-900">{transactionDetails.window}</div>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] sm:text-xs text-gray-500 font-medium uppercase tracking-wider block">Role</span>
                            <div className="text-xs sm:text-sm font-semibold text-gray-900">{transactionDetails.role}</div>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] sm:text-xs text-gray-500 font-medium uppercase tracking-wider block">Priority</span>
                            <div className="text-xs sm:text-sm">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold shadow-sm ${
                                transactionDetails.priority === 'Yes' ? 'text-red-700 bg-red-100 border border-red-200' : 'text-gray-700 bg-gray-100 border border-gray-200'
                              }`}>
                                {transactionDetails.priority}
                              </span>
                            </div>
                          </div>
                          <div className="space-y-1 sm:col-span-2">
                            <span className="text-[10px] sm:text-xs text-gray-500 font-medium uppercase tracking-wider block">Turnaround Time</span>
                            <div className="text-sm sm:text-base font-mono font-bold text-[#1F3463] bg-[#1F3463]/5 px-3 py-1.5 rounded-lg inline-block">{transactionDetails.turnaroundTime}</div>
                          </div>
                        </div>
                      </div>

                      {/* Customer Information Section */}
                      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
                        <h4 className="text-xs sm:text-sm font-bold text-[#1F3463] mb-3 pb-2 border-b-2 border-[#1F3463]/20">
                          Customer Information
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                          <div className="space-y-1">
                            <span className="text-[10px] sm:text-xs text-gray-500 font-medium uppercase tracking-wider block">Name</span>
                            <div className="text-xs sm:text-sm font-semibold text-gray-900">{transactionDetails.customerName}</div>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] sm:text-xs text-gray-500 font-medium uppercase tracking-wider block">Contact Number</span>
                            <div className="text-xs sm:text-sm font-semibold text-gray-900">{transactionDetails.contactNumber || <span className="text-gray-400 italic">N/A</span>}</div>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] sm:text-xs text-gray-500 font-medium uppercase tracking-wider block">Email</span>
                            <div className="text-xs sm:text-sm font-semibold text-gray-900 break-words">{transactionDetails.email || <span className="text-gray-400 italic">N/A</span>}</div>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] sm:text-xs text-gray-500 font-medium uppercase tracking-wider block">Address</span>
                            <div className="text-xs sm:text-sm font-semibold text-gray-900">{transactionDetails.address || <span className="text-gray-400 italic">N/A</span>}</div>
                          </div>
                          {transactionDetails.priority === 'Yes' && transactionDetails.idNumber && (
                            <div className="space-y-1 sm:col-span-2">
                              <span className="text-[10px] sm:text-xs text-gray-500 font-medium uppercase tracking-wider block">ID Number</span>
                              <div className="text-xs sm:text-sm font-semibold text-gray-900 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">{transactionDetails.idNumber}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-4 sm:space-y-5">
                      {/* Timestamps Section */}
                      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
                        <h4 className="text-xs sm:text-sm font-bold text-[#1F3463] mb-3 pb-2 border-b-2 border-[#1F3463]/20">
                          Timestamps
                        </h4>
                        <div className="space-y-3">
                          <div className="space-y-1 pb-2 border-b border-gray-100 last:border-b-0 last:pb-0">
                            <span className="text-[10px] sm:text-xs text-gray-500 font-medium uppercase tracking-wider block">Queued At</span>
                            <div className="text-xs sm:text-sm font-semibold text-gray-900">
                              {transactionDetails.queuedAt ? new Date(transactionDetails.queuedAt).toLocaleString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              }) : <span className="text-gray-400 italic">N/A</span>}
                            </div>
                          </div>
                          {transactionDetails.calledAt && (
                            <div className="space-y-1 pb-2 border-b border-gray-100 last:border-b-0 last:pb-0">
                              <span className="text-[10px] sm:text-xs text-gray-500 font-medium uppercase tracking-wider block">Called At</span>
                              <div className="text-xs sm:text-sm font-semibold text-gray-900">
                                {new Date(transactionDetails.calledAt).toLocaleString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                            </div>
                          )}
                          {transactionDetails.completedAt && (
                            <div className="space-y-1 pb-2 border-b border-gray-100 last:border-b-0 last:pb-0">
                              <span className="text-[10px] sm:text-xs text-gray-500 font-medium uppercase tracking-wider block">Completed At</span>
                              <div className="text-xs sm:text-sm font-semibold text-gray-900">
                                {new Date(transactionDetails.completedAt).toLocaleString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                            </div>
                          )}
                          {transactionDetails.skippedAt && (
                            <div className="space-y-1 pb-2 border-b border-gray-100 last:border-b-0 last:pb-0">
                              <span className="text-[10px] sm:text-xs text-gray-500 font-medium uppercase tracking-wider block">Skipped At</span>
                              <div className="text-xs sm:text-sm font-semibold text-gray-900">
                                {new Date(transactionDetails.skippedAt).toLocaleString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Status and Remarks Section (Editable) */}
                      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
                        <h4 className="text-xs sm:text-sm font-bold text-[#1F3463] mb-3 pb-2 border-b-2 border-[#1F3463]/20">
                          Status & Remarks
                        </h4>
                        <div className="space-y-3 sm:space-y-4">
                          <div>
                            <label className="block text-[10px] sm:text-xs font-semibold text-gray-700 mb-2">
                              Status <span className="text-red-500">*</span>
                            </label>
                            <select
                              value={viewStatus}
                              onChange={(e) => setViewStatus(e.target.value)}
                              className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-[#1F3463] transition-all duration-200 hover:border-gray-400"
                            >
                              <option value="waiting">Waiting</option>
                              <option value="serving">Now Serving</option>
                              <option value="completed">Complete</option>
                              <option value="skipped">Skipped</option>
                              <option value="cancelled">Cancelled</option>
                              <option value="no-show">No-show</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] sm:text-xs font-semibold text-gray-700 mb-2">
                              Remarks
                            </label>
                            <textarea
                              value={viewRemarks}
                              onChange={(e) => setViewRemarks(e.target.value)}
                              className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-[#1F3463] transition-all duration-200 hover:border-gray-400 resize-none"
                              rows={4}
                              maxLength={500}
                              placeholder="Add remarks about this transaction..."
                            />
                            <div className="text-[9px] sm:text-[10px] text-gray-500 mt-1.5 flex justify-between">
                              <span>{viewRemarks.length}/500 characters</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Footer with Save Button */}
              {transactionDetails && (
                <div className="p-3 sm:p-4 md:p-5 border-t border-gray-200 flex flex-col sm:flex-row gap-2 sm:gap-0 sm:space-x-2.5 justify-end">
                  <button
                    onClick={handleCloseViewModal}
                    disabled={updatingStatus}
                    className="w-full sm:w-auto px-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors order-2 sm:order-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleUpdateStatus}
                    disabled={updatingStatus}
                    className="w-full sm:w-auto px-3 py-1.5 text-xs sm:text-sm bg-[#1F3463] text-white rounded-lg hover:bg-[#1F3463]/90 transition-colors disabled:bg-gray-400 disabled:text-gray-600 disabled:cursor-not-allowed disabled:hover:bg-gray-400 order-1 sm:order-2"
                  >
                    {updatingStatus ? 'Updating...' : 'Update Status & Remarks'}
                  </button>
                </div>
              )}
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

