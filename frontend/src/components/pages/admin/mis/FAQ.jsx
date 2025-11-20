import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MdSearch, MdKeyboardArrowUp, MdKeyboardArrowDown } from 'react-icons/md';
import { IoMdRefresh } from 'react-icons/io';
import { FiEdit3 } from 'react-icons/fi';
import { FaPlus, FaTrash } from 'react-icons/fa';
import { useToast, ToastContainer, ConfirmModal } from '../../../ui';
import Portal from '../../../ui/Portal';
import { io } from 'socket.io-client';
import API_CONFIG from '../../../../config/api';
import { authFetch } from '../../../../utils/apiClient';

const FAQ = () => {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [faqsPerPage] = useState(10);
  const [sortField, setSortField] = useState('category');
  const [sortDirection, setSortDirection] = useState('asc');
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingFAQ, setEditingFAQ] = useState(null);
  const [deletingFAQ, setDeleteingFAQ] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [socket, setSocket] = useState(null);
  const { toasts, removeToast, showSuccess, showError } = useToast();

  const [formData, setFormData] = useState({
    question: '',
    answer: '',
    category: 'General',
    order: 0,
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

  const fetchFAQs = async () => {
    try {
      setLoading(true);
      const response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/faq`);
      if (response.ok) {
        const result = await response.json();
        setFaqs(result.data || []);
      } else {
        showError('Error', 'Failed to fetch FAQs');
      }
    } catch (error) {
      console.error('Error fetching FAQs:', error);
      showError('Error', 'Failed to fetch FAQs');
    } finally {
      setLoading(false);
    }
  };

  // Filter and search FAQs
  const filteredFAQs = useMemo(() => {
    return faqs.filter(faq => {
      const matchesSearch = 
        faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = filterCategory === 'all' || faq.category === filterCategory;
      const matchesStatus = filterStatus === 'all' || faq.status === filterStatus;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [faqs, searchTerm, filterCategory, filterStatus]);

  // Sort FAQs
  const sortedFAQs = useMemo(() => {
    const sorted = [...filteredFAQs];
    sorted.sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];

      if (sortField === 'createdAt' || sortField === 'updatedAt') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredFAQs, sortField, sortDirection]);

  // Pagination
  const indexOfLastFAQ = currentPage * faqsPerPage;
  const indexOfFirstFAQ = indexOfLastFAQ - faqsPerPage;
  const currentFAQs = sortedFAQs.slice(indexOfFirstFAQ, indexOfLastFAQ);
  const totalPages = Math.ceil(sortedFAQs.length / faqsPerPage);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? 
      <MdKeyboardArrowUp className="inline ml-1" /> : 
      <MdKeyboardArrowDown className="inline ml-1" />;
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
      order: 0,
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
      order: faq.order || 0,
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
      order: 0,
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

  return (
    <div className="p-5">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-[#1F3463]">FAQ Management</h1>
        <p className="text-sm text-gray-600 mt-1">Manage frequently asked questions for the kiosk system</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Left side - Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <MdSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-lg" />
              <input
                type="text"
                placeholder="Search FAQs..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent"
              />
            </div>

            {/* Category Filter */}
            <select
              value={filterCategory}
              onChange={(e) => {
                setFilterCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Right side - Refresh and Add buttons */}
          <div className="flex gap-2">
            <button
              onClick={fetchFAQs}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <IoMdRefresh className={`text-lg ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-[#1F3463] text-white rounded-lg hover:bg-[#2d4a7a] transition-colors"
            >
              <FaPlus />
              Add FAQ
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#1F3463] text-white">
              <tr>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-[#2d4a7a]"
                  onClick={() => handleSort('category')}
                >
                  Category <SortIcon field="category" />
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-[#2d4a7a]"
                  onClick={() => handleSort('question')}
                >
                  Question <SortIcon field="question" />
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-[#2d4a7a]"
                  onClick={() => handleSort('order')}
                >
                  Order <SortIcon field="order" />
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-[#2d4a7a]"
                  onClick={() => handleSort('status')}
                >
                  Status <SortIcon field="status" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                    <div className="flex justify-center items-center">
                      <IoMdRefresh className="animate-spin text-2xl mr-2" />
                      Loading FAQs...
                    </div>
                  </td>
                </tr>
              ) : currentFAQs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                    No FAQs found
                  </td>
                </tr>
              ) : (
                currentFAQs.map((faq) => (
                  <tr key={faq._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {faq.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 max-w-md">
                      <div className="line-clamp-2">{faq.question}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {faq.order}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        faq.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {faq.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditModal(faq)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit FAQ"
                        >
                          <FiEdit3 className="text-lg" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(faq)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete FAQ"
                        >
                          <FaTrash className="text-base" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && sortedFAQs.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {indexOfFirstFAQ + 1} to {Math.min(indexOfLastFAQ, sortedFAQs.length)} of {sortedFAQs.length} FAQs
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-3 py-1 text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
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

                  {/* Category and Order Row */}
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

                    {/* Order */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Display Order
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.order}
                        onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463]"
                      />
                      <p className="text-xs text-gray-500 mt-1">Lower numbers appear first</p>
                    </div>
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
    </div>
  );
};

export default FAQ;

