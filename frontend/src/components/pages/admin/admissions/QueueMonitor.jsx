import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { getPhilippineDate } from '../../../../utils/philippineTimezone';
import API_CONFIG from '../../../../config/api';

const AdmissionsQueueMonitor = () => {
  // State for real-time date/time display
  const [currentDateTime, setCurrentDateTime] = useState('');

  // State for queue monitoring data (fetched from Admissions API)
  const [windowsData, setWindowsData] = useState([]);
  const [nextQueueInfo, setNextQueueInfo] = useState({
    nextNumber: 0,
    assignedWindow: 1
  });

  // Fetch queue monitor data from Admissions API
  const fetchQueueData = async () => {
    try {
      const response = await fetch(`${API_CONFIG.getAdminUrl()}/api/analytics/queue-monitor/admissions`);

      if (!response.ok) {
        throw new Error('Failed to fetch admissions queue data');
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

        console.log('📊 Admissions queue data updated:', result.data);
      }
    } catch (error) {
      console.error('❌ Error fetching admissions queue data:', error);
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

  // Initialize Socket.io connection and fetch initial data
  useEffect(() => {
    const socket = io(API_CONFIG.getAdminUrl());

    // Join admissions admin room for real-time updates
    socket.emit('join-room', 'admin-admissions');

    // Listen for queue updates with specific event type handling
    socket.on('queue-updated', (data) => {
      if (data.department === 'admissions') {
        console.log('📡 Admissions Queue Monitor - Real-time update received:', data);
        
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
            // Refresh to get updated data
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

    // Listen for window status updates (STOP button functionality)
    socket.on('window-status-updated', (data) => {
      if (data.department === 'admissions') {
        console.log('📡 Admissions Queue Monitor - Window status update received:', data);

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
      socket.disconnect();
    };
  }, []);

  return (
    <div className="bg-gray-50 min-h-screen flex items-center justify-center p-8">
      {/* Centered Main Container - 90% of viewport */}
      <div className="w-[95vw] h-[95vh] bg-white grid grid-cols-2 gap-6 p-6" style={{ gridTemplateRows: '1fr 4fr' }}>
        {/* Column 1, Row 1: Window/Serving Headers */}
        <div className="flex">
          {/* Left sub-column: WINDOW header */}
          <div className="flex-1 flex items-center justify-center py-6">
            <h2 className="text-3xl font-bold text-gray-800">WINDOW</h2>
          </div>

          {/* Right sub-column: SERVING header */}
          <div className="flex-1 flex items-center justify-center py-6">
            <h2 className="text-3xl font-bold text-gray-800">SERVING</h2>
          </div>
        </div>

        {/* Column 2, Row 1: Date/Time Display */}
        <div className="flex items-center justify-center p-6">
          <div className="bg-white border-2 border-gray-300 rounded-2xl px-10 py-6 w-full shadow-lg">
            <div className="text-2xl font-semibold text-gray-800 text-center">
              {currentDateTime}
            </div>
          </div>
        </div>

        {/* Column 1, Row 2: Window Queue List */}
        <div className="flex flex-col justify-evenly p-6 space-y-4">
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
                  <span className="bg-red-600 text-white px-3 py-1 rounded-lg text-lg font-bold">
                    CLOSED
                  </span>
                </div>
              )}

              {/* Left sub-column: Window name */}
              <div className="flex-1 flex items-center justify-center py-6 text-center">
                <span className="text-3xl font-bold">{window.name}</span>
              </div>

              {/* Right sub-column: Serving number */}
              <div className="flex-1 flex items-center justify-center py-6 text-center">
                <span className="text-4xl font-bold">
                  {window.serving > 0 ? window.serving.toString().padStart(2, '0') : '--'}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Column 2, Row 2: Next Queue Information */}
        <div className="rounded-2xl shadow-md border-2 border-gray-200 flex flex-col p-6 space-y-4">
          {/* First row: Next Queue Number */}
          <div className="flex-1 bg-white flex flex-col items-center justify-center border-b-2 border-gray-300">
            <div className="text-xl text-gray-600 mb-2">Next</div>
            <div className="text-2xl text-gray-700 mb-3">Queue No.</div>
            <div className="text-6xl font-bold text-[#1F3463]">
              {nextQueueInfo.nextNumber > 0 ? nextQueueInfo.nextNumber.toString().padStart(2, '0') : '--'}
            </div>
          </div>

          {/* Second row: Window Assignment */}
          <div className="flex-1 bg-white flex flex-col items-center justify-center">
            <div className="text-xl text-gray-600 mb-2">Please Proceed to</div>
            <div className="text-2xl text-gray-700 mb-3">Window</div>
            <div className="text-6xl font-bold text-[#1F3463]">
              {nextQueueInfo.assignedWindow || '--'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdmissionsQueueMonitor;
