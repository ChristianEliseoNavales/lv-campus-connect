import React, { useState, useEffect } from 'react';
import { useSocket } from '../../../../contexts/SocketContext';
import { getPhilippineDate } from '../../../../utils/philippineTimezone';
import API_CONFIG from '../../../../config/api';

const RegistrarQueueMonitor = () => {
  const { socket, isConnected, joinRoom, leaveRoom, subscribe } = useSocket();

  // State for real-time date/time display
  const [currentDateTime, setCurrentDateTime] = useState('');

  // State for queue monitoring data (fetched from Registrar API)
  const [windowsData, setWindowsData] = useState([]);
  const [nextQueueInfo, setNextQueueInfo] = useState({
    nextNumber: 0,
    assignedWindow: 1
  });

  // Fetch queue monitor data from Registrar API
  const fetchQueueData = async () => {
    try {
      const response = await fetch(`${API_CONFIG.getAdminUrl()}/api/analytics/queue-monitor/registrar`);

      if (!response.ok) {
        throw new Error('Failed to fetch registrar queue data');
      }

      const result = await response.json();

      if (result.success) {
        // Transform API data to match original layout structure
        const transformedWindows = result.data.windowData.map((window, index) => ({
          id: index + 1,
          name: window.windowName,
          serving: window.currentServingNumber || 0,
          incoming: window.incomingNumber || 0,
          isServing: window.isServing,
          isOpen: window.isOpen
        }));

        setWindowsData(transformedWindows);

        // Set next queue info based on overall next queue
        if (result.data.nextQueueNumber > 0) {
          // Find which window this queue is assigned to based on incoming numbers
          const assignedWindow = transformedWindows.find(w => w.incoming === result.data.nextQueueNumber);
          setNextQueueInfo({
            nextNumber: result.data.nextQueueNumber,
            assignedWindow: assignedWindow ? assignedWindow.name : 'TBD'
          });
        } else {
          setNextQueueInfo({ nextNumber: 0, assignedWindow: null });
        }

        console.log('📊 Registrar queue data updated:', result.data);
      }
    } catch (error) {
      console.error('❌ Error fetching registrar queue data:', error);
    }
  };

  // Update date/time every second using Philippine timezone
  useEffect(() => {
    const updateDateTime = () => {
      const phDate = getPhilippineDate();

      // Format: "10:00 AM September 2, 2025"
      const timeString = phDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Manila'
      });

      const dateString = phDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'Asia/Manila'
      });

      setCurrentDateTime(`${timeString} ${dateString}`);
    };

    // Initial update
    updateDateTime();

    // Update every second
    const interval = setInterval(updateDateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  // Join Socket.io room and listen for real-time updates
  useEffect(() => {
    if (!socket || !isConnected) return;

    console.log('🔌 Registrar Queue Monitor: Joining admin-registrar room');
    joinRoom('admin-registrar');

    // Subscribe to queue updates
    const unsubscribeQueue = subscribe('queue-updated', (data) => {
      if (data.department === 'registrar') {
        console.log('📡 Registrar Queue Monitor - Real-time update received:', data);

        // Handle specific queue update types
        switch (data.type) {
          case 'next-called':
            // Update the serving number for the specific window
            setWindowsData(prev => prev.map(window => {
              if (window.id === data.windowId || window.name.includes(data.data.windowName)) {
                return {
                  ...window,
                  serving: data.data.queueNumber
                };
              }
              return window;
            }));
            // Refresh to get updated next queue info
            fetchQueueData();
            break;

          case 'queue-recalled':
            // No specific window update needed, just refresh to ensure consistency
            fetchQueueData();
            break;

          case 'previous-recalled':
            // Update the serving number for the specific window
            setWindowsData(prev => prev.map(window => {
              if (window.id === data.windowId) {
                return {
                  ...window,
                  serving: data.data.queueNumber
                };
              }
              return window;
            }));
            // Refresh to get updated next queue info
            fetchQueueData();
            break;

          case 'queue-skipped':
            // Update serving number if next queue was called
            if (data.data.nextQueue) {
              setWindowsData(prev => prev.map(window => {
                if (window.id === data.windowId) {
                  return {
                    ...window,
                    serving: data.data.nextQueue.queueNumber
                  };
                }
                return window;
              }));
            }
            // Refresh to get updated next queue info
            fetchQueueData();
            break;

          case 'queue-transferred':
            // Update serving numbers for both windows
            setWindowsData(prev => prev.map(window => {
              if (window.id === data.data.fromWindowId) {
                return { ...window, serving: 0 };
              }
              if (window.id === data.data.toWindowId) {
                return { ...window, serving: data.data.queueNumber };
              }
              return window;
            }));
            // Refresh to get updated next queue info
            fetchQueueData();
            break;

          case 'queue-added':
          case 'queue-requeued-all':
          default:
            // For other updates, refresh all data
            fetchQueueData();
            break;
        }
      }
    });

    // Subscribe to window status updates
    const unsubscribeWindow = subscribe('window-status-updated', (data) => {
      if (data.department === 'registrar') {
        console.log('📡 Registrar Queue Monitor - Window status update received:', data);

        setWindowsData(prev => prev.map(window => {
          if (window.id === data.windowId || window.name === data.data.windowName) {
            return {
              ...window,
              isServing: data.data.isServing
            };
          }
          return window;
        }));
      }
    });

    // Initial data fetch
    fetchQueueData();

    // Periodic refresh every 30 seconds
    const refreshInterval = setInterval(fetchQueueData, 30000);

    return () => {
      clearInterval(refreshInterval);
      unsubscribeQueue();
      unsubscribeWindow();
      leaveRoom('admin-registrar');
    };
  }, [socket, isConnected]);

  return (
    <div className="bg-gray-50 min-h-screen flex items-center justify-center p-6">
      {/* Centered Main Container - 90% of viewport */}
      <div className="w-[95vw] h-[95vh] bg-white grid grid-cols-2 gap-5 p-5" style={{ gridTemplateRows: '1fr 4fr' }}>
        {/* Column 1, Row 1: Window/Serving Headers */}
        <div className="flex">
          {/* Left sub-column: WINDOW header */}
          <div className="flex-1 flex items-center justify-center py-5">
            <h2 className="text-4xl font-bold text-gray-800 tracking-wide">WINDOW</h2>
          </div>

          {/* Right sub-column: SERVING header */}
          <div className="flex-1 flex items-center justify-center py-5">
            <h2 className="text-4xl font-bold text-gray-800 tracking-wide">SERVING</h2>
          </div>
        </div>

        {/* Column 2, Row 1: Date/Time Display */}
        <div className="flex items-center justify-center p-5">
          <div className="bg-white border-2 border-gray-300 rounded-2xl px-8 py-5 w-full shadow-lg">
            <div className="text-2xl font-bold text-gray-800 text-center tracking-wide">
              {currentDateTime}
            </div>
          </div>
        </div>

        {/* Column 1, Row 2: Window Queue List */}
        <div className="flex flex-col justify-evenly p-5 space-y-3">
          {windowsData.map((window) => (
            <div
              key={window.id}
              className={`relative rounded-xl flex shadow-lg transition-all duration-300 ${
                window.isServing
                  ? 'bg-[#1F3463] text-white'
                  : 'bg-gray-400 text-gray-200'
              }`}
            >
              {/* STOP indicator overlay */}
              {!window.isServing && (
                <div className="absolute inset-0 bg-red-500 bg-opacity-20 rounded-xl flex items-center justify-center">
                  <span className="bg-red-600 text-white px-5 py-2.5 rounded-lg text-xl font-bold tracking-wide">
                    CLOSED
                  </span>
                </div>
              )}

              {/* Left sub-column: Window name */}
              <div className="flex-1 flex items-center justify-center py-5 text-center">
                <span className="text-4xl font-bold tracking-wide">{window.name}</span>
              </div>

              {/* Right sub-column: Serving number */}
              <div className="flex-1 flex items-center justify-center py-5 text-center">
                <span className="text-5xl font-bold tracking-wider">
                  {window.serving > 0 ? window.serving.toString().padStart(2, '0') : '--'}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Column 2, Row 2: Next Queue Information */}
        <div className="rounded-2xl shadow-md border-2 border-gray-200 flex flex-col p-5 space-y-3">
          {/* First row: Next Queue Number */}
          <div className="flex-1 bg-white flex flex-col items-center justify-center border-b-2 border-gray-300">
            <div className="text-xl text-gray-600 mb-1.5 font-semibold">Next</div>
            <div className="text-2xl text-gray-700 mb-3 font-bold">Queue No.</div>
            <div className="text-7xl font-bold text-[#1F3463] tracking-wider">
              {nextQueueInfo.nextNumber > 0 ? nextQueueInfo.nextNumber.toString().padStart(2, '0') : '--'}
            </div>
          </div>

          {/* Second row: Window Assignment */}
          <div className="flex-1 bg-white flex flex-col items-center justify-center">
            <div className="text-xl text-gray-600 mb-1.5 font-semibold">Please Proceed to</div>
            <div className="text-2xl text-gray-700 mb-3 font-bold">Window</div>
            <div className="text-7xl font-bold text-[#1F3463] tracking-wider">
              {nextQueueInfo.assignedWindow || '--'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegistrarQueueMonitor;