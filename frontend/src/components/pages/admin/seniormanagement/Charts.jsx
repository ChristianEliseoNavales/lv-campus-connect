import React, { useState, useEffect, useRef } from 'react';
import { FaPlus, FaUpload } from 'react-icons/fa';
import { FiEdit3 } from 'react-icons/fi';
import { AiOutlineMinusCircle } from 'react-icons/ai';
import { MdClose } from 'react-icons/md';
import { useToast, ToastContainer, ConfirmModal } from '../../../ui';
import { useSocket } from '../../../../contexts/SocketContext';
import API_CONFIG from '../../../../config/api';
import { authFetch } from '../../../../utils/apiClient';
import { getOptimizedCloudinaryUrl } from '../../../../utils/cloudinary';

const Charts = () => {
  const { socket, isConnected, joinRoom, leaveRoom } = useSocket();
  const [loading, setLoading] = useState(true);
  const [charts, setCharts] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedChartId, setSelectedChartId] = useState(null);
  const [officeName, setOfficeName] = useState('');
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

    joinRoom('admin-seniormanagement');

    return () => {
      leaveRoom('admin-seniormanagement');
    };
  }, [socket, isConnected]);

  // Fetch charts on component mount
  useEffect(() => {
    fetchCharts();
  }, []);

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

  // Generate placeholder image SVG data URI
  const generatePlaceholderImage = (officeName) => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
        <rect fill="#1F3463" width="800" height="600"/>
        <text x="400" y="280" font-family="Arial, sans-serif" font-size="32"
              fill="#FFFFFF" text-anchor="middle" dy=".3em" font-weight="bold">
          ${officeName || 'Office Chart'}
        </text>
        <text x="400" y="320" font-family="Arial, sans-serif" font-size="18"
              fill="#FFE251" text-anchor="middle" dy=".3em">
          Chart Coming Soon
        </text>
      </svg>
    `;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
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
    if (!officeName || !officeName.trim()) {
      showError('Missing Information', 'Please enter a department/office name');
      return;
    }

    try {
      setUploading(true);

      let imageData = null;

      // Upload file if provided
      if (uploadFile) {
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

      // Create chart record in database
      const chartData = {
        officeName: officeName.trim(),
        officeEmail: officeEmail.trim() || null,
        image: imageData
      };

      const createResponse = await authFetch(`${API_CONFIG.getAdminUrl()}/api/database/chart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chartData)
      });

      if (createResponse.ok) {
        showSuccess('Success', 'Chart created successfully');
        setUploadFile(null);
        setOfficeName('');
        setOfficeEmail('');
        setShowUploadModal(false);
        fetchCharts();
      } else {
        const errorData = await createResponse.json();
        showError('Error', errorData.error || 'Failed to create chart record');
      }
    } catch (error) {
      console.error('Upload error:', error);
      showError('Upload Failed', error.message || 'Failed to upload chart');
    } finally {
      setUploading(false);
    }
  };

  const handleEditChart = async () => {
    if (!selectedChartId || !officeName || !officeName.trim()) {
      showError('Missing Information', 'Please enter a department/office name');
      return;
    }

    try {
      setUpdating(true);
      const chartToEdit = charts.find(c => c._id === selectedChartId);

      // If a new file is uploaded, handle file upload first
      let imageData = chartToEdit.image;
      if (uploadFile) {
        // Delete old image from Cloudinary if it exists
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

      // Update chart record in database
      const chartData = {
        officeName: officeName.trim(),
        officeEmail: officeEmail.trim() || null,
        image: imageData
      };

      const updateResponse = await authFetch(`${API_CONFIG.getAdminUrl()}/api/database/chart/${selectedChartId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chartData)
      });

      if (updateResponse.ok) {
        showSuccess('Success', 'Chart updated successfully');
        setUploadFile(null);
        setOfficeName('');
        setOfficeEmail('');
        setSelectedChartId(null);
        setShowEditModal(false);
        fetchCharts();
      } else {
        const errorData = await updateResponse.json();
        showError('Error', errorData.error || 'Failed to update chart record');
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

  // Helper function to get media URL with Cloudinary optimization or placeholder
  const getMediaUrl = (chart) => {
    // If chart has an image, use Cloudinary optimization
    if (chart.image?.secure_url || chart.image?.url) {
      const optimizedUrl = getOptimizedCloudinaryUrl(chart.image);
      if (optimizedUrl) {
        return optimizedUrl;
      }
      // Fallback to direct URL
      return chart.image.secure_url || chart.image.url;
    }
    // Generate placeholder if no image
    return generatePlaceholderImage(chart.officeName);
  };

  const openFullscreen = (chart) => {
    setFullscreenMedia(chart);
  };

  const closeFullscreen = () => {
    setFullscreenMedia(null);
  };

  if (loading) {
    return (
      <div className="space-y-3 sm:space-y-4 md:space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#1F3463] tracking-tight">Office Charts</h1>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="bg-white rounded-lg sm:rounded-xl border border-gray-200 shadow-sm h-40 sm:h-48 md:h-52 animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3 sm:space-y-4 md:space-y-5">
        <ToastContainer toasts={toasts} onRemoveToast={removeToast} />

        {/* Grid Container */}
        <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-5">
          {/* Header */}
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#1F3463] mb-3 sm:mb-4 md:mb-5 tracking-tight">Office Charts</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3 auto-rows-max">
          {/* Add Content Button - Always First */}
          <div
            onClick={() => setShowUploadModal(true)}
            className="rounded-lg sm:rounded-xl border-2 border-dashed border-[#1F3463] hover:border-[#1F3463] cursor-pointer transition-colors flex flex-col items-center justify-center h-40 sm:h-48 md:h-52 bg-white hover:bg-gray-50"
          >
            <FaPlus className="text-3xl sm:text-4xl text-[#1F3463] mb-2 sm:mb-2.5" />
            <p className="text-center font-semibold text-xs sm:text-sm text-[#1F3463]">Add Chart</p>
          </div>

          {/* Chart Items */}
          {charts && charts.length > 0 ? (
            charts.map((chart) => {
              const mediaUrl = getMediaUrl(chart);

              return (
                <div key={chart._id} className="rounded-lg sm:rounded-xl border border-gray-200 shadow-sm overflow-hidden h-40 sm:h-48 md:h-52 bg-white hover:shadow-lg transition-shadow relative group">
                  {/* Media Preview - Clickable for fullscreen */}
                  <div onClick={() => openFullscreen(chart)} className="cursor-pointer w-full h-full">
                    <img
                      src={mediaUrl}
                      alt={chart.officeName}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        console.error('Failed to load image:', mediaUrl);
                        e.target.src = generatePlaceholderImage(chart.officeName);
                      }}
                    />
                  </div>

                  {/* Action Buttons - Bottom Right */}
                  <div className="absolute bottom-2 sm:bottom-2.5 right-2 sm:right-2.5 flex space-x-1 sm:space-x-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setSelectedChartId(chart._id);
                        setOfficeName(chart.officeName || '');
                        setOfficeEmail(chart.officeEmail || '');
                        setUploadFile(null);
                        setShowEditModal(true);
                      }}
                      className="bg-white rounded-full p-1 sm:p-1.5 shadow-md hover:shadow-lg hover:bg-gray-50 transition-all"
                      title="Edit"
                    >
                      <FiEdit3 className="text-base sm:text-lg text-[#1F3463]" />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedChartId(chart._id);
                        setShowDeleteModal(true);
                      }}
                      className="bg-white rounded-full p-1 sm:p-1.5 shadow-md hover:shadow-lg hover:bg-red-50 transition-all"
                      title="Delete"
                    >
                      <AiOutlineMinusCircle className="text-base sm:text-lg text-red-500" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full text-center py-12">
              <p className="text-base text-gray-500">No charts yet. Click "Add Chart" to create one.</p>
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full">
            {/* Close Button */}
            <button
              onClick={() => {
                setShowUploadModal(false);
                setUploadFile(null);
                setOfficeName('');
                setOfficeEmail('');
                setIsDragging(false);
              }}
              className="absolute -top-1.5 -right-1.5 z-10 w-6 h-6 bg-[#1F3463] border-2 border-white rounded-full flex items-center justify-center text-white hover:bg-opacity-90 transition-colors"
            >
              <MdClose className="w-3 h-3" />
            </button>

            {/* Modal Header */}
            <div className="border-b border-gray-200 px-3 sm:px-4 py-2 sm:py-2.5">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 tracking-wide">Upload Office Chart</h2>
            </div>

            {/* Modal Body */}
            <div className="px-3 sm:px-4 py-3 sm:py-4 space-y-4">
              {/* Office Name Input */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                  Department/Office <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={officeName}
                  onChange={(e) => setOfficeName(e.target.value)}
                  placeholder="Enter department/office name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463]"
                />
              </div>

              {/* Office Email Input */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
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
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                  Chart Image (JPG/PNG only) - Optional
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className={`border-2 rounded-lg sm:rounded-xl p-4 sm:p-5 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-[#1F3463] bg-blue-50 border-solid'
                      : 'border-black border-dashed hover:bg-gray-50'
                  }`}
                >
                  <FaUpload className={`text-2xl sm:text-3xl mx-auto mb-2 sm:mb-2.5 ${isDragging ? 'text-[#1F3463]' : 'text-black'}`} />
                  <p className="text-[10px] sm:text-xs font-semibold text-gray-900 mb-1">
                    {isDragging ? 'Drop file here' : 'Choose a file or drag & drop it here'}
                  </p>
                  <p className="text-[9px] sm:text-[10px] text-gray-600 mb-1 sm:mb-2">JPG or PNG, maximum 10MB</p>
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
                <div className="mt-2 sm:mt-2.5 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-[10px] sm:text-xs text-blue-900">
                    <strong>Selected:</strong> {uploadFile.name}
                  </p>
                  <p className="text-[9px] sm:text-[10px] text-blue-700 mt-0.5">
                    Size: {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 px-3 sm:px-4 py-2 sm:py-2.5">
              <button
                onClick={handleUploadChart}
                disabled={uploading || !officeName || !officeName.trim()}
                className="w-full px-2 sm:px-2.5 py-1.5 sm:py-2 bg-[#1F3463] text-white rounded-lg font-semibold text-[10px] sm:text-xs hover:bg-opacity-90 transition-colors disabled:bg-gray-400 disabled:text-gray-600 disabled:cursor-not-allowed disabled:hover:bg-gray-400 disabled:hover:opacity-100"
              >
                {uploading ? 'Creating...' : 'Create Chart'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full">
            {/* Close Button */}
            <button
              onClick={() => {
                setShowEditModal(false);
                setUploadFile(null);
                setOfficeName('');
                setOfficeEmail('');
                setSelectedChartId(null);
                setIsDragging(false);
              }}
              className="absolute -top-1.5 -right-1.5 z-10 w-6 h-6 bg-[#1F3463] border-2 border-white rounded-full flex items-center justify-center text-white hover:bg-opacity-90 transition-colors"
            >
              <MdClose className="w-3 h-3" />
            </button>

            {/* Modal Header */}
            <div className="border-b border-gray-200 px-3 sm:px-4 py-2 sm:py-2.5">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 tracking-wide">Edit Office Chart</h2>
            </div>

            {/* Modal Body */}
            <div className="px-3 sm:px-4 py-3 sm:py-4 space-y-4">
              {/* Office Name Input */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                  Department/Office <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={officeName}
                  onChange={(e) => setOfficeName(e.target.value)}
                  placeholder="Enter department/office name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463]"
                />
              </div>

              {/* Office Email Input */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
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
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                  Chart Image (JPG/PNG only) - Optional
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className={`border-2 rounded-lg sm:rounded-xl p-4 sm:p-5 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-[#1F3463] bg-blue-50 border-solid'
                      : 'border-black border-dashed hover:bg-gray-50'
                  }`}
                >
                  <FaUpload className={`text-2xl sm:text-3xl mx-auto mb-2 sm:mb-2.5 ${isDragging ? 'text-[#1F3463]' : 'text-black'}`} />
                  <p className="text-[10px] sm:text-xs font-semibold text-gray-900 mb-1">
                    {isDragging ? 'Drop file here' : 'Choose a new file or drag & drop it here'}
                  </p>
                  <p className="text-[9px] sm:text-[10px] text-gray-600 mb-1 sm:mb-2">JPG or PNG, maximum 10MB</p>
                  <p className="text-[9px] sm:text-[10px] text-gray-500">Leave empty to keep current image</p>
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
                <div className="mt-2 sm:mt-2.5 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-[10px] sm:text-xs text-blue-900">
                    <strong>New File Selected:</strong> {uploadFile.name}
                  </p>
                  <p className="text-[9px] sm:text-[10px] text-blue-700 mt-0.5">
                    Size: {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 px-3 sm:px-4 py-2 sm:py-2.5">
              <button
                onClick={handleEditChart}
                disabled={updating || !officeName || !officeName.trim()}
                className="w-full px-2 sm:px-2.5 py-1.5 sm:py-2 bg-[#1F3463] text-white rounded-lg font-semibold text-[10px] sm:text-xs hover:bg-opacity-90 transition-colors disabled:bg-gray-400 disabled:text-gray-600 disabled:cursor-not-allowed disabled:hover:bg-gray-400 disabled:hover:opacity-100"
              >
                {updating ? 'Updating...' : 'Update Chart'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <ConfirmModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedChartId(null);
          }}
          onConfirm={handleDeleteChart}
          title="Delete Chart"
          message="Are you sure you want to delete this chart? This action cannot be undone. The file will be removed from both Cloudinary and the database."
          confirmText={deleting ? 'Deleting...' : 'Delete'}
          type="danger"
        />
      )}

      {/* Fullscreen Modal */}
      {fullscreenMedia && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex flex-col items-center justify-center z-50 transition-opacity duration-300 ease-in-out">
          {/* Close Button - Top Right */}
          <button
            onClick={closeFullscreen}
            className="absolute top-5 right-5 z-[60] w-10 h-10 rounded-full border-2 border-white bg-transparent hover:bg-white hover:bg-opacity-20 flex items-center justify-center text-white transition-all duration-200"
            aria-label="Close fullscreen"
          >
            <MdClose className="w-6 h-6" />
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

