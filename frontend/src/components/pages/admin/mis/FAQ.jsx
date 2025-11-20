import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MdSearch, MdKeyboardArrowUp, MdKeyboardArrowDown, MdQuestionAnswer } from 'react-icons/md';
import { IoMdRefresh } from 'react-icons/io';
import { FiEdit3 } from 'react-icons/fi';
import { FaPlus, FaTrash } from 'react-icons/fa';
import { ToastContainer, ConfirmModal } from '../../../ui';
import { useNotification } from '../../../../hooks/useNotification';
import useURLState from '../../../../hooks/useURLState';
import Portal from '../../../ui/Portal';
import { io } from 'socket.io-client';
import API_CONFIG from '../../../../config/api';
import { authFetch } from '../../../../utils/apiClient';

// Define initial state outside component to prevent recreation
const INITIAL_URL_STATE = {
  searchTerm: '',
  filterCategory: 'all',
  filterStatus: 'all',
  faqsPerPage: 10,
  currentPage: 1
};

const FAQ = () => {
  // URL-persisted state management
  const { state: urlState, updateState } = useURLState(INITIAL_URL_STATE);

  // Extract URL state values
  const { searchTerm, filterCategory, filterStatus, faqsPerPage, currentPage } = urlState;

  // Non-persisted state (resets on navigation)
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingFAQ, setEditingFAQ] = useState(null);
  const [deletingFAQ, setDeleteingFAQ] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [socket, setSocket] = useState(null);
  const [fetchError, setFetchError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(new Date());

  // Ref to track if we've shown an error for the current fetch attempt
  const errorShownRef = useRef(false);

  // Notifications (saves to database)
  const { toasts, removeToast, showSuccess, showError } = useNotification();

  const [formData, setFormData] = useState({
    question: '',
    answer: '',
    category: 'General',
    status: 'active'
  });

  const [formErrors, setFormErrors] = useState({});

  const categories = ['General', 'Registration', 'Financial', 'Academic', 'Campus Life', 'Technology'];

  // Initialize Socket.io connection
  useEffect(() => {
    const newSocket = io(API_CONFIG.getAdminUrl());
    setSocket(newSocket);

    // Join admin room for real-time updates
    newSocket.emit('join-room', 'admin-mis');

    // Listen for FAQ updates
    newSocket.on('faq-updated', (data) => {
      console.log('📡 FAQ update received:', data);
      fetchFAQs();
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Fetch FAQs on component mount
  useEffect(() => {
    fetchFAQs();
  }, []);

  // Fetch FAQs function
  const fetchFAQs = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    errorShownRef.current = false;

    try {
      const response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/faq`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setFaqs(result.data || []);
        setLastRefreshTime(new Date());
      } else {
        throw new Error(result.error || 'Failed to fetch FAQs');
      }
    } catch (error) {
      console.error('Error fetching FAQs:', error);
      setFetchError(error.message);
      setFaqs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Manual refresh function
  const handleManualRefresh = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      await fetchFAQs();
      showSuccess('Refreshed', 'FAQs updated successfully');
    } catch (error) {
      console.error('Manual refresh error:', error);
      showError('Refresh Failed', 'Unable to update FAQs');
    } finally {
      setIsRefreshing(false);
    }
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

  // Handle FAQs per page change with arrow buttons
  const handleFaqsPerPageChange = (delta) => {
    const newValue = Math.max(5, Math.min(50, faqsPerPage + delta));
    updateState('faqsPerPage', newValue);
    updateState('currentPage', 1); // Reset to first page
  };

  // Filter and search FAQs - Sort alphabetically by question
  const filteredFAQs = useMemo(() => {
    const filtered = faqs.filter(faq => {
      const matchesSearch =
        faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory = filterCategory === 'all' || faq.category === filterCategory;
      const matchesStatus = filterStatus === 'all' || faq.status === filterStatus;

      return matchesSearch && matchesCategory && matchesStatus;
    });

    // Sort alphabetically by question
    return filtered.sort((a, b) => {
      return a.question.toLowerCase().localeCompare(b.question.toLowerCase());
    });
  }, [faqs, searchTerm, filterCategory, filterStatus]);

  // Pagination
  const indexOfLastFAQ = currentPage * faqsPerPage;
  const indexOfFirstFAQ = indexOfLastFAQ - faqsPerPage;
  const currentFAQs = filteredFAQs.slice(indexOfFirstFAQ, indexOfLastFAQ);
  const totalPages = Math.ceil(filteredFAQs.length / faqsPerPage);

  // Handle page change
  const handlePageChange = (newPage) => {
    updateState('currentPage', newPage);
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.question.trim()) {
      errors.question = 'Question is required';
    } else if (formData.question.length < 10) {
      errors.question = 'Question must be at least 10 characters';
    } else if (formData.question.length > 500) {
      errors.question = 'Question cannot exceed 500 characters';
    }

    if (!formData.answer.trim()) {
      errors.answer = 'Answer is required';
    } else if (formData.answer.length < 10) {
      errors.answer = 'Answer must be at least 10 characters';
    } else if (formData.answer.length > 2000) {
      errors.answer = 'Answer cannot exceed 2000 characters';
    }

    if (!formData.category) {
      errors.category = 'Category is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openAddModal = () => {
    setEditingFAQ(null);
    setFormData({
      question: '',
      answer: '',
      category: 'General',
      status: 'active'
    });
    setFormErrors({});
    setShowAddEditModal(true);
  };

  const openEditModal = (faq) => {
    setEditingFAQ(faq);
    setFormData({
      question: faq.question,
      answer: faq.answer,
      category: faq.category,
      status: faq.status
    });
    setFormErrors({});
    setShowAddEditModal(true);
  };

  const closeModal = () => {
    setShowAddEditModal(false);
    setEditingFAQ(null);
    setFormData({
      question: '',
      answer: '',
      category: 'General',
      status: 'active'
    });
    setFormErrors({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const url = editingFAQ
        ? `${API_CONFIG.getAdminUrl()}/api/faq/${editingFAQ._id}`
        : `${API_CONFIG.getAdminUrl()}/api/faq`;

      const method = editingFAQ ? 'PUT' : 'POST';

      const response = await authFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        showSuccess(
          'Success',
          editingFAQ ? 'FAQ updated successfully' : 'FAQ created successfully'
        );

        // Emit socket event for real-time updates
        if (socket) {
          socket.emit('faq-updated', {
            type: editingFAQ ? 'faq-updated' : 'faq-created',
            data: result.data
          });
        }

        closeModal();
        fetchFAQs();
      } else {
        showError('Error', result.error || 'Failed to save FAQ');
      }
    } catch (error) {
      console.error('Error saving FAQ:', error);
      showError('Error', 'Failed to save FAQ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDeleteModal = (faq) => {
    setDeleteingFAQ(faq);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!deletingFAQ) return;

    try {
      const response = await authFetch(
        `${API_CONFIG.getAdminUrl()}/api/faq/${deletingFAQ._id}`,
        { method: 'DELETE' }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        showSuccess('Success', 'FAQ deleted successfully');

        // Emit socket event for real-time updates
        if (socket) {
          socket.emit('faq-updated', {
            type: 'faq-deleted',
            data: { id: deletingFAQ._id }
          });
        }

        setShowDeleteModal(false);
        setDeleteingFAQ(null);
        fetchFAQs();
      } else {
        showError('Error', result.error || 'Failed to delete FAQ');
      }
    } catch (error) {
      console.error('Error deleting FAQ:', error);
      showError('Error', 'Failed to delete FAQ');
    }
  };

  // Force recompile
  return (
    <>
      <div className="space-y-5">
        <ToastContainer toasts={toasts} removeToast={removeToast} />

        {/* Main Content Container - White background similar to Ratings.jsx */}
        <div className="bg-white p-5 border border-gray-200 rounded-xl">

        {/* Row 1 - Header */}
        <div className="mb-5">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">FAQs</h1>
            <div className="flex items-center space-x-1">
              <p className="text-[8px] text-gray-500 uppercase tracking-wide">
                As of {formatRefreshTime(lastRefreshTime)}
              </p>
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="p-1.5 transition-colors duration-200 hover:bg-[#1F3463]/10 rounded-lg border border-[#1F3463]/20"
                title="Refresh FAQs"
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
                value={faqsPerPage}
                onChange={(e) => updateState('faqsPerPage', Math.max(5, Math.min(50, parseInt(e.target.value) || 10)))}
                className="w-12 px-1.5 py-0.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent"
                min="5"
                max="50"
              />
              <div className="flex flex-col">
                <button
                  onClick={() => handleFaqsPerPageChange(1)}
                  className="p-0.5 text-gray-500 hover:text-[#1F3463] transition-colors"
                >
                  <MdKeyboardArrowUp className="text-sm" />
                </button>
                <button
                  onClick={() => handleFaqsPerPageChange(-1)}
                  className="p-0.5 text-gray-500 hover:text-[#1F3463] transition-colors"
                >
                  <MdKeyboardArrowDown className="text-sm" />
                </button>
              </div>
            </div>
            <span className="text-sm text-gray-700 font-medium">FAQs</span>
          </div>

          {/* Right side - Search, Filters, Add button */}
          <div className="flex items-center space-x-3">
            {/* Search */}
            <div className="relative">
              <MdSearch className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 text-lg" />
              <input
                type="text"
                placeholder="Search FAQs..."
                value={searchTerm}
                onChange={(e) => updateState('searchTerm', e.target.value)}
                className="w-52 pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent"
              />
            </div>

            {/* Category Filter */}
            <div className="flex items-center space-x-1.5">
              <label className="text-sm text-gray-700 font-medium">Category:</label>
              <select
                value={filterCategory}
                onChange={(e) => updateState('filterCategory', e.target.value)}
                className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center space-x-1.5">
              <label className="text-sm text-gray-700 font-medium">Status:</label>
              <select
                value={filterStatus}
                onChange={(e) => updateState('filterStatus', e.target.value)}
                className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* Add FAQ Button */}
            <button
              onClick={openAddModal}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#1F3463] text-white rounded-lg hover:bg-[#2d4a7a] transition-colors font-medium"
            >
              <FaPlus className="text-xs" />
              Add FAQ
            </button>
          </div>
        </div>

        {/* FAQs Table */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {loading ? (
            <>
              {/* Table Header */}
              <div className="bg-gray-50 px-5 py-3 border-b border-gray-200 h-12 flex items-center">
                <div className="grid grid-cols-4 gap-3 text-sm font-bold text-gray-700 w-full">
                  <div>Category</div>
                  <div>Question</div>
                  <div>Status</div>
                  <div>Actions</div>
                </div>
              </div>

              {/* Skeleton Loading Rows */}
              <div className="divide-y divide-gray-200">
                {[...Array(7)].map((_, index) => (
                  <div key={index} className="px-5 py-3 h-12 flex items-center animate-pulse">
                    <div className="grid grid-cols-4 gap-3 items-center w-full">
                      <div className="h-3 bg-gray-200 rounded w-20"></div>
                      <div className="h-3 bg-gray-200 rounded w-full"></div>
                      <div className="h-3 bg-gray-200 rounded w-16"></div>
                      <div className="flex space-x-2">
                        <div className="w-8 h-8 bg-gray-200 rounded"></div>
                        <div className="w-8 h-8 bg-gray-200 rounded"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : currentFAQs.length === 0 ? (
            <div className="text-center py-10">
              <MdQuestionAnswer className="text-5xl text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-1.5">No FAQs found</h3>
              <p className="text-sm text-gray-500">Try adjusting your search or filter criteria</p>
            </div>
          ) : (
            <>
              {/* Table Header */}
              <div className="bg-gray-50 px-5 py-3 border-b border-gray-200 h-12 flex items-center">
                <div className="grid grid-cols-4 gap-3 text-sm font-bold text-gray-700 w-full">
                  <div>Category</div>
                  <div>Question</div>
                  <div>Status</div>
                  <div>Actions</div>
                </div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-gray-200">
                {currentFAQs.map((faq) => (
                  <div key={faq._id} className="px-5 py-3 hover:bg-gray-50 transition-colors h-12 flex items-center">
                    <div className="grid grid-cols-4 gap-3 items-center w-full">
                      {/* Category */}
                      <div className="text-sm font-medium text-gray-900 truncate">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {faq.category}
                        </span>
                      </div>

                      {/* Question */}
                      <div className="text-sm font-medium text-gray-900 truncate" title={faq.question}>
                        {faq.question}
                      </div>

                      {/* Status */}
                      <div className="text-sm truncate">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          faq.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {faq.status}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditModal(faq)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit FAQ"
                        >
                          <FiEdit3 className="text-base" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(faq)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete FAQ"
                        >
                          <FaTrash className="text-sm" />
                        </button>
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
          <div className="flex items-center justify-between mt-5">
            <div className="text-sm text-gray-700 font-medium">
              Showing {indexOfFirstFAQ + 1} to {Math.min(indexOfLastFAQ, filteredFAQs.length)} of {filteredFAQs.length} FAQs
            </div>
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-2.5 py-1.5 text-sm font-semibold text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              {/* Current Page Number */}
              <button
                className="px-2.5 py-1.5 text-sm font-semibold text-white bg-[#1F3463] border border-[#1F3463] rounded-md"
              >
                {currentPage}
              </button>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1.5 text-sm font-semibold text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Add/Edit Modal - Rendered outside space-y-5 container */}
      {showAddEditModal && (
        <Portal>
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-[#1F3463]">
                  {editingFAQ ? 'Edit FAQ' : 'Add New FAQ'}
                </h2>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleSubmit} className="p-6">
                <div className="space-y-4">
                  {/* Question */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Question <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={formData.question}
                      onChange={(e) => {
                        setFormData({ ...formData, question: e.target.value });
                        if (formErrors.question) {
                          setFormErrors({ ...formErrors, question: '' });
                        }
                      }}
                      rows={2}
                      maxLength={500}
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463] ${
                        formErrors.question ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Enter the question..."
                    />
                    <div className="flex justify-between mt-1">
                      {formErrors.question && (
                        <p className="text-xs text-red-500">{formErrors.question}</p>
                      )}
                      <p className="text-xs text-gray-500 ml-auto">
                        {formData.question.length}/500 characters
                      </p>
                    </div>
                  </div>

                  {/* Answer */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Answer <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={formData.answer}
                      onChange={(e) => {
                        setFormData({ ...formData, answer: e.target.value });
                        if (formErrors.answer) {
                          setFormErrors({ ...formErrors, answer: '' });
                        }
                      }}
                      rows={5}
                      maxLength={2000}
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463] ${
                        formErrors.answer ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Enter the answer..."
                    />
                    <div className="flex justify-between mt-1">
                      {formErrors.answer && (
                        <p className="text-xs text-red-500">{formErrors.answer}</p>
                      )}
                      <p className="text-xs text-gray-500 ml-auto">
                        {formData.answer.length}/2000 characters
                      </p>
                    </div>
                  </div>

                  {/* Category and Status Row */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Category */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Category <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.category}
                        onChange={(e) => {
                          setFormData({ ...formData, category: e.target.value });
                          if (formErrors.category) {
                            setFormErrors({ ...formErrors, category: '' });
                          }
                        }}
                        className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463] ${
                          formErrors.category ? 'border-red-500' : 'border-gray-300'
                        }`}
                      >
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      {formErrors.category && (
                        <p className="text-xs text-red-500 mt-1">{formErrors.category}</p>
                      )}
                    </div>

                    {/* Status */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Status
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463]"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-1">Only active FAQs are shown in the kiosk</p>
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm text-white bg-[#1F3463] rounded-lg hover:bg-[#2d4a7a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSubmitting ? 'Saving...' : (editingFAQ ? 'Update FAQ' : 'Create FAQ')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deletingFAQ && (
        <ConfirmModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setDeleteingFAQ(null);
          }}
          onConfirm={handleDelete}
          title="Delete FAQ"
          message={`Are you sure you want to delete this FAQ? This action cannot be undone.`}
          confirmText="Delete"
          confirmButtonClass="bg-red-600 hover:bg-red-700"
        />
      )}
    </>
  );
};

export default FAQ;

