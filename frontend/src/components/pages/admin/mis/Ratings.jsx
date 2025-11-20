import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MdSearch, MdKeyboardArrowUp, MdKeyboardArrowDown, MdStar, MdStarBorder } from 'react-icons/md';
import { IoMdRefresh } from 'react-icons/io';
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

const Ratings = () => {
  // URL-persisted state management
  const { state: urlState, updateState } = useURLState(INITIAL_URL_STATE);

  // Extract URL state values
  const { searchTerm, filterBy, selectedDate, logsPerPage, currentPage } = urlState;

  // Non-persisted state (resets on navigation)
  const [ratings, setRatings] = useState([]);
  const [filteredRatings, setFilteredRatings] = useState([]);
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

  // Fetch ratings - only depends on date changes
  const fetchRatings = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    errorShownRef.current = false;

    try {
      let url = `${API_CONFIG.getAdminUrl()}/api/queue-ratings`;
      const params = new URLSearchParams();

      if (dateParam) {
        params.append('startDate', dateParam);
        params.append('endDate', dateParam);
      }

      // Fetch all ratings for the selected date (or all if no date selected)
      params.append('limit', '10000'); // High limit to get all records

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await authFetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setRatings(result.data);
        setLastRefreshTime(new Date());
      } else {
        throw new Error(result.error || 'Failed to fetch ratings');
      }
    } catch (error) {
      console.error('Error fetching ratings:', error);
      setFetchError(error.message);
      setRatings([]);
    } finally {
      setLoading(false);
    }
  }, [dateParam]);

  // Manual refresh function for ratings
  const handleManualRefresh = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      await fetchRatings();
      showSuccess('Refreshed', 'Ratings updated successfully');
    } catch (error) {
      console.error('Manual refresh error:', error);
      showError('Refresh Failed', 'Unable to update ratings');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Client-side filtering - separate from API fetching
  const applyFilters = useCallback(() => {
    let filtered = [...ratings];

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(rating =>
        rating.customerName?.toLowerCase().includes(searchLower) ||
        rating.serviceName?.toLowerCase().includes(searchLower) ||
        rating.department?.toLowerCase().includes(searchLower)
      );
    }

    // Apply filter by rating value or department
    if (filterBy !== 'all') {
      if (filterBy === 'registrar' || filterBy === 'admissions') {
        filtered = filtered.filter(rating => rating.department === filterBy);
      } else if (filterBy.endsWith('_star')) {
        const ratingValue = parseInt(filterBy.charAt(0));
        filtered = filtered.filter(rating => rating.rating === ratingValue);
      }
    }

    setFilteredRatings(filtered);
  }, [ratings, searchTerm, filterBy]);

  // Effect for fetching data - only when date changes or on mount
  useEffect(() => {
    fetchRatings();
  }, [fetchRatings]);

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
      showError('Error', 'Failed to load ratings');
      errorShownRef.current = true;
      // Clear the error after showing it to prevent repeated notifications
      setFetchError(null);
    }
  }, [fetchError, showError]);

  // Handle logs per page change
  const handleLogsPerPageChange = (increment) => {
    const newValue = Math.max(5, Math.min(50, logsPerPage + increment));
    updateState('logsPerPage', newValue);
    updateState('currentPage', 1);
  };

  // Pagination logic
  const totalPages = Math.ceil(filteredRatings.length / logsPerPage);
  const startIndex = (currentPage - 1) * logsPerPage;
  const endIndex = startIndex + logsPerPage;
  const currentRatings = filteredRatings.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    updateState('currentPage', page);
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

  // Render star rating
  const renderStarRating = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <span key={i}>
          {i <= rating ? (
            <MdStar className="text-[#1F3463] text-xl" />
          ) : (
            <MdStarBorder className="text-gray-300 text-xl" />
          )}
        </span>
      );
    }
    return <div className="flex items-center space-x-1">{stars}</div>;
  };

  return (
    <div className="space-y-5">
      {/* Main Content Container - White background similar to Settings.jsx */}
      <div className="bg-white p-5 border border-gray-200 rounded-xl">

        {/* Row 1 - Header */}
        <div className="mb-5">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Ratings</h1>
            <div className="flex items-center space-x-1">
              <p className="text-[8px] text-gray-500 uppercase tracking-wide">
                As of {formatRefreshTime(lastRefreshTime)}
              </p>
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="p-1.5 transition-colors duration-200 hover:bg-[#1F3463]/10 rounded-lg border border-[#1F3463]/20"
                title="Refresh ratings"
              >
                <IoMdRefresh
                  className={`w-5 h-5 text-[#1F3463] ${isRefreshing ? 'animate-spin' : ''}`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Row 2 - Controls */}
        <div className="flex justify-between items-center mb-5">
          {/* Left side - Pagination Control */}
          <div className="flex items-center space-x-1.5">
            <span className="text-sm text-gray-700 font-medium">Showing</span>
            <div className="flex items-center space-x-1">
              <input
                type="number"
                value={logsPerPage}
                onChange={(e) => updateState('logsPerPage', Math.max(5, Math.min(50, parseInt(e.target.value) || 10)))}
                className="w-12 px-1.5 py-0.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent"
                min="5"
                max="50"
              />
              <div className="flex flex-col">
                <button
                  onClick={() => handleLogsPerPageChange(1)}
                  className="p-0.5 text-gray-500 hover:text-[#1F3463] transition-colors"
                >
                  <MdKeyboardArrowUp className="text-sm" />
                </button>
                <button
                  onClick={() => handleLogsPerPageChange(-1)}
                  className="p-0.5 text-gray-500 hover:text-[#1F3463] transition-colors"
                >
                  <MdKeyboardArrowDown className="text-sm" />
                </button>
              </div>
            </div>
            <span className="text-sm text-gray-700 font-medium">Ratings</span>
          </div>

          {/* Right side - Date Filter, Search, Filter dropdown */}
          <div className="flex items-center space-x-3">
            {/* Date Filter */}
            <div className="flex items-center space-x-1.5">
              <label className="text-sm text-gray-700 font-medium">Date:</label>
              <DatePicker
                value={selectedDate}
                onChange={(date) => updateState('selectedDate', date)}
                placeholder="All Dates"
              />
            </div>

            {/* Search */}
            <div className="relative">
              <MdSearch className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 text-lg" />
              <input
                type="text"
                placeholder="Search ratings..."
                value={searchTerm}
                onChange={(e) => updateState('searchTerm', e.target.value)}
                className="w-52 pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent"
              />
            </div>

            {/* Filter */}
            <div className="flex items-center space-x-1.5">
              <label className="text-sm text-gray-700 font-medium">Filter by:</label>
              <select
                value={filterBy}
                onChange={(e) => updateState('filterBy', e.target.value)}
                className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent"
              >
                <option value="all">All Ratings</option>
                <option value="5_star">5 Stars</option>
                <option value="4_star">4 Stars</option>
                <option value="3_star">3 Stars</option>
                <option value="2_star">2 Stars</option>
                <option value="1_star">1 Star</option>
                <option value="registrar">Registrar</option>
                <option value="admissions">Admissions</option>
              </select>
            </div>
          </div>
        </div>

        {/* Ratings Table */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {loading ? (
            <>
              {/* Table Header */}
              <div className="bg-gray-50 px-5 py-3 border-b border-gray-200 h-12 flex items-center">
                <div className="grid grid-cols-4 gap-3 text-sm font-bold text-gray-700 w-full">
                  <div>Time</div>
                  <div>Date</div>
                  <div>Name</div>
                  <div>Rate</div>
                </div>
              </div>

              {/* Skeleton Loading Rows */}
              <div className="divide-y divide-gray-200">
                {[...Array(7)].map((_, index) => (
                  <div key={index} className="px-5 py-3 h-12 flex items-center animate-pulse">
                    <div className="grid grid-cols-4 gap-3 items-center w-full">
                      <div className="h-3 bg-gray-200 rounded w-12"></div>
                      <div className="h-3 bg-gray-200 rounded w-16"></div>
                      <div className="h-3 bg-gray-200 rounded w-20"></div>
                      <div className="flex space-x-1">
                        {[...Array(5)].map((_, starIndex) => (
                          <div key={starIndex} className="w-4 h-4 bg-gray-200 rounded"></div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : currentRatings.length === 0 ? (
            <div className="text-center py-10">
              <MdStar className="text-5xl text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-1.5">No ratings found</h3>
              <p className="text-sm text-gray-500">Try adjusting your search or filter criteria</p>
            </div>
          ) : (
            <>
              {/* Table Header */}
              <div className="bg-gray-50 px-5 py-3 border-b border-gray-200 h-12 flex items-center">
                <div className="grid grid-cols-4 gap-3 text-sm font-bold text-gray-700 w-full">
                  <div>Time</div>
                  <div>Date</div>
                  <div>Name</div>
                  <div>Rate</div>
                </div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-gray-200">
                {currentRatings.map((rating) => {
                  // Use queuedAt from the aggregated data, fallback to createdAt
                  const dateToFormat = rating.queuedAt || rating.createdAt;
                  const { time, date } = formatDateTime(dateToFormat);

                  return (
                    <div key={rating._id} className="px-5 py-3 hover:bg-gray-50 transition-colors h-12 flex items-center">
                      <div className="grid grid-cols-4 gap-3 items-center w-full">
                        {/* Time */}
                        <div className="text-sm font-bold text-gray-900 truncate">
                          {time}
                        </div>

                        {/* Date */}
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {date}
                        </div>

                        {/* Name */}
                        <div className="text-sm font-medium text-gray-900 truncate" title={rating.customerName || 'Unknown Customer'}>
                          {rating.customerName || 'Unknown Customer'}
                        </div>

                        {/* Rate (5-star system) */}
                        <div className="truncate">
                          {renderStarRating(rating.rating)}
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
          <div className="flex items-center justify-between mt-5">
            <div className="text-sm text-gray-700 font-medium">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredRatings.length)} of {filteredRatings.length} ratings
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              size="md"
            />
          </div>
        )}
      </div>

      {/* Toast Container */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
};

export default Ratings;
