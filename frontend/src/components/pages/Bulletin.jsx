import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { MdClose } from 'react-icons/md';
import { FaPlay, FaPause, FaVolumeUp, FaVolumeMute } from 'react-icons/fa';
import { useSocket } from '../../contexts/SocketContext';
import API_CONFIG from '../../config/api';
import NavigationLoadingOverlay from '../ui/NavigationLoadingOverlay';
import { getOptimizedCloudinaryUrl } from '../../utils/cloudinary';

const Bulletin = () => {
  const [currentPage, setCurrentPage] = useState(0);
  const [bulletins, setBulletins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fullscreenMedia, setFullscreenMedia] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const volumeSliderRef = useRef(null);
  const userPausedRef = useRef(false);
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
    setIsPlaying(true); // Auto-play when opening
    setVolume(1);
    setIsMuted(false);
    setShowControls(true);
    setShowVolumeSlider(false);
    setCurrentTime(0);
    setDuration(0);
    userPausedRef.current = false; // Reset user pause flag
  };

  // Close fullscreen modal
  const closeFullscreen = () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setFullscreenMedia(null);
    setIsPlaying(false);
    setVolume(1);
    setIsMuted(false);
    setShowControls(true);
    setShowVolumeSlider(false);
    setCurrentTime(0);
    setDuration(0);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
  };

  // Video control handlers
  const handlePlayPause = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!videoRef.current) {
      console.error('Video ref is not set');
      return;
    }

    const video = videoRef.current;

    try {
      // Check actual video state instead of React state to avoid sync issues
      if (video.paused) {
        // Video is paused, play it
        userPausedRef.current = false; // User wants to play
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.error('Error playing video:', err);
          });
        }
      } else {
        // Video is playing, pause it
        userPausedRef.current = true; // User manually paused
        video.pause();
      }
    } catch (error) {
      console.error('Error in handlePlayPause:', error);
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      if (newVolume > 0 && isMuted) {
        setIsMuted(false);
      } else if (newVolume === 0) {
        setIsMuted(true);
      }
    }
  };

  const handleVolumeButtonClick = () => {
    setShowVolumeSlider(!showVolumeSlider);
  };

  const handleSeek = (e) => {
    if (videoRef.current) {
      const newTime = parseFloat(e.target.value);
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  // Format time helper
  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle controls visibility timeout
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    setShowControls(true);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  }, [isPlaying]);

  // Video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !fullscreenMedia) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted || video.volume === 0);
    };
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };
    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    // Set initial volume
    video.volume = volume;
    video.muted = isMuted;

    // Auto-play when video loads (only if user hasn't manually paused)
    if (video.paused && !video.ended && !userPausedRef.current) {
      video.play().catch(console.error);
    }

    // Reset controls timeout on mouse move
    const handleMouseMove = () => resetControlsTimeout();
    const container = video.parentElement;
    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('mouseleave', () => {
        // Check actual video state, not React state
        if (!video.paused) {
          setShowControls(false);
        }
      });
    }

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      if (container) {
        container.removeEventListener('mousemove', handleMouseMove);
      }
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [fullscreenMedia, volume, isMuted, resetControlsTimeout]);

  // Close volume slider when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (volumeSliderRef.current && !volumeSliderRef.current.contains(event.target)) {
        // Check if click is not on the volume button
        const volumeButton = event.target.closest('[data-volume-button]');
        if (!volumeButton) {
          setShowVolumeSlider(false);
        }
      }
    };

    if (showVolumeSlider) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showVolumeSlider]);

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
    <>
      {/* Custom styles for video sliders */}
      <style>{`
        /* Playback slider (horizontal) */
        input[type="range"].playback-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 8px;
          margin: 0;
          padding: 0;
        }
        input[type="range"].playback-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #1F3463;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          margin-top: -4px;
          position: relative;
        }
        input[type="range"].playback-slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #1F3463;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          position: relative;
          transform: translateY(-4px);
        }
        input[type="range"].playback-slider::-webkit-slider-runnable-track {
          height: 8px;
          border-radius: 4px;
          width: 100%;
        }
        input[type="range"].playback-slider::-moz-range-track {
          height: 8px;
          border-radius: 4px;
          width: 100%;
        }

        /* Volume slider (vertical) */
        input[type="range"].volume-slider-vertical {
          -webkit-appearance: none;
          appearance: none;
          writing-mode: vertical-lr;
          direction: rtl;
          width: 8px;
          height: 96px;
          margin: 0;
          padding: 0;
        }
        input[type="range"].volume-slider-vertical::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #1F3463;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          margin-left: -4px;
        }
        input[type="range"].volume-slider-vertical::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #1F3463;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        input[type="range"].volume-slider-vertical::-webkit-slider-runnable-track {
          width: 8px;
          border-radius: 4px;
          height: 100%;
        }
        input[type="range"].volume-slider-vertical::-moz-range-track {
          width: 8px;
          border-radius: 4px;
          height: 100%;
        }
      `}</style>
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
            className="flex items-center justify-center relative"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.3 }}
            onMouseMove={resetControlsTimeout}
            onMouseLeave={() => {
              if (isPlaying) {
                setShowControls(false);
              }
            }}
          >
            {isVideo(fullscreenMedia) ? (
              <div className="relative">
                <video
                  ref={videoRef}
                  src={getMediaUrl(fullscreenMedia)}
                  className="max-w-[90vw] max-h-[90vh] object-contain transition-all duration-300 ease-in-out"
                  loop
                  playsInline
                  controlsList="nodownload noplaybackrate nopictureinpicture nofullscreen"
                  disablePictureInPicture
                  onError={(e) => {
                    console.error(`Failed to load video: ${getMediaUrl(fullscreenMedia)}`);
                  }}
                />
                {/* Custom Video Controls */}
                <AnimatePresence>
                  {showControls && (
                    <motion.div
                      className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      transition={{ duration: 0.2 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex flex-col gap-3 max-w-[90vw] mx-auto">
                        {/* Playback Bar (Seek Bar) */}
                        <div className="flex items-center gap-3">
                          <span className="text-white text-xs font-mono min-w-[45px] text-right">
                            {formatTime(currentTime)}
                          </span>
                          <input
                            type="range"
                            min="0"
                            max={duration || 0}
                            step="0.1"
                            value={currentTime}
                            onChange={handleSeek}
                            className="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer playback-slider"
                            style={{
                              background: `linear-gradient(to right, #1F3463 0%, #1F3463 ${duration ? (currentTime / duration) * 100 : 0}%, #4B5563 ${duration ? (currentTime / duration) * 100 : 0}%, #4B5563 100%)`
                            }}
                            aria-label="Seek"
                          />
                          <span className="text-white text-xs font-mono min-w-[45px]">
                            {formatTime(duration)}
                          </span>
                        </div>

                        {/* Control Buttons Row */}
                        <div className="flex items-center justify-between gap-4">
                          {/* Play/Pause Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handlePlayPause(e);
                            }}
                            className="flex items-center justify-center w-10 h-10 rounded-full bg-[#1F3463]/80 hover:bg-[#1F3463] text-white transition-all duration-200 z-10"
                            aria-label={isPlaying ? 'Pause' : 'Play'}
                          >
                            {isPlaying ? (
                              <FaPause className="w-4 h-4" />
                            ) : (
                              <FaPlay className="w-4 h-4 ml-0.5" />
                            )}
                          </button>

                          {/* Volume Control with Vertical Slider */}
                          <div className="relative" ref={volumeSliderRef}>
                            <button
                              data-volume-button
                              onClick={handleVolumeButtonClick}
                              className="flex items-center justify-center w-10 h-10 rounded-full bg-[#1F3463]/80 hover:bg-[#1F3463] text-white transition-all duration-200"
                              aria-label={isMuted ? 'Unmute' : 'Mute'}
                            >
                              {isMuted || volume === 0 ? (
                                <FaVolumeMute className="w-4 h-4" />
                              ) : (
                                <FaVolumeUp className="w-4 h-4" />
                              )}
                            </button>

                            {/* Vertical Volume Slider */}
                            <AnimatePresence>
                              {showVolumeSlider && (
                                <motion.div
                                  className="absolute bottom-full mb-2 bg-black/90 rounded-lg p-3"
                                  initial={{ opacity: 0, scale: 0.8, y: 10 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.8, y: 10 }}
                                  transition={{ duration: 0.2 }}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    left: 'calc(50% - 20px)'
                                  }}
                                >
                                  <div className="flex items-center justify-center" style={{ width: '16px', margin: '0 auto' }}>
                                    <input
                                      type="range"
                                      min="0"
                                      max="1"
                                      step="0.01"
                                      value={isMuted ? 0 : volume}
                                      onChange={handleVolumeChange}
                                      className="h-24 bg-gray-600 rounded-lg appearance-none cursor-pointer volume-slider-vertical"
                                      style={{
                                        background: `linear-gradient(to top, #1F3463 0%, #1F3463 ${(isMuted ? 0 : volume) * 100}%, #4B5563 ${(isMuted ? 0 : volume) * 100}%, #4B5563 100%)`
                                      }}
                                      aria-label="Volume"
                                    />
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
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
    </>
  );
};

export default Bulletin;
