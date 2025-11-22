import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { MdClose } from 'react-icons/md';
import { useSocket } from '../../contexts/SocketContext';
import API_CONFIG from '../../config/api';
import NavigationLoadingOverlay from '../ui/NavigationLoadingOverlay';
import { getOptimizedCloudinaryUrl } from '../../utils/cloudinary';

const Bulletin = () => {
  const [currentPage, setCurrentPage] = useState(0);
  const [bulletins, setBulletins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fullscreenMedia, setFullscreenMedia] = useState(null);
  const { socket, isConnected, joinRoom, leaveRoom, subscribe } = useSocket();

  // Animation variants for staggered effects
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1
      }
    }
  };

  const bulletinItemVariants = {
    hidden: { opacity: 0, scale: 0.85, y: 40 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15,
        duration: 0.6
      }
    }
  };

  const paginationVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15,
        delay: 0.4
      }
    }
  };

  // Fetch bulletins from API
  const fetchBulletins = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_CONFIG.getKioskUrl()}/api/public/bulletin`);
      if (response.ok) {
        const data = await response.json();
        const bulletinList = Array.isArray(data) ? data : (data.records || []);
        setBulletins(bulletinList);
      } else {
        console.error('Failed to fetch bulletins');
      }
    } catch (error) {
      console.error('Error fetching bulletins:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch initial bulletins on mount
  useEffect(() => {
    fetchBulletins();
  }, []);

  // Join Socket.io room and listen for real-time updates
  useEffect(() => {
    if (!socket || !isConnected) return;

    console.log('🔌 Bulletin page: Joining kiosk room');
    joinRoom('kiosk');

    // Subscribe to bulletin updates
    const unsubscribe = subscribe('bulletin-updated', (data) => {
      console.log('📡 Bulletin update received:', data);

      if (data.type === 'bulletin-created') {
        // Add new bulletin to the list
        setBulletins(prev => [...prev, data.data]);
      } else if (data.type === 'bulletin-deleted') {
        // Remove deleted bulletin from the list
        setBulletins(prev => prev.filter(b => b._id !== data.data.id));
      } else if (data.type === 'bulletin-updated') {
        // Update existing bulletin
        setBulletins(prev => prev.map(b => b._id === data.data._id ? data.data : b));
      }
    });

    return () => {
      unsubscribe();
      leaveRoom('kiosk');
    };
  }, [socket, isConnected, joinRoom, leaveRoom, subscribe]);

  // Paginate bulletins into groups of 3
  const itemsPerPage = 3;
  const bulletinPages = [];
  for (let i = 0; i < bulletins.length; i += itemsPerPage) {
    bulletinPages.push({
      page: Math.floor(i / itemsPerPage) + 1,
      items: bulletins.slice(i, i + itemsPerPage)
    });
  }

  const totalPages = bulletinPages.length;
  const currentPageData = bulletinPages[currentPage] || { page: 1, items: [] };

  // Navigation handlers
  const goToNextPage = () => {
    setCurrentPage((prev) => (prev + 1) % totalPages);
  };

  const goToPrevPage = () => {
    setCurrentPage((prev) => (prev - 1 + totalPages) % totalPages);
  };

  const goToPage = (pageIndex) => {
    setCurrentPage(pageIndex);
  };

  // Helper function to get media URL with Cloudinary optimization
  const getMediaUrl = (bulletin) => {
    const optimizedUrl = getOptimizedCloudinaryUrl(bulletin.image);
    if (optimizedUrl) {
      return optimizedUrl;
    }
    // Fallback to local image path
    return `${API_CONFIG.getKioskUrl()}/${bulletin.image?.path}`;
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

  // Button styling helper
  const getButtonStyles = (isDisabled) => {
    return {
      className: `w-12 h-12 rounded-full flex items-center justify-center transition-all duration-150 ${
        isDisabled
          ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-md'
          : 'bg-white text-[#1F3463] active:bg-[#1F3463] active:text-white active:scale-95 shadow-lg active:shadow-md drop-shadow-md'
      }`,
      style: isDisabled ? {} : {}
    };
  };

  const isPrevDisabled = currentPage === 0;
  const isNextDisabled = currentPage === totalPages - 1;

  // Loading state - Show NavigationLoadingOverlay with consistent container
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <NavigationLoadingOverlay />
      </div>
    );
  }

  // Empty state
  if (bulletins.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-xl text-gray-500">No bulletins available</div>
      </div>
    );
  }

  return (
    <motion.div
      className="h-full flex flex-col"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Main Content Area - 3-Column Grid Layout */}
      <div className="flex-grow flex items-center justify-center px-16">
        <motion.div
          className="w-full max-w-7xl mx-auto"
          variants={containerVariants}
        >
          {/* Dynamic Container: Flex for centering when < 3 items, Grid for 3 items */}
          {currentPageData.items.length < 3 ? (
            // Flex container for centering 1-2 items
            <div className="flex justify-center items-center gap-6 h-full">
              {currentPageData.items.map((bulletin, index) => (
                <motion.div
                  key={bulletin._id}
                  className="flex items-center justify-center"
                  style={{ width: 'calc((100% - 48px) / 3)' }} // Match grid column width (80% of 64px = 51.2px ≈ 48px)
                  onClick={() => openFullscreen(bulletin)}
                  variants={bulletinItemVariants}
                  custom={index}
                >
                  {/* Media Container with square aspect ratio and cursor pointer */}
                  <div className="w-full aspect-square bg-transparent rounded-lg overflow-hidden shadow-xl drop-shadow-lg cursor-pointer hover:shadow-2xl transition-shadow">
                    {isVideo(bulletin) ? (
                      <video
                        src={getMediaUrl(bulletin)}
                        className="w-full h-full object-cover"
                        muted
                        loop
                        autoPlay
                        playsInline
                        onError={(e) => {
                          console.error(`Failed to load video: ${getMediaUrl(bulletin)}`);
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <img
                        src={getMediaUrl(bulletin)}
                        alt={bulletin.title || 'Bulletin'}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          console.error(`Failed to load image: ${getMediaUrl(bulletin)}`);
                          e.target.style.display = 'none';
                        }}
                      />
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            // Grid container for 3 items
            <div className="grid grid-cols-3 gap-6 h-full">
              {currentPageData.items.map((bulletin, index) => (
                <motion.div
                  key={bulletin._id}
                  className="flex items-center justify-center"
                  onClick={() => openFullscreen(bulletin)}
                  variants={bulletinItemVariants}
                  custom={index}
                >
                  {/* Media Container with square aspect ratio and cursor pointer */}
                  <div className="w-full aspect-square bg-transparent rounded-lg overflow-hidden shadow-xl drop-shadow-lg cursor-pointer hover:shadow-2xl transition-shadow">
                    {isVideo(bulletin) ? (
                      <video
                        src={getMediaUrl(bulletin)}
                        className="w-full h-full object-cover"
                        muted
                        loop
                        autoPlay
                        playsInline
                        onError={(e) => {
                          console.error(`Failed to load video: ${getMediaUrl(bulletin)}`);
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <img
                        src={getMediaUrl(bulletin)}
                        alt={bulletin.title || 'Bulletin'}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          console.error(`Failed to load image: ${getMediaUrl(bulletin)}`);
                          e.target.style.display = 'none';
                        }}
                      />
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Pagination Controls - Same pattern as Directory page */}
      {totalPages > 1 && (
        <motion.div
          className="flex justify-center items-center mt-6 mb-3"
          variants={paginationVariants}
        >
          {/* Previous Button - Always visible with disabled state */}
          <button
            onClick={isPrevDisabled ? undefined : goToPrevPage}
            disabled={isPrevDisabled}
            className={`mr-6 ${getButtonStyles(isPrevDisabled).className}`}
            style={getButtonStyles(isPrevDisabled).style}
            aria-label="Previous page"
          >
            <ChevronLeftIcon className="w-6 h-6" />
          </button>

          {/* Page Indicator Dots */}
          <div className="flex items-center space-x-2.5 mx-6">
            {Array.from({ length: totalPages }, (_, index) => (
              <button
                key={index}
                onClick={() => goToPage(index)}
                className={`w-3 h-3 rounded-full transition-all duration-150 ${
                  index === currentPage
                    ? 'bg-blue-600'
                    : 'bg-gray-300 active:bg-gray-400 active:scale-95'
                }`}
                style={index === currentPage ? { backgroundColor: '#1F3463' } : {}}
                aria-label={`Go to page ${index + 1}`}
              />
            ))}
          </div>

          {/* Next Button - Always visible with disabled state */}
          <button
            onClick={isNextDisabled ? undefined : goToNextPage}
            disabled={isNextDisabled}
            className={`ml-6 ${getButtonStyles(isNextDisabled).className}`}
            style={getButtonStyles(isNextDisabled).style}
            aria-label="Next page"
          >
            <ChevronRightIcon className="w-6 h-6" />
          </button>
        </motion.div>
      )}

      {/* Fullscreen Modal with Animations */}
      <AnimatePresence>
        {fullscreenMedia && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-90 flex flex-col items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
          {/* Close Button - Top Right */}
          <button
            onClick={closeFullscreen}
            className="absolute top-5 right-5 z-[60] w-10 h-10 rounded-full border-2 border-white bg-transparent hover:bg-white hover:bg-opacity-20 flex items-center justify-center text-white transition-all duration-200"
            aria-label="Close fullscreen"
          >
            <MdClose className="w-6 h-6" />
          </button>

          {/* Media Container with Scale Animation */}
          <motion.div
            className="flex items-center justify-center"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
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
          </motion.div>
        </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Bulletin;
