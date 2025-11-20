import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { io } from 'socket.io-client';
import API_CONFIG from '../../config/api';

const Home = () => {
  const navigate = useNavigate();
  const [queueData, setQueueData] = useState({
    registrar: { currentNumber: 0, nextNumber: 0, queue: [], windows: [] },
    admissions: { currentNumber: 0, nextNumber: 0, queue: [], windows: [] }
  });
  const [loading, setLoading] = useState(true);
  const [sectionLoading, setSectionLoading] = useState({
    registrar: false,
    admissions: false
  });
  const [socket, setSocket] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Animation variants for staggered effects
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 40, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15,
        duration: 0.5
      }
    }
  };

  const queueDisplayVariants = {
    hidden: { opacity: 0, x: -50 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15,
        duration: 0.6
      }
    }
  };

  const actionButtonVariants = {
    hidden: { opacity: 0, scale: 0.8, y: 30 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 120,
        damping: 12,
        duration: 0.6
      }
    }
  };

  // Initialize Socket.io connection
  useEffect(() => {
    // Use local backend for kiosk pages
    const socketUrl = API_CONFIG.getKioskUrl();
    console.log('🔌 Home page connecting to Socket.io:', socketUrl);

    const newSocket = io(socketUrl);
    setSocket(newSocket);

    // Join kiosk room for real-time updates
    newSocket.emit('join-room', 'kiosk');

    // Listen for real-time updates
    newSocket.on('windows-updated', (data) => {
      if (data.department === 'registrar' || data.department === 'admissions') {
        fetchQueueData(data.department);
      }
    });

    newSocket.on('queue-updated', (data) => {
      if (data.department === 'registrar' || data.department === 'admissions') {
        fetchQueueData(data.department);
      }
    });

    newSocket.on('settings-updated', (data) => {
      if (data.department === 'registrar' || data.department === 'admissions') {
        fetchQueueData(data.department);
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Fetch queue data from API
  const fetchQueueData = async (specificDepartment = null) => {
    const departments = specificDepartment ? [specificDepartment] : ['registrar', 'admissions'];

    try {
      for (const department of departments) {
        // Show section loading for specific department updates
        if (specificDepartment) {
          setSectionLoading(prev => ({ ...prev, [department]: true }));
        }

        const response = await fetch(`${API_CONFIG.getKioskUrl()}/api/public/queue/${department}`);
        const data = await response.json();

        // Ensure windows is always an array
        const windows = Array.isArray(data.windows) ? data.windows : [];

        console.log(`${department} queue data:`, {
          windowsCount: windows.length,
          windows: windows,
          isEnabled: data.isEnabled
        });

        setQueueData(prev => ({
          ...prev,
          [department]: {
            currentNumber: data.currentNumber || 0,
            nextNumber: data.nextNumber || 0,
            queue: data.queue || [],
            windows: windows,
            isEnabled: data.isEnabled
          }
        }));

        // Hide section loading after a brief delay for smooth transition
        if (specificDepartment) {
          setTimeout(() => {
            setSectionLoading(prev => ({ ...prev, [department]: false }));
          }, 500);
        }
      }
    } catch (error) {
      console.error('Error fetching queue data:', error);
      // Use fallback data if API is not available
      if (!specificDepartment) {
        setQueueData({
          registrar: { currentNumber: 5, nextNumber: 6, queue: [], windows: [], isEnabled: true },
          admissions: { currentNumber: 3, nextNumber: 4, queue: [], windows: [], isEnabled: true }
        });
      }
    } finally {
      if (!specificDepartment) {
        setLoading(false);
      }
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchQueueData();
    // Refresh queue data every 30 seconds
    const interval = setInterval(() => fetchQueueData(), 30000);
    return () => clearInterval(interval);
  }, []);

  // Update digital clock every second
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // Skeleton Loading Component - Fixed 4-row layout
  const QueueSkeleton = () => (
    <div className="animate-pulse">
      {/* Window Grid Skeleton - Always 4 rows */}
      <div className="grid grid-cols-2 gap-1.5 h-full">
        {[...Array(4)].map((_, rowIndex) => (
          <React.Fragment key={rowIndex}>
            {/* Window Name Skeleton */}
            <div className="bg-gray-200 rounded-lg border border-gray-300 flex items-center justify-center">
              <div className="bg-gray-300 h-5 w-16 rounded"></div>
            </div>
            {/* Queue Number Skeleton */}
            <div className="bg-gray-200 rounded-lg border border-gray-300 flex items-center justify-center">
              <div className="bg-gray-300 h-6 w-10 rounded"></div>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );

  // Enhanced Queue Display Component
  const EnhancedQueueDisplay = ({ department, title }) => {
    const data = queueData[department];

    return (
      <div className="h-full flex flex-col">
        {/* Office Name Header - Added rounded corners to all four corners */}
        <div className="bg-[#1F3463] text-white text-center py-3 rounded-lg">
          <h3 className="text-2xl font-bold">{title}</h3>
        </div>

        {/* NOW SERVING Section */}
        <div className="text-center py-3">
          <p className="text-xl font-bold" style={{ color: '#1F3463' }}>NOW SERVING</p>
        </div>

        {/* Labels positioned OUTSIDE and ABOVE the grid - Updated for 50/50 split */}
        <div className="mx-3 mb-1.5">
          <div className="grid grid-cols-2 gap-1.5">
            <div className="text-center">
              <span className="font-semibold text-gray-700 text-xs">WINDOW</span>
            </div>
            <div className="text-center">
              <span className="font-semibold text-gray-700 text-xs">QUEUE NO.</span>
            </div>
          </div>
        </div>

        {/* Queue Grid Container */}
        <div className="flex-grow mx-3 mb-3">
          <div className="h-full p-1.5">
            {/* Show skeleton loading when section is updating */}
            {sectionLoading[department] ? (
              <QueueSkeleton />
            ) : data?.isEnabled === false ? (
              /* Office Closed Message */
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-600 mb-1.5">Office Closed</p>
                  <p className="text-xs text-gray-500">Please try again later</p>
                </div>
              </div>
            ) : (
              /* Fixed 4-Row Grid Layout - Always shows exactly 4 rows */
              <div className="grid grid-cols-2 gap-1.5 h-full">
                {[...Array(4)].map((_, rowIndex) => {
                  const window = data?.windows?.[rowIndex];
                  const isRealWindow = window && window.name;
                  const isWindowOpen = window?.isOpen !== false; // Default to true if not specified

                  return (
                    <React.Fragment key={rowIndex}>
                      {/* Window Name */}
                      <div className={`flex items-center justify-center rounded-lg border ${
                        isRealWindow && isWindowOpen
                          ? 'bg-white border-gray-400'
                          : 'bg-gray-100 border-gray-300'
                      }`}>
                        <span className={`text-base font-bold ${
                          isRealWindow && isWindowOpen
                            ? 'text-gray-900'
                            : 'text-gray-500'
                        }`}>
                          {isRealWindow ? window.name : '--'}
                        </span>
                      </div>
                      {/* Queue Number */}
                      <div className={`flex items-center justify-center rounded-lg border ${
                        isRealWindow && isWindowOpen
                          ? 'bg-white border-gray-400'
                          : 'bg-gray-100 border-gray-300'
                      }`}>
                        <span className="text-lg font-bold" style={{
                          color: isRealWindow && isWindowOpen ? '#1F3463' : '#9CA3AF'
                        }}>
                          {loading ? '--' :
                           isRealWindow && isWindowOpen ?
                           String(window.currentQueueNumber || 0).padStart(2, '0') :
                           '--'}
                        </span>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };



  return (
    <motion.div
      className="h-full flex flex-col"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >

      {/* 3-Column Grid Layout */}
      <div className="flex-grow grid grid-cols-3 gap-0 h-full">
        {/* Columns 1-2 Combined (Registrar's and Admissions Office) - Single parent container */}
        <motion.div
          className="col-span-2 px-3"
          variants={queueDisplayVariants}
        >
          {/* White background container wrapping both office sections */}
          <div className="h-full bg-white rounded-lg shadow-xl drop-shadow-lg p-5">
            {/* Grid container for both office sections */}
            <div className="h-full grid grid-cols-2 gap-5">
              {/* Column 1 - Registrar's Office */}
              <div className="h-full">
                <EnhancedQueueDisplay
                  department="registrar"
                  title="Registrar's Office"
                />
              </div>

              {/* Column 2 - Admissions Office */}
              <div className="h-full">
                <EnhancedQueueDisplay
                  department="admissions"
                  title="Admissions Office"
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Column 3 - New Queue/Directory Section */}
        <motion.div
          className="col-span-1 flex flex-col gap-5 pl-5"
          variants={containerVariants}
        >
          {/* Row 1 - FIND OFFICE LOCATIONS */}
          <motion.div
            className="flex-1 bg-[#FFE251] rounded-2xl shadow-xl drop-shadow-lg active:shadow-lg active:scale-95 transition-all duration-150 p-5 cursor-pointer relative overflow-hidden"
            onClick={() => navigate('/map')}
            variants={actionButtonVariants}
          >
            {/* Button text positioned at top-left */}
            <div className="absolute top-5 left-5">
              <h3 className="text-2xl font-bold text-[#1F3463] leading-tight" style={{ textShadow: '1px 1px 2px rgba(255, 255, 255, 0.8)' }}>FIND OFFICE LOCATIONS</h3>
            </div>

            {/* Decorative images */}
            <img
              src="/home/1a.png"
              alt=""
              className="absolute bottom-5 left-5 w-auto h-auto max-w-20 max-h-20"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <img
              src="/home/2a.png"
              alt=""
              className="absolute bottom-5 right-5 w-auto h-auto max-w-20 max-h-20"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <img
              src="/home/3a.png"
              alt=""
              className="absolute top-5 right-5 w-auto h-auto max-w-20 max-h-20"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </motion.div>

          {/* Row 2 - GET A QUEUE NUMBER */}
          <motion.div
            className="flex-1 bg-[#FFE251] rounded-2xl shadow-xl drop-shadow-lg active:shadow-lg active:scale-95 transition-all duration-150 p-5 cursor-pointer relative overflow-hidden"
            onClick={() => navigate('/queue')}
            variants={actionButtonVariants}
          >
            {/* Button text positioned at top-left */}
            <div className="absolute top-5 left-5">
              <h3 className="text-2xl font-bold text-[#1F3463] leading-tight" style={{ textShadow: '1px 1px 2px rgba(255, 255, 255, 0.8)' }}>GET A QUEUE NUMBER</h3>
            </div>

            {/* Decorative images */}
            <img
              src="/home/1b.png"
              alt=""
              className="absolute bottom-5 left-5 w-auto h-auto max-w-20 max-h-20"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <img
              src="/home/2b.png"
              alt=""
              className="absolute bottom-5 right-5 w-auto h-auto max-w-20 max-h-20"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <img
              src="/home/3b.png"
              alt=""
              className="absolute top-5 right-5 w-auto h-auto max-w-20 max-h-20"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default Home;
