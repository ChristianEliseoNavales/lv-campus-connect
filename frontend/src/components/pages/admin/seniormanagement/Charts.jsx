import React, { useState, useEffect, useRef } from 'react';
import { FaPlus, FaUpload } from 'react-icons/fa';
import { FiEdit3 } from 'react-icons/fi';
import { AiOutlineMinusCircle } from 'react-icons/ai';
import { MdClose } from 'react-icons/md';
import { useToast, ToastContainer } from '../../../ui/Toast';
import { useSocket } from '../../../../contexts/SocketContext';
import API_CONFIG from '../../../../config/api';
import { authFetch } from '../../../../utils/apiClient';

const Charts = () => {
  const { socket, isConnected, joinRoom, leaveRoom } = useSocket();
  const [loading, setLoading] = useState(true);
  const [charts, setCharts] = useState([]);
  const [offices, setOffices] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedChartId, setSelectedChartId] = useState(null);
  const [selectedOfficeId, setSelectedOfficeId] = useState('');
  const [officeEmail, setOfficeEmail] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [fullscreenMedia, setFullscreenMedia] = useState(null);
  const fileInputRef = useRef(null);
  const { toasts, removeToast, showSuccess, showError } = useToast();

  // Join Socket.io room
  useEffect(() => {
    if (!socket || !isConnected) return;

    console.log('🔌 Senior Management Charts: Joining admin-seniormanagement room');
    joinRoom('admin-seniormanagement');

    return () => {
      leaveRoom('admin-seniormanagement');
    };
  }, [socket, isConnected]);

  // Fetch offices and charts on component mount
  useEffect(() => {
    fetchOffices();
    fetchCharts();
  }, []);

  const fetchOffices = async () => {
    try {
      const response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/database/office`);
      if (response.ok) {
        const data = await response.json();
        const officeList = Array.isArray(data) ? data : (data.records || []);
        setOffices(officeList);
      } else {
        showError('Error', 'Failed to fetch offices');
      }
    } catch (error) {
      console.error('Error fetching offices:', error);
      showError('Error', 'Failed to fetch offices');
    }
  };

  const fetchCharts = async () => {
    try {
      setLoading(true);
      const response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/database/chart`);
      if (response.ok) {
        const data = await response.json();
        const chartList = Array.isArray(data) ? data : (data.records || []);
        setCharts(chartList);
      } else {
        showError('Error', 'Failed to fetch charts');
      }
    } catch (error) {
      console.error('Error fetching charts:', error);
      showError('Error', 'Failed to fetch charts');
    } finally {
      setLoading(false);
    }
  };

  // Handle office selection change
  const handleOfficeChange = (e) => {
    const officeId = e.target.value;
    setSelectedOfficeId(officeId);
    
    // Find the selected office and populate email
    const selectedOffice = offices.find(o => o._id === officeId);
    if (selectedOffice) {
      setOfficeEmail(selectedOffice.officeEmail || '');
    } else {
      setOfficeEmail('');
    }
  };

  const validateFile = (file) => {
    // Validate file type - Only JPG and PNG
    const allowedTypes = ['image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      showError('Invalid File Type', 'Only JPG and PNG files are allowed');
      return false;
    }

    // Validate file size (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      showError('File Too Large', 'Maximum file size is 10MB');
      return false;
    }

    return true;
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file && validateFile(file)) {
      setUploadFile(file);
    }
  };

  // Drag and drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file && validateFile(file)) {
      setUploadFile(file);
    }
  };

  const handleUploadChart = async () => {
    if (!uploadFile || !selectedOfficeId) {
      showError('Missing Information', 'Please select an office and upload a file');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', uploadFile);

      // Upload file to backend (Cloudinary) with authentication
      const uploadResponse = await authFetch(`${API_CONFIG.getAdminUrl()}/api/charts/upload`, {
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      const uploadData = await uploadResponse.json();

      // Find the selected office
      const selectedOffice = offices.find(o => o._id === selectedOfficeId);

      // Create chart record in database with Cloudinary data
      const chartData = {
        officeId: selectedOfficeId,
        officeName: selectedOffice.officeName,
        image: {
          public_id: uploadData.public_id,
          secure_url: uploadData.secure_url,
          url: uploadData.url,
          resource_type: uploadData.resource_type,
          filename: uploadData.filename,
          originalName: uploadFile.name,
          size: uploadFile.size,
          mimeType: uploadFile.type
        }
      };

      const createResponse = await authFetch(`${API_CONFIG.getAdminUrl()}/api/database/chart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chartData)
      });

      if (createResponse.ok) {
        // Update office email if provided
        if (officeEmail && officeEmail !== selectedOffice.officeEmail) {
          await authFetch(`${API_CONFIG.getAdminUrl()}/api/database/office/${selectedOfficeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ officeEmail })
          });
        }

        showSuccess('Success', 'Chart uploaded successfully');
        setUploadFile(null);
        setSelectedOfficeId('');
        setOfficeEmail('');
        setShowUploadModal(false);
        fetchCharts();
        fetchOffices(); // Refresh offices to get updated email
      } else {
        showError('Error', 'Failed to create chart record');
      }
    } catch (error) {
      console.error('Upload error:', error);
      showError('Upload Failed', error.message || 'Failed to upload chart');
    } finally {
      setUploading(false);
    }
  };

  const handleEditChart = async () => {
    if (!selectedChartId || !selectedOfficeId) {
      showError('Missing Information', 'Please select an office');
      return;
    }

    try {
      setUpdating(true);
      const chartToEdit = charts.find(c => c._id === selectedChartId);

      // If a new file is uploaded, handle file upload first
      let imageData = chartToEdit.image;
      if (uploadFile) {
        // Delete old image from Cloudinary
        if (chartToEdit?.image?.public_id) {
          const publicIdEncoded = encodeURIComponent(chartToEdit.image.public_id);
          await authFetch(`${API_CONFIG.getAdminUrl()}/api/charts/delete/${publicIdEncoded}`, {
            method: 'DELETE'
          });
        }

        // Upload new file
        const formData = new FormData();
        formData.append('file', uploadFile);

        const uploadResponse = await authFetch(`${API_CONFIG.getAdminUrl()}/api/charts/upload`, {
          method: 'POST',
          body: formData
        });

        if (!uploadResponse.ok) {
          throw new Error('Upload failed');
        }

        const uploadData = await uploadResponse.json();
        imageData = {
          public_id: uploadData.public_id,
          secure_url: uploadData.secure_url,
          url: uploadData.url,
          resource_type: uploadData.resource_type,
          filename: uploadData.filename,
          originalName: uploadFile.name,
          size: uploadFile.size,
          mimeType: uploadFile.type
        };
      }

      // Find the selected office
      const selectedOffice = offices.find(o => o._id === selectedOfficeId);

      // Update chart record in database
      const chartData = {
        officeId: selectedOfficeId,
        officeName: selectedOffice.officeName,
        image: imageData
      };

      const updateResponse = await authFetch(`${API_CONFIG.getAdminUrl()}/api/database/chart/${selectedChartId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chartData)
      });

      if (updateResponse.ok) {
        // Update office email if provided and changed
        if (officeEmail && officeEmail !== selectedOffice.officeEmail) {
          await authFetch(`${API_CONFIG.getAdminUrl()}/api/database/office/${selectedOfficeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ officeEmail })
          });
        }

        showSuccess('Success', 'Chart updated successfully');
        setUploadFile(null);
        setSelectedOfficeId('');
        setOfficeEmail('');
        setSelectedChartId(null);
        setShowEditModal(false);
        fetchCharts();
        fetchOffices(); // Refresh offices to get updated email
      } else {
        showError('Error', 'Failed to update chart record');
      }
    } catch (error) {
      console.error('Update error:', error);
      showError('Update Failed', error.message || 'Failed to update chart');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteChart = async () => {
    if (!selectedChartId) return;

    try {
      setDeleting(true);
      const chartToDelete = charts.find(c => c._id === selectedChartId);

      // Delete from Cloudinary first
      if (chartToDelete?.image?.public_id) {
        const publicIdEncoded = encodeURIComponent(chartToDelete.image.public_id);
        await authFetch(`${API_CONFIG.getAdminUrl()}/api/charts/delete/${publicIdEncoded}`, {
          method: 'DELETE'
        });
      }

      // Delete from database
      const response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/database/chart/${selectedChartId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        showSuccess('Success', 'Chart deleted successfully');
        setShowDeleteModal(false);
        setSelectedChartId(null);
        fetchCharts();
      } else {
        showError('Error', 'Failed to delete chart');
      }
    } catch (error) {
      console.error('Delete error:', error);
      showError('Error', 'Failed to delete chart');
    } finally {
      setDeleting(false);
    }
  };

  // Helper function to get media URL
  const getMediaUrl = (chart) => {
    return chart.image?.secure_url || chart.image?.url || `${API_CONFIG.getAdminUrl()}/${chart.image?.path}`;
  };

  const openFullscreen = (chart) => {
    setFullscreenMedia(chart);
  };

  const closeFullscreen = () => {
    setFullscreenMedia(null);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#1F3463]">Office Charts</h1>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="bg-white rounded-xl border border-gray-200 shadow-sm h-64 animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <ToastContainer toasts={toasts} onRemoveToast={removeToast} />

        {/* Grid Container */}
        <div className="bg-white rounded-xl p-6">
          {/* Header */}
        <h1 className="text-2xl font-bold text-[#1F3463] mb-6">Office Charts</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-max">
          {/* Add Content Button - Always First */}
          <div
            onClick={() => setShowUploadModal(true)}
            className="rounded-xl border-2 border-dashed border-[#1F3463] hover:border-[#1F3463] cursor-pointer transition-colors flex flex-col items-center justify-center h-64 bg-white hover:bg-gray-50"
          >
            <FaPlus className="text-4xl text-[#1F3463] mb-3" />
            <p className="text-center font-medium text-[#1F3463]">Add Chart</p>
          </div>

          {/* Chart Items */}
          {charts && charts.length > 0 ? (
            charts.map((chart) => {
              const mediaUrl = getMediaUrl(chart);

              return (
                <div key={chart._id} className="rounded-xl border border-gray-200 shadow-sm overflow-hidden h-64 bg-white hover:shadow-lg transition-shadow relative group">
                  {/* Media Preview - Clickable for fullscreen */}
                  <div onClick={() => openFullscreen(chart)} className="cursor-pointer w-full h-full">
                    {(chart.image?.secure_url || chart.image?.url || chart.image?.path) ? (
                      <img
                        src={mediaUrl}
                        alt={chart.officeName}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          console.error('Failed to load image:', mediaUrl);
                          e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23f3f4f6" width="100" height="100"/%3E%3Ctext x="50" y="50" font-size="12" fill="%239ca3af" text-anchor="middle" dy=".3em"%3EImage not found%3C/text%3E%3C/svg%3E';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                        <span className="text-gray-400 text-sm">No media</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons - Bottom Right */}
                  <div className="absolute bottom-3 right-3 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setSelectedChartId(chart._id);
                        setSelectedOfficeId(chart.officeId);
                        const office = offices.find(o => o._id === chart.officeId);
                        setOfficeEmail(office?.officeEmail || '');
                        setUploadFile(null);
                        setShowEditModal(true);
                      }}
                      className="bg-white rounded-full p-2 shadow-md hover:shadow-lg hover:bg-gray-50 transition-all"
                      title="Edit"
                    >
                      <FiEdit3 className="text-lg text-[#1F3463]" />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedChartId(chart._id);
                        setShowDeleteModal(true);
                      }}
                      className="bg-white rounded-full p-2 shadow-md hover:shadow-lg hover:bg-red-50 transition-all"
                      title="Delete"
                    >
                      <AiOutlineMinusCircle className="text-lg text-red-500" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-500">No charts yet. Click "Add Chart" to create one.</p>
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full">
            {/* Close Button */}
            <button
              onClick={() => {
                setShowUploadModal(false);
                setUploadFile(null);
                setSelectedOfficeId('');
                setOfficeEmail('');
                setIsDragging(false);
              }}
              className="absolute -top-2 -right-2 z-10 w-8 h-8 bg-[#1F3463] border-2 border-white rounded-full flex items-center justify-center text-white hover:bg-opacity-90 transition-colors"
            >
              <MdClose className="w-4 h-4" />
            </button>

            {/* Modal Header */}
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-xl font-bold text-[#1F3463]">Upload Office Chart</h2>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-6 space-y-4">
              {/* Office Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Department/Office
                </label>
                <select
                  value={selectedOfficeId}
                  onChange={handleOfficeChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463]"
                >
                  <option value="">Select an office...</option>
                  {offices.map((office) => (
                    <option key={office._id} value={office._id}>
                      {office.officeName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Office Email Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Email of Department/Office
                </label>
                <input
                  type="email"
                  value={officeEmail}
                  onChange={(e) => setOfficeEmail(e.target.value)}
                  placeholder="office@lvcampusconnect.edu"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463]"
                />
              </div>

              {/* File Upload Area with Drag & Drop */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Chart Image (JPG/PNG only)
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className={`border-2 rounded-xl p-8 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-[#1F3463] bg-blue-50 border-solid'
                      : 'border-black border-dashed hover:bg-gray-50'
                  }`}
                >
                  <FaUpload className={`text-4xl mx-auto mb-4 ${isDragging ? 'text-[#1F3463]' : 'text-black'}`} />
                  <p className="text-sm font-medium text-gray-900 mb-2">
                    {isDragging ? 'Drop file here' : 'Choose a file or drag & drop it here'}
                  </p>
                  <p className="text-xs text-gray-600 mb-3">JPG or PNG, maximum 10MB</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Selected File Display */}
              {uploadFile && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-900">
                    <strong>Selected:</strong> {uploadFile.name}
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    Size: {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 px-6 py-4">
              <button
                onClick={handleUploadChart}
                disabled={uploading || !uploadFile || !selectedOfficeId}
                className="w-full px-4 py-2 bg-[#1F3463] text-white rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? 'Uploading...' : 'Upload Chart'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full">
            {/* Close Button */}
            <button
              onClick={() => {
                setShowEditModal(false);
                setUploadFile(null);
                setSelectedOfficeId('');
                setOfficeEmail('');
                setSelectedChartId(null);
                setIsDragging(false);
              }}
              className="absolute -top-2 -right-2 z-10 w-8 h-8 bg-[#1F3463] border-2 border-white rounded-full flex items-center justify-center text-white hover:bg-opacity-90 transition-colors"
            >
              <MdClose className="w-4 h-4" />
            </button>

            {/* Modal Header */}
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-xl font-bold text-[#1F3463]">Edit Office Chart</h2>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-6 space-y-4">
              {/* Office Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Department/Office
                </label>
                <select
                  value={selectedOfficeId}
                  onChange={handleOfficeChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463]"
                >
                  <option value="">Select an office...</option>
                  {offices.map((office) => (
                    <option key={office._id} value={office._id}>
                      {office.officeName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Office Email Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Email of Department/Office
                </label>
                <input
                  type="email"
                  value={officeEmail}
                  onChange={(e) => setOfficeEmail(e.target.value)}
                  placeholder="office@lvcampusconnect.edu"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463]"
                />
              </div>

              {/* File Upload Area with Drag & Drop */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Chart Image (JPG/PNG only) - Optional
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className={`border-2 rounded-xl p-8 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-[#1F3463] bg-blue-50 border-solid'
                      : 'border-black border-dashed hover:bg-gray-50'
                  }`}
                >
                  <FaUpload className={`text-4xl mx-auto mb-4 ${isDragging ? 'text-[#1F3463]' : 'text-black'}`} />
                  <p className="text-sm font-medium text-gray-900 mb-2">
                    {isDragging ? 'Drop file here' : 'Choose a new file or drag & drop it here'}
                  </p>
                  <p className="text-xs text-gray-600 mb-3">JPG or PNG, maximum 10MB</p>
                  <p className="text-xs text-gray-500">Leave empty to keep current image</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Selected File Display */}
              {uploadFile && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-900">
                    <strong>New File Selected:</strong> {uploadFile.name}
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    Size: {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 px-6 py-4">
              <button
                onClick={handleEditChart}
                disabled={updating || !selectedOfficeId}
                className="w-full px-4 py-2 bg-[#1F3463] text-white rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updating ? 'Updating...' : 'Update Chart'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4">
            <div className="px-6 py-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Delete Chart</h2>
              <p className="text-gray-600 mb-6">Are you sure you want to delete this chart? This action cannot be undone. The file will be removed from both Cloudinary and the database.</p>
            </div>
            <div className="border-t border-gray-200 px-6 py-4 flex space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedChartId(null);
                }}
                disabled={deleting}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteChart}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Modal */}
      {fullscreenMedia && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex flex-col items-center justify-center z-50 transition-opacity duration-300 ease-in-out">
          {/* Close Button - Top Right */}
          <button
            onClick={closeFullscreen}
            className="absolute top-6 right-6 z-[60] w-12 h-12 rounded-full border-2 border-white bg-transparent hover:bg-white hover:bg-opacity-20 flex items-center justify-center text-white transition-all duration-200"
            aria-label="Close fullscreen"
          >
            <MdClose className="w-8 h-8" />
          </button>

          {/* Media Container */}
          <div className="flex items-center justify-center">
            <img
              src={getMediaUrl(fullscreenMedia)}
              alt={fullscreenMedia.officeName || 'Chart'}
              className="max-w-[90vw] max-h-[90vh] object-contain transition-all duration-300 ease-in-out"
              onClick={(e) => e.stopPropagation()}
              onError={(e) => {
                console.error(`Failed to load image: ${getMediaUrl(fullscreenMedia)}`);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default Charts;

