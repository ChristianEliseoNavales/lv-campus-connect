import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { FaPlus, FaUpload } from 'react-icons/fa';
import { AiOutlineMinusCircle } from 'react-icons/ai';
import { MdClose } from 'react-icons/md';
import { ToastContainer, ConfirmModal } from '../../../ui';
import { useNotification } from '../../../../hooks/useNotification';
import { useSocket } from '../../../../contexts/SocketContext';
import API_CONFIG from '../../../../config/api';
import { authFetch } from '../../../../utils/apiClient';
import { getOptimizedCloudinaryUrl } from '../../../../utils/cloudinary';

const Bulletin = () => {
  const { socket, isConnected, joinRoom, leaveRoom } = useSocket();
  const [loading, setLoading] = useState(true);
  const [bulletins, setBulletins] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedBulletinId, setSelectedBulletinId] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [fullscreenMedia, setFullscreenMedia] = useState(null);
  const fileInputRef = useRef(null);
  const { toasts, removeToast, showSuccess, showError } = useNotification();

  // Join Socket.io room
  useEffect(() => {
    if (!socket || !isConnected) return;

    joinRoom('admin-mis');

    return () => {
      leaveRoom('admin-mis');
    };
  }, [socket, isConnected]);

  // Fetch bulletins on component mount
  useEffect(() => {
    fetchBulletins();
  }, []);

  const fetchBulletins = async () => {
    try {
      setLoading(true);
      const response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/database/bulletin`);
      if (response.ok) {
        const data = await response.json();
        // Handle both array response and paginated response
        const bulletinList = Array.isArray(data) ? data : (data.records || []);
        setBulletins(bulletinList);
      } else {
        showError('Error', 'Failed to fetch bulletins');
      }
    } catch (error) {
      console.error('Error fetching bulletins:', error);
      showError('Error', 'Failed to fetch bulletins');
    } finally {
      setLoading(false);
    }
  };

  const validateFile = (file) => {
    // Validate file type - Only formats that can be displayed in browsers
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/quicktime'];
    if (!allowedTypes.includes(file.type)) {
      showError('Invalid File Type', 'Only JPEG, PNG, GIF, MP4, and MOV files are allowed');
      return false;
    }

    // Validate file size (50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      showError('File Too Large', 'Maximum file size is 50MB');
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

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (validateFile(file)) {
        setUploadFile(file);
      }
    }
  };

  const handleUploadBulletin = async () => {
    if (!uploadFile) {
      showError('No File', 'Please select a file to upload');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', uploadFile);

      // Upload file to backend
      const uploadResponse = await authFetch(`${API_CONFIG.getAdminUrl()}/api/bulletin/upload`, {
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      const uploadData = await uploadResponse.json();

      // Create bulletin record in database with Cloudinary data
      const bulletinData = {
        title: uploadFile.name,
        content: uploadFile.name,
        image: {
          // Cloudinary fields
          public_id: uploadData.public_id,
          secure_url: uploadData.secure_url,
          url: uploadData.url,
          resource_type: uploadData.resource_type,
          // Legacy fields for backward compatibility
          filename: uploadData.filename,
          originalName: uploadFile.name,
          size: uploadFile.size,
          mimeType: uploadFile.type
        },
        status: 'published',
        publishedAt: new Date(),
        author: null, // Don't send author as string - let it be null for system bulletins
        authorName: 'System',
        authorEmail: 'system@lvcc.edu'
      };

      const createResponse = await authFetch(`${API_CONFIG.getAdminUrl()}/api/database/bulletin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bulletinData)
      });

      if (createResponse.ok) {
        showSuccess('Success', 'Bulletin posted successfully');
        setUploadFile(null);
        setShowUploadModal(false);
        fetchBulletins();
      } else {
        showError('Error', 'Failed to create bulletin record');
      }
    } catch (error) {
      console.error('Upload error:', error);
      showError('Upload Failed', error.message || 'Failed to upload bulletin');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteBulletin = async () => {
    if (!selectedBulletinId) return;

    try {
      setDeleting(true);
      // Find the bulletin to get its public_id
      const bulletinToDelete = bulletins.find(b => b._id === selectedBulletinId);

      if (bulletinToDelete && bulletinToDelete.image?.public_id) {
        // Delete from Cloudinary first
        const cloudinaryDeleteResponse = await authFetch(
          `${API_CONFIG.getAdminUrl()}/api/bulletin/delete/${encodeURIComponent(bulletinToDelete.image.public_id)}`,
          { method: 'DELETE' }
        );

        if (!cloudinaryDeleteResponse.ok) {
          console.warn('Warning: Failed to delete file from Cloudinary, but continuing with database deletion');
        }
      }

      // Delete from database
      const response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/database/bulletin/${selectedBulletinId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        showSuccess('Success', 'Bulletin deleted successfully');
        setShowDeleteModal(false);
        setSelectedBulletinId(null);
        fetchBulletins();
      } else {
        showError('Error', 'Failed to delete bulletin');
      }
    } catch (error) {
      console.error('Delete error:', error);
      showError('Error', 'Failed to delete bulletin');
    } finally {
      setDeleting(false);
    }
  };

  // Helper function to get media URL with Cloudinary optimization
  const getMediaUrl = (bulletin) => {
    const optimizedUrl = getOptimizedCloudinaryUrl(bulletin.image);
    if (optimizedUrl) {
      return optimizedUrl;
    }
    // Fallback to local image path
    return `${API_CONFIG.getAdminUrl()}/${bulletin.image?.path}`;
  };

  // Helper function to check if media is video
  const isVideo = (bulletin) => {
    const resourceType = bulletin.image?.resource_type;
    const mimeType = bulletin.image?.mimeType;
    return resourceType === 'video' || (mimeType && mimeType.startsWith('video/'));
  };

  // Open fullscreen modal
  const openFullscreen = (bulletin) => {
    setFullscreenMedia(bulletin);
  };

  // Close fullscreen modal
  const closeFullscreen = () => {
    setFullscreenMedia(null);
  };

  if (loading) {
    return (
      <div className="space-y-3 sm:space-y-4 md:space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#1F3463] tracking-tight">Bulletin</h1>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 md:gap-4">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="bg-white rounded-xl sm:rounded-2xl border border-gray-200 shadow-sm h-40 sm:h-48 md:h-52 animate-pulse"></div>
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
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#1F3463] mb-3 sm:mb-4 md:mb-5 tracking-tight">Bulletin</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3 auto-rows-max">
          {/* Add Content Button - Always First */}
          <motion.div
            onClick={() => setShowUploadModal(true)}
            className="rounded-lg sm:rounded-xl border-2 border-dashed border-[#1F3463] hover:border-[#1F3463] cursor-pointer transition-colors flex flex-col items-center justify-center h-40 sm:h-48 md:h-52 bg-white hover:bg-gray-50"
            whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
            whileTap={{ scale: 0.98, transition: { duration: 0.15 } }}
          >
            <FaPlus className="text-3xl sm:text-4xl text-[#1F3463] mb-2 sm:mb-2.5" />
            <p className="text-center font-semibold text-xs sm:text-sm text-[#1F3463]">Add Content</p>
          </motion.div>

          {/* Bulletin Items */}
          {bulletins && bulletins.length > 0 ? (
            bulletins.map((bulletin) => {
              // Check if bulletin is a video
              const isVideo = bulletin.image?.resource_type === 'video' ||
                             (bulletin.image?.mimeType && bulletin.image.mimeType.startsWith('video/'));
              const mediaUrl = bulletin.image?.secure_url || bulletin.image?.url || `${API_CONFIG.getAdminUrl()}/${bulletin.image?.path}`;

              return (
                <div key={bulletin._id} className="rounded-lg sm:rounded-xl border border-gray-200 shadow-sm shadow-[#1F3463]/5 overflow-hidden h-40 sm:h-48 md:h-52 bg-white hover:shadow-xl hover:shadow-[#1F3463]/15 transition-shadow duration-300 relative group">
                  {/* Media Preview - Video or Image - Clickable for fullscreen */}
                  <div onClick={() => openFullscreen(bulletin)} className="cursor-pointer w-full h-full">
                    {(bulletin.image?.secure_url || bulletin.image?.url || bulletin.image?.path) ? (
                      isVideo ? (
                        <video
                          src={mediaUrl}
                          className="w-full h-full object-cover"
                          muted
                          loop
                          autoPlay
                          playsInline
                          onError={(e) => {
                            console.error('Failed to load video:', mediaUrl);
                            e.target.style.display = 'none';
                          }}
                        />
                      ) : (
                        <img
                          src={mediaUrl}
                          alt={bulletin.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23f3f4f6" width="100" height="100"/%3E%3Ctext x="50" y="50" font-size="12" fill="%239ca3af" text-anchor="middle" dy=".3em"%3EImage not found%3C/text%3E%3C/svg%3E';
                          }}
                        />
                      )
                    ) : (
                      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                        <span className="text-gray-400 text-xs">No media</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons - Bottom Right */}
                  <div className="absolute bottom-2 sm:bottom-2.5 right-2 sm:right-2.5 flex space-x-1 sm:space-x-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setSelectedBulletinId(bulletin._id);
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
              <p className="text-base text-gray-500">No bulletins yet. Click "Add Content" to create one.</p>
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Upload Modal - Rendered outside space-y-5 container to prevent gap */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full">
            {/* Close Button */}
            <button
              onClick={() => {
                setShowUploadModal(false);
                setUploadFile(null);
                setIsDragging(false);
              }}
              className="absolute -top-1.5 -right-1.5 z-10 w-6 h-6 bg-[#1F3463] border-2 border-white rounded-full flex items-center justify-center text-white hover:bg-opacity-90 transition-colors"
            >
              <MdClose className="w-3 h-3" />
            </button>

            {/* Modal Header */}
            <div className="border-b border-gray-200 px-3 sm:px-4 py-2 sm:py-2.5">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 tracking-wide">Upload Image of Content</h2>
            </div>

            {/* Modal Body */}
            <div className="px-3 sm:px-4 py-3 sm:py-4">
              {/* File Upload Area with Drag & Drop */}
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
                <p className="text-[9px] sm:text-[10px] text-gray-600 mb-1 sm:mb-2">Maximum of 1 file</p>
                <p className="text-[9px] sm:text-[10px] text-gray-600">JPEG, PNG, GIF, MP4, and MOV up to 50MB</p>

                {/* Browse Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="w-full mt-2 sm:mt-2.5 px-2 sm:px-2.5 py-1 border border-black text-black rounded-full font-semibold text-[10px] sm:text-xs hover:bg-black hover:text-white transition-colors"
                >
                  Browse File
                </button>
              </div>

              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="hidden"
                accept=".jpg,.jpeg,.png,.gif,.mp4,.mov"
              />

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
                onClick={handleUploadBulletin}
                disabled={uploading || !uploadFile}
                className="w-full px-2 sm:px-2.5 py-1.5 sm:py-2 bg-[#1F3463] text-white rounded-lg font-semibold text-[10px] sm:text-xs hover:bg-opacity-90 transition-colors disabled:bg-gray-400 disabled:text-gray-600 disabled:cursor-not-allowed disabled:hover:bg-gray-400 disabled:hover:opacity-100"
              >
                {uploading ? 'Posting...' : 'Post to Bulletin'}
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
            setSelectedBulletinId(null);
          }}
          onConfirm={handleDeleteBulletin}
          title="Delete Bulletin"
          message="Are you sure you want to delete this bulletin? This action cannot be undone. The file will be removed from both Cloudinary and the database."
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
            {isVideo(fullscreenMedia) ? (
              <video
                src={getMediaUrl(fullscreenMedia)}
                className="max-w-[90vw] max-h-[90vh] object-contain transition-all duration-300 ease-in-out"
                controls
                autoPlay
                loop
                onClick={(e) => e.stopPropagation()}
                onError={(e) => {
                  console.error(`Failed to load video: ${getMediaUrl(fullscreenMedia)}`);
                }}
              />
            ) : (
              <img
                src={getMediaUrl(fullscreenMedia)}
                alt={fullscreenMedia.title || 'Bulletin'}
                className="max-w-[90vw] max-h-[90vh] object-contain transition-all duration-300 ease-in-out"
                onClick={(e) => e.stopPropagation()}
                onError={(e) => {
                  console.error(`Failed to load image: ${getMediaUrl(fullscreenMedia)}`);
                }}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default Bulletin;

