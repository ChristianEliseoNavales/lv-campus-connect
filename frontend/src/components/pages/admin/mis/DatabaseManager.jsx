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
import { ToastContainer } from '../../../ui/Toast';
import { useNotification } from '../../../../hooks/useNotification';
import API_CONFIG from '../../../../config/api';
import { authFetch } from '../../../../utils/apiClient';
import {
  EditRecordModal,
  DeleteRecordModal,
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

  // Available models for database management
  const availableModels = [
    { name: 'User', label: 'Users', description: 'Admin users and authentication' },
    { name: 'Queue', label: 'Queue Entries', description: 'Queue management records' },
    { name: 'VisitationForm', label: 'Visitation Forms', description: 'Customer form submissions' },
    { name: 'Window', label: 'Service Windows', description: 'Department service windows' },
    { name: 'Service', label: 'Services', description: 'Available services' },
    { name: 'Settings', label: 'System Settings', description: 'System configuration' },
    { name: 'Rating', label: 'Ratings & Feedback', description: 'Customer ratings and feedback' },
    { name: 'Bulletin', label: 'Bulletins', description: 'News and announcements' }
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
    
    if (field === 'createdAt' || field === 'updatedAt') {
      return new Date(value).toLocaleString();
    }
    
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
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
    <div className="space-y-5">
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center tracking-tight">
            <MdStorage className="mr-2.5 text-[#1F3463] text-3xl" />
            Database Manager
          </h1>
          <p className="text-sm text-gray-600 mt-1.5">
            Development tool for direct database record manipulation
          </p>
          <div className="mt-2.5 px-3 py-1.5 bg-yellow-100 border border-yellow-300 rounded-lg inline-block">
            <span className="text-xs font-bold text-yellow-800">⚠️ DEVELOPMENT ONLY</span>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center space-x-1.5 px-4 py-2 text-white rounded-lg text-sm font-semibold hover:bg-opacity-90 transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#1F3463' }}
          >
            <MdRefresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Model Selection */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
          <MdTableChart className="mr-1.5 text-[#1F3463] text-lg" />
          Select Database Model
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {availableModels.map((model) => (
            <button
              key={model.name}
              onClick={() => handleModelChange(model.name)}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                selectedModel === model.name
                  ? 'border-[#1F3463] bg-[#1F3463] bg-opacity-10'
                  : 'border-gray-200 hover:border-[#1F3463] hover:bg-gray-50'
              }`}
            >
              <div className="font-bold text-base text-gray-900">{model.label}</div>
              <div className="text-base text-gray-600 mt-1">{model.description}</div>
              {selectedModel === model.name && (
                <div className="text-sm text-[#1F3463] font-semibold mt-2">
                  ✓ Currently Selected
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Controls and Search */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex items-center space-x-2">
            <div className="relative">
              <MdSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-6 h-6" />
              <input
                type="text"
                placeholder={`Search ${selectedModel} records...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-[#1F3463] focus:border-transparent w-64"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-white rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50"
              style={{ backgroundColor: '#1F3463' }}
            >
              Search
            </button>
          </form>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => openEditModal()}
              className="flex items-center space-x-2 px-5 py-2.5 bg-green-600 text-white rounded-lg text-base font-semibold hover:bg-green-700 transition-colors"
            >
              <MdAdd className="w-5 h-5" />
              <span>Add Record</span>
            </button>

            <button
              onClick={openDeleteAllModal}
              disabled={records.length === 0}
              className="flex items-center space-x-2 px-5 py-2.5 bg-red-600 text-white rounded-lg text-base font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <MdDeleteSweep className="w-5 h-5" />
              <span>Delete All</span>
            </button>
          </div>
        </div>

        {/* Record Count */}
        <div className="mt-4 text-base text-gray-600 font-medium">
          {loading ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#1F3463]"></div>
              <span>Loading {selectedModel} records...</span>
            </div>
          ) : (
            <span>
              Showing {records.length} of {totalRecords} {selectedModel} records
              {searchTerm && ` (filtered by "${searchTerm}")`}
            </span>
          )}
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {[...Array(6)].map((_, index) => (
                    <th key={index} className="px-6 py-3 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">
                      <div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>
                    </th>
                  ))}
                  <th className="px-6 py-3 text-right text-sm font-bold text-gray-700 uppercase tracking-wider">
                    <div className="h-4 bg-gray-200 rounded w-16 ml-auto animate-pulse"></div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {[...Array(7)].map((_, index) => (
                  <tr key={index} className="animate-pulse">
                    {[...Array(6)].map((_, colIndex) => (
                      <td key={colIndex} className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-gray-200 rounded w-24"></div>
                      </td>
                    ))}
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end space-x-2">
                        <div className="w-8 h-8 bg-gray-200 rounded"></div>
                        <div className="w-8 h-8 bg-gray-200 rounded"></div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : records.length === 0 ? (
          <div className="p-8 text-center">
            <MdStorage className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Records Found</h3>
            <p className="text-base text-gray-600">
              {searchTerm
                ? `No ${selectedModel} records match your search criteria.`
                : `No ${selectedModel} records exist in the database.`
              }
            </p>
            <button
              onClick={() => openEditModal()}
              className="mt-4 flex items-center space-x-2 px-5 py-2.5 bg-[#1F3463] text-white rounded-lg text-base font-semibold hover:bg-opacity-90 transition-colors mx-auto"
            >
              <MdAdd className="w-5 h-5" />
              <span>Add First Record</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {records[0] && getDisplayFields(records[0]).slice(0, 6).map((field) => (
                    <th
                      key={field}
                      className="px-6 py-3 text-left text-sm font-bold text-gray-700 uppercase tracking-wider"
                    >
                      {field}
                    </th>
                  ))}
                  <th className="px-6 py-3 text-right text-sm font-bold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {records.map((record, index) => (
                  <tr key={record._id || index} className="hover:bg-gray-50">
                    {getDisplayFields(record).slice(0, 6).map((field) => (
                      <td key={field} className="px-6 py-4 whitespace-nowrap text-base font-medium text-gray-900">
                        <div className="max-w-xs truncate" title={formatFieldValue(record[field], field)}>
                          {formatFieldValue(record[field], field)}
                        </div>
                      </td>
                    ))}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-base font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => openEditModal(record)}
                          className="text-indigo-600 hover:text-indigo-900 p-1 rounded"
                          title="Edit record"
                        >
                          <MdEdit className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(record)}
                          className="text-red-600 hover:text-red-900 p-1 rounded"
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="text-base text-gray-700 font-medium">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 text-base font-medium border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className={`px-4 py-2 text-base font-medium border rounded ${
                      pageNum === currentPage
                        ? 'bg-[#1F3463] text-white border-[#1F3463]'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-4 py-2 text-base font-medium border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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

      <DeleteRecordModal
        isOpen={showDeleteModal}
        onClose={closeDeleteModal}
        onConfirm={handleDeleteRecord}
        record={deletingRecord}
        selectedModel={selectedModel}
      />

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
  );
};

export default DatabaseManager;
