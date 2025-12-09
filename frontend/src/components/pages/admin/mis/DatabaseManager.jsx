import React, { useState, useEffect } from 'react';
import {
  MdRefresh,
  MdAdd,
  MdEdit,
  MdDelete,
  MdDeleteSweep,
  MdSearch,
  MdWarning,
  MdStorage,
  MdTableChart
} from 'react-icons/md';
import { ToastContainer, ConfirmModal } from '../../../ui';
import { useNotification } from '../../../../hooks/useNotification';
import API_CONFIG from '../../../../config/api';
import { authFetch } from '../../../../utils/apiClient';
import {
  EditRecordModal,
  DeleteAllRecordsModal
} from './DatabaseManagerModals';

const DatabaseManager = () => {
  // State management
  const [selectedModel, setSelectedModel] = useState('User');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [deletingRecord, setDeletingRecord] = useState(null);
  const [formData, setFormData] = useState({});
  const [formErrors, setFormErrors] = useState({});

  const { toasts, removeToast, showSuccess, showError, showWarning } = useNotification();

  // Helper function to get record identifier for delete confirmation
  const getRecordIdentifier = (record) => {
    if (!record) return 'this record';
    if (record.transactionNo) return record.transactionNo; // DocumentRequest
    if (record.name) return record.name;
    if (record.title) return record.title;
    if (record.customerName) return record.customerName;
    if (record.email) return record.email;
    if (record._id) return record._id;
    return 'this record';
  };

  // Available models for database management
  const availableModels = [
    { name: 'User', label: 'Users', description: 'Admin users and authentication' },
    { name: 'Queue', label: 'Queue Entries', description: 'Queue management records' },
    { name: 'VisitationForm', label: 'Visitation Forms', description: 'Customer form submissions' },
    { name: 'Window', label: 'Service Windows', description: 'Department service windows' },
    { name: 'Service', label: 'Services', description: 'Available services' },
    { name: 'Settings', label: 'System Settings', description: 'System configuration' },
    { name: 'Rating', label: 'Ratings & Feedback', description: 'Customer ratings and feedback' },
    { name: 'Bulletin', label: 'Bulletins', description: 'News and announcements' },
    { name: 'AuditTrail', label: 'Audit Trail', description: 'System audit logs' },
    { name: 'Office', label: 'Offices', description: 'Office directory information' },
    { name: 'Chart', label: 'Organizational Charts', description: 'Office organizational charts' },
    { name: 'DocumentRequest', label: 'Document Requests', description: 'Document request submissions and claims' }
  ];

  const recordsPerPage = 10;

  // Fetch records for selected model
  const fetchRecords = async (page = 1, search = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: recordsPerPage.toString(),
        ...(search && { search })
      });

      const response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/database/${selectedModel.toLowerCase()}?${params}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch ${selectedModel} records`);
      }

      const data = await response.json();
      setRecords(data.records || []);
      setTotalPages(data.totalPages || 1);
      setTotalRecords(data.totalRecords || 0);
      setCurrentPage(page);
    } catch (error) {
      console.error('Error fetching records:', error);
      showError('Error', `Failed to load ${selectedModel} records: ${error.message}`);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle model selection change
  const handleModelChange = (modelName) => {
    setSelectedModel(modelName);
    setCurrentPage(1);
    setSearchTerm('');
    setRecords([]);
  };

  // Handle search
  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchRecords(1, searchTerm);
  };

  // Handle refresh
  const handleRefresh = () => {
    fetchRecords(currentPage, searchTerm);
  };

  // Handle pagination
  const handlePageChange = (page) => {
    fetchRecords(page, searchTerm);
  };

  // Open edit modal
  const openEditModal = (record = null) => {
    setEditingRecord(record);
    setFormData(record ? { ...record } : {});
    setFormErrors({});
    setShowEditModal(true);
  };

  // Close edit modal
  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingRecord(null);
    setFormData({});
    setFormErrors({});
  };

  // Handle form input change
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear field error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  // Save record (create or update)
  const handleSaveRecord = async (e) => {
    e.preventDefault();

    try {
      const method = editingRecord ? 'PUT' : 'POST';
      const url = editingRecord
        ? `${API_CONFIG.getAdminUrl()}/api/database/${selectedModel.toLowerCase()}/${editingRecord._id}`
        : `${API_CONFIG.getAdminUrl()}/api/database/${selectedModel.toLowerCase()}`;

      const response = await authFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to save ${selectedModel} record`);
      }

      const savedRecord = await response.json();

      if (editingRecord) {
        showSuccess('Record Updated', `${selectedModel} record updated successfully`);
      } else {
        showSuccess('Record Created', `${selectedModel} record created successfully`);
      }

      closeEditModal();
      fetchRecords(currentPage, searchTerm);
    } catch (error) {
      console.error('Error saving record:', error);
      showError('Error', error.message);
    }
  };

  // Open delete confirmation modal
  const openDeleteModal = (record) => {
    setDeletingRecord(record);
    setShowDeleteModal(true);
  };

  // Close delete modal
  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setDeletingRecord(null);
  };

  // Delete single record
  const handleDeleteRecord = async () => {
    if (!deletingRecord) return;

    console.log('🗑️ Attempting to delete record:', {
      model: selectedModel,
      recordId: deletingRecord._id,
      record: deletingRecord
    });

    try {
      const url = `${API_CONFIG.getAdminUrl()}/api/database/${selectedModel.toLowerCase()}/${deletingRecord._id}`;
      console.log('🌐 DELETE URL:', url);

      const response = await authFetch(url, {
        method: 'DELETE',
      });

      console.log('📡 Delete response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Delete failed with error:', errorData);
        throw new Error(errorData.error || `Failed to delete ${selectedModel} record`);
      }

      const result = await response.json();
      console.log('✅ Delete successful:', result);

      showSuccess('Record Deleted', `${selectedModel} record deleted successfully`);
      closeDeleteModal();
      fetchRecords(currentPage, searchTerm);
    } catch (error) {
      console.error('Error deleting record:', error);
      showError('Error', error.message);
    }
  };

  // Open delete all confirmation modal
  const openDeleteAllModal = () => {
    console.log('🗑️ Opening delete all modal for model:', selectedModel, 'Total records:', totalRecords);
    setShowDeleteAllModal(true);
  };

  // Close delete all modal
  const closeDeleteAllModal = () => {
    console.log('❌ Closing delete all modal');
    setShowDeleteAllModal(false);
  };

  // Delete all records
  const handleDeleteAllRecords = async () => {
    console.log('🗑️ Attempting to delete all records for model:', selectedModel);

    try {
      const url = `${API_CONFIG.getAdminUrl()}/api/database/${selectedModel.toLowerCase()}/delete-all`;
      console.log('🌐 DELETE ALL URL:', url);

      const response = await authFetch(url, {
        method: 'DELETE',
      });

      console.log('📡 Delete all response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Delete all failed with error:', errorData);
        throw new Error(errorData.error || `Failed to delete all ${selectedModel} records`);
      }

      const result = await response.json();
      console.log('✅ Delete all successful:', result);

      showSuccess('All Records Deleted', `${result.deletedCount} ${selectedModel} records deleted successfully`);
      closeDeleteAllModal();
      fetchRecords(1, '');
      setSearchTerm('');
    } catch (error) {
      console.error('Error deleting all records:', error);
      showError('Error', error.message);
    }
  };

  // Fetch records when model changes
  useEffect(() => {
    fetchRecords(1, '');
  }, [selectedModel]);

  // Get display fields for each model
  const getDisplayFields = (record) => {
    if (!record) return [];

    const commonFields = ['_id', 'createdAt', 'updatedAt'];
    const allFields = Object.keys(record);

    // Filter out common fields and show them at the end
    const specificFields = allFields.filter(field => !commonFields.includes(field));

    return [...specificFields, ...commonFields.filter(field => allFields.includes(field))];
  };

  // Format field value for display
  const formatFieldValue = (value, field) => {
    if (value === null || value === undefined) return 'N/A';

    if (field === 'createdAt' || field === 'updatedAt' || field === 'dateOfRequest' || field === 'approvedAt' || field === 'rejectedAt' || field === 'claimDate' || field === 'claimedAt') {
      return new Date(value).toLocaleString();
    }

    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    // Handle array fields (e.g., DocumentRequest.request)
    if (Array.isArray(value)) {
      if (value.length === 0) return '[]';
      // For arrays of strings, join them nicely
      if (value.every(item => typeof item === 'string')) {
        return value.join(', ');
      }
      return `[${value.length} items]`;
    }

    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }

    if (typeof value === 'string' && value.length > 50) {
      return value.substring(0, 50) + '...';
    }

    return value.toString();
  };

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-5">
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />

      {/* Main Content Container - Modern white background with shadow */}
      <div className="bg-white p-3 sm:p-4 md:p-5 border border-gray-200 rounded-xl sm:rounded-2xl shadow-lg shadow-[#1F3463]/5">
        {/* Header Section */}
        <div className="mb-4 sm:mb-5 md:mb-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-0">
            <div className="flex-1">
              <div className="flex items-center gap-2 sm:gap-3 mb-2">
                <div className="p-2 bg-[#1F3463]/10 rounded-lg">
                  <MdStorage className="text-[#1F3463] text-xl sm:text-2xl md:text-3xl" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#1F3463] tracking-tight">
                    Database Manager
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                    Direct database record manipulation tool
                  </p>
                </div>
              </div>
              <div className="mt-2 sm:mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                <MdWarning className="text-amber-600 text-sm" />
                <span className="text-xs font-semibold text-amber-800">DEVELOPMENT ONLY</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 bg-[#1F3463] text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-[#1F3463]/90 transition-all duration-200 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:ring-offset-2 shadow-md shadow-[#1F3463]/20 hover:shadow-lg hover:shadow-[#1F3463]/30 disabled:bg-gray-400 disabled:text-gray-600 disabled:cursor-not-allowed disabled:hover:bg-gray-400 disabled:hover:shadow-md"
              >
                <MdRefresh className={`w-4 h-4 transition-transform duration-200 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>
        </div>

        {/* Model Selection - Modern Card Grid */}
        <div className="mb-4 sm:mb-5 md:mb-6">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <div className="p-1.5 bg-[#1F3463]/10 rounded-lg">
              <MdTableChart className="text-[#1F3463] text-base sm:text-lg" />
            </div>
            <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-900">
              Select Database Model
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {availableModels.map((model) => (
              <button
                key={model.name}
                onClick={() => handleModelChange(model.name)}
                className={`group relative p-4 sm:p-5 rounded-xl border-2 transition-all duration-200 text-left hover:shadow-md ${
                  selectedModel === model.name
                    ? 'border-[#1F3463] bg-gradient-to-br from-[#1F3463]/10 to-[#1F3463]/5 shadow-md shadow-[#1F3463]/20'
                    : 'border-gray-200 bg-white hover:border-[#1F3463]/50 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="font-bold text-sm sm:text-base text-gray-900 group-hover:text-[#1F3463] transition-colors">
                    {model.label}
                  </div>
                  {selectedModel === model.name && (
                    <div className="flex-shrink-0 w-5 h-5 bg-[#1F3463] rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">✓</span>
                    </div>
                  )}
                </div>
                <div className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                  {model.description}
                </div>
                {selectedModel === model.name && (
                  <div className="absolute bottom-3 right-3">
                    <div className="px-2 py-0.5 bg-[#1F3463] text-white text-xs font-semibold rounded-full">
                      Active
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Controls and Search - Modern Card Design */}
        <div className="mb-4 sm:mb-5 md:mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
            {/* Search Section */}
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
              <div className="relative flex-1 sm:flex-initial sm:min-w-[280px]">
                <MdSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder={`Search ${selectedModel} records...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#1F3463] focus:border-[#1F3463] focus:border-transparent transition-all duration-200 shadow-sm"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2.5 bg-[#1F3463] text-white rounded-lg hover:bg-[#1F3463]/90 transition-all duration-200 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:ring-offset-2 shadow-md shadow-[#1F3463]/20 hover:shadow-lg hover:shadow-[#1F3463]/30 disabled:bg-gray-400 disabled:text-gray-600 disabled:cursor-not-allowed disabled:hover:bg-gray-400 disabled:hover:shadow-md text-sm font-semibold"
              >
                Search
              </button>
            </form>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => openEditModal()}
                className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-all duration-200 active:scale-95 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 shadow-md shadow-green-600/20 hover:shadow-lg hover:shadow-green-600/30"
              >
                <MdAdd className="w-5 h-5" />
                <span className="hidden sm:inline">Add Record</span>
                <span className="sm:hidden">Add</span>
              </button>

              <button
                onClick={openDeleteAllModal}
                disabled={records.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-all duration-200 active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 shadow-md shadow-red-600/20 hover:shadow-lg hover:shadow-red-600/30 disabled:bg-gray-400 disabled:text-gray-600 disabled:cursor-not-allowed disabled:hover:bg-gray-400 disabled:hover:shadow-md"
              >
                <MdDeleteSweep className="w-5 h-5" />
                <span className="hidden sm:inline">Delete All</span>
                <span className="sm:hidden">Delete</span>
              </button>
            </div>
          </div>

          {/* Record Count - Modern Badge Style */}
          <div className="mt-3 sm:mt-4 flex items-center gap-2">
            {loading ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#1F3463]"></div>
                <span className="text-sm text-blue-700 font-medium">Loading {selectedModel} records...</span>
              </div>
            ) : (
              <div className="px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-lg">
                <span className="text-sm text-gray-700 font-medium">
                  Showing <span className="font-bold text-[#1F3463]">{records.length}</span> of <span className="font-bold text-[#1F3463]">{totalRecords}</span> {selectedModel} records
                  {searchTerm && (
                    <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-xs font-medium">
                      Filtered: "{searchTerm}"
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Records Table - Modern Design */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {[...Array(6)].map((_, index) => (
                    <th key={index} className="px-3 sm:px-4 md:px-5 py-2.5 sm:py-3 md:py-3 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">
                      <div className="h-3 sm:h-3.5 md:h-4 bg-gray-200 rounded w-16 sm:w-18 md:w-20 animate-pulse"></div>
                    </th>
                  ))}
                  <th className="px-3 sm:px-4 md:px-5 py-2.5 sm:py-3 md:py-3 text-right text-sm font-bold text-gray-700 uppercase tracking-wider">
                    <div className="h-3 sm:h-3.5 md:h-4 bg-gray-200 rounded w-12 sm:w-14 md:w-16 ml-auto animate-pulse"></div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {[...Array(7)].map((_, index) => (
                  <tr key={index} className="animate-pulse">
                    {[...Array(6)].map((_, colIndex) => (
                      <td key={colIndex} className="px-3 sm:px-4 md:px-5 py-2.5 sm:py-3 md:py-3 whitespace-nowrap">
                        <div className="h-3 sm:h-3.5 md:h-4 bg-gray-200 rounded w-18 sm:w-20 md:w-24"></div>
                      </td>
                    ))}
                    <td className="px-3 sm:px-4 md:px-5 py-2.5 sm:py-3 md:py-3 whitespace-nowrap text-right">
                      <div className="flex justify-end space-x-1.5 sm:space-x-2">
                        <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 bg-gray-200 rounded"></div>
                        <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 bg-gray-200 rounded"></div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : records.length === 0 ? (
          <div className="p-8 sm:p-12 text-center">
            <div className="mx-auto w-20 h-20 sm:w-24 sm:h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <MdStorage className="h-10 w-10 sm:h-12 sm:w-12 text-gray-400" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">No Records Found</h3>
            <p className="text-sm sm:text-base text-gray-600 mb-6 max-w-md mx-auto">
              {searchTerm
                ? `No ${selectedModel} records match your search criteria. Try adjusting your search terms.`
                : `No ${selectedModel} records exist in the database. Create your first record to get started.`
              }
            </p>
            <button
              onClick={() => openEditModal()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1F3463] text-white rounded-lg text-sm font-semibold hover:bg-[#1F3463]/90 transition-all duration-200 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:ring-offset-2 shadow-md shadow-[#1F3463]/20 hover:shadow-lg hover:shadow-[#1F3463]/30"
            >
              <MdAdd className="w-5 h-5" />
              <span>Add First Record</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-[#1F3463] to-[#1F3463]/95">
                <tr>
                  {records[0] && getDisplayFields(records[0]).slice(0, 6).map((field) => (
                    <th
                      key={field}
                      className="px-4 sm:px-5 md:px-6 py-3 sm:py-3.5 text-left text-xs sm:text-sm font-bold text-white uppercase tracking-wider"
                    >
                      {field.replace(/([A-Z])/g, ' $1').trim()}
                    </th>
                  ))}
                  <th className="px-4 sm:px-5 md:px-6 py-3 sm:py-3.5 text-right text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {records.map((record, index) => (
                  <tr
                    key={record._id || index}
                    className={`hover:bg-blue-50 transition-all duration-150 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                  >
                    {getDisplayFields(record).slice(0, 6).map((field) => (
                      <td key={field} className="px-4 sm:px-5 md:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="max-w-xs truncate font-medium" title={formatFieldValue(record[field], field)}>
                          {formatFieldValue(record[field], field)}
                        </div>
                      </td>
                    ))}
                    <td className="px-4 sm:px-5 md:px-6 py-3 sm:py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEditModal(record)}
                          className="p-2 text-[#1F3463] hover:bg-[#1F3463]/10 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:ring-offset-1"
                          title="Edit record"
                        >
                          <MdEdit className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(record)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                          title="Delete record"
                        >
                          <MdDelete className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination - Modern Design */}
      {totalPages > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-lg">
              <span className="text-sm text-gray-700 font-medium">
                Page <span className="font-bold text-[#1F3463]">{currentPage}</span> of <span className="font-bold text-[#1F3463]">{totalPages}</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-[#1F3463] transition-all duration-200 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed disabled:hover:bg-gray-100"
              >
                Previous
              </button>

              {/* Page numbers */}
              {[...Array(Math.min(5, totalPages))].map((_, index) => {
                const pageNum = Math.max(1, currentPage - 2) + index;
                if (pageNum > totalPages) return null;

                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`px-4 py-2 text-sm font-medium border rounded-lg transition-all duration-200 ${
                      pageNum === currentPage
                        ? 'bg-[#1F3463] text-white border-[#1F3463] shadow-md shadow-[#1F3463]/20'
                        : 'border-gray-300 hover:bg-gray-50 hover:border-[#1F3463]/50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-[#1F3463] transition-all duration-200 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed disabled:hover:bg-gray-100"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <EditRecordModal
        isOpen={showEditModal}
        onClose={closeEditModal}
        onSave={handleSaveRecord}
        formData={formData}
        onInputChange={handleInputChange}
        formErrors={formErrors}
        selectedModel={selectedModel}
        editingRecord={editingRecord}
      />

      {showDeleteModal && deletingRecord && (
        <ConfirmModal
          isOpen={showDeleteModal}
          onClose={closeDeleteModal}
          onConfirm={handleDeleteRecord}
          title="Delete Record"
          message={`Are you sure you want to delete this ${selectedModel} record? Record: ${getRecordIdentifier(deletingRecord)}. This action cannot be undone.`}
          confirmText="Delete Record"
          type="danger"
        />
      )}

      <DeleteAllRecordsModal
        isOpen={showDeleteAllModal}
        onClose={closeDeleteAllModal}
        onConfirm={handleDeleteAllRecords}
        selectedModel={selectedModel}
        recordCount={totalRecords}
      />

        {/* Debug info */}
        {showDeleteAllModal && console.log('🔍 Modal props:', {
          isOpen: showDeleteAllModal,
          selectedModel,
          recordCount: totalRecords,
          recordsLength: records.length
        })}
      </div>
    </div>
  );
};

export default DatabaseManager;
