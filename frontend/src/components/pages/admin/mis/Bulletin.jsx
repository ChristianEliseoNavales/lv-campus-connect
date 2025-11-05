import React, { useState, useEffect, useRef } from 'react';
import { FaPlus, FaUpload } from 'react-icons/fa';
import { FiEdit3 } from 'react-icons/fi';
import { AiOutlineMinusCircle } from 'react-icons/ai';
import { MdClose } from 'react-icons/md';
import { useToast, ToastContainer } from '../../../ui/Toast';
import { io } from 'socket.io-client';
import API_CONFIG from '../../../../config/api';
import { authFetch } from '../../../../utils/apiClient';

const Bulletin = () => {
  const [loading, setLoading] = useState(true);
  const [bulletins, setBulletins] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedBulletinId, setSelectedBulletinId] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [socket, setSocket] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fullscreenMedia, setFullscreenMedia] = useState(null);
  const fileInputRef = useRef(null);
  const { toasts, removeToast, showSuccess, showError } = useToast();

  // Initialize Socket.io connection
  useEffect(() => {
    const newSocket = io(API_CONFIG.getAdminUrl());
    setSocket(newSocket);

    // Join admin room for real-time updates
    newSocket.emit('join-room', 'admin-mis');

    return () => {
      newSocket.disconnect();
    };
  }, []);

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

  // Helper function to get media URL
  const getMediaUrl = (bulletin) => {
    return bulletin.image?.secure_url || bulletin.image?.url || `${API_CONFIG.getAdminUrl()}/${bulletin.image?.path}`;
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold text-[#1F3463] tracking-tight">Bulletin</h1>
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
        <h1 className="text-4xl font-bold text-[#1F3463] mb-6 tracking-tight">Bulletin</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-max">
          {/* Add Content Button - Always First */}
          <div
            onClick={() => setShowUploadModal(true)}
            className="rounded-xl border-2 border-dashed border-[#1F3463] hover:border-[#1F3463] cursor-pointer transition-colors flex flex-col items-center justify-center h-64 bg-white hover:bg-gray-50"
          >
            <FaPlus className="text-5xl text-[#1F3463] mb-3" />
            <p className="text-center font-semibold text-base text-[#1F3463]">Add Content</p>
          </div>

          {/* Bulletin Items */}
          {bulletins && bulletins.length > 0 ? (
            bulletins.map((bulletin) => {
              // Check if bulletin is a video
              const isVideo = bulletin.image?.resource_type === 'video' ||
                             (bulletin.image?.mimeType && bulletin.image.mimeType.startsWith('video/'));
              const mediaUrl = bulletin.image?.secure_url || bulletin.image?.url || `${API_CONFIG.getAdminUrl()}/${bulletin.image?.path}`;

              return (
                <div key={bulletin._id} className="rounded-xl border border-gray-200 shadow-sm overflow-hidden h-64 bg-white hover:shadow-lg transition-shadow relative group">
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
                        <span className="text-gray-400 text-sm">No media</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons - Bottom Right */}
                  <div className="absolute bottom-3 right-3 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      className="bg-white rounded-full p-2 shadow-md hover:shadow-lg hover:bg-gray-50 transition-all"
                      title="Edit"
                    >
                      <FiEdit3 className="text-xl text-[#1F3463]" />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedBulletinId(bulletin._id);
                        setShowDeleteModal(true);
                      }}
                      className="bg-white rounded-full p-2 shadow-md hover:shadow-lg hover:bg-red-50 transition-all"
                      title="Delete"
                    >
                      <AiOutlineMinusCircle className="text-xl text-red-500" />
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

      {/* Upload Modal - Rendered outside space-y-6 container to prevent gap */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full">
            {/* Close Button */}
            <button
              onClick={() => {
                setShowUploadModal(false);
                setUploadFile(null);
                setIsDragging(false);
              }}
              className="absolute -top-2 -right-2 z-10 w-8 h-8 bg-[#1F3463] border-2 border-white rounded-full flex items-center justify-center text-white hover:bg-opacity-90 transition-colors"
            >
              <MdClose className="w-4 h-4" />
            </button>

            {/* Modal Header */}
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-2xl font-bold text-gray-900 tracking-wide">Upload Image of Content</h2>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-6">
              {/* File Upload Area with Drag & Drop */}
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
                <FaUpload className={`text-5xl mx-auto mb-4 ${isDragging ? 'text-[#1F3463]' : 'text-black'}`} />
                <p className="text-base font-semibold text-gray-900 mb-2">
                  {isDragging ? 'Drop file here' : 'Choose a file or drag & drop it here'}
                </p>
                <p className="text-sm text-gray-600 mb-3">Maximum of 1 file</p>
                <p className="text-sm text-gray-600">JPEG, PNG, GIF, MP4, and MOV up to 50MB</p>

                {/* Browse Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="w-full mt-4 px-4 py-2 border border-black text-black rounded-full font-semibold text-base hover:bg-black hover:text-white transition-colors"
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
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-base text-blue-900">
                    <strong>Selected:</strong> {uploadFile.name}
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    Size: {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 px-6 py-4">
              <button
                onClick={handleUploadBulletin}
                disabled={uploading || !uploadFile}
                className="w-full px-4 py-2 bg-[#1F3463] text-white rounded-lg font-semibold text-base hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? 'Posting...' : 'Post to Bulletin'}
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
              <h2 className="text-2xl font-bold text-gray-900 mb-2 tracking-wide">Delete Bulletin</h2>
              <p className="text-base text-gray-600 mb-6">Are you sure you want to delete this bulletin? This action cannot be undone. The file will be removed from both Cloudinary and the database.</p>
            </div>
            <div className="border-t border-gray-200 px-6 py-4 flex space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedBulletinId(null);
                }}
                disabled={deleting}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-semibold text-base hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteBulletin}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold text-base hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

