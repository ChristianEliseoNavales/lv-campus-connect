import React, { useState, useEffect } from 'react';
import { useSocket } from '../../../../contexts/SocketContext';
import { getPhilippineDate } from '../../../../utils/philippineTimezone';
import { authFetch } from '../../../../utils/apiClient';
import API_CONFIG from '../../../../config/api';

const AdmissionsQueueMonitor = () => {
  const { socket, isConnected, joinRoom, leaveRoom, subscribe } = useSocket();

  // State for real-time date/time display
  const [currentDateTime, setCurrentDateTime] = useState('');

  // State for queue monitoring data (fetched from Admissions API)
  const [windowsData, setWindowsData] = useState([]);

  // Fetch queue monitor data from Admissions API
  const fetchQueueData = async () => {
    try {
      const response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/analytics/queue-monitor/admissions`);

      if (!response.ok) {
        throw new Error('Failed to fetch admissions queue data');
      }

      const result = await response.json();

      if (result.success) {
        // Transform API data to include incomingQueues array
        const transformedWindows = result.data.windowData.map((window, index) => ({
          id: index + 1,
          windowId: window.windowId,
          name: window.windowName,
          serving: window.currentServingNumber || 0,
          incomingQueues: window.incomingQueues || [], // All waiting queue numbers
          isServing: window.isServing,
          isOpen: window.isOpen
        }));

        setWindowsData(transformedWindows);

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

  // Join Socket.io room and listen for real-time updates
  useEffect(() => {
    if (!socket || !isConnected) return;

    console.log('🔌 Admissions Queue Monitor: Joining admin-admissions room');
    joinRoom('admin-admissions');

    // Subscribe to queue updates
    const unsubscribeQueue = subscribe('queue-updated', (data) => {
      if (data.department === 'admissions') {
        console.log('📡 Admissions Queue Monitor - Real-time update received:', data);
        // Refresh all data to get updated incoming queues
        fetchQueueData();
      }
    });

    // Subscribe to window status updates
    const unsubscribeWindow = subscribe('window-status-updated', (data) => {
      if (data.department === 'admissions') {
        console.log('📡 Admissions Queue Monitor - Window status update received:', data);
        // Refresh all data to get updated window status
        fetchQueueData();
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
      leaveRoom('admin-admissions');
    };
  }, [socket, isConnected, joinRoom, leaveRoom, subscribe]);

  // Get first 4 windows (for 4 rows)
  const displayWindows = windowsData.slice(0, 4);

  return (
    <div className="h-screen bg-gray-50 p-4 overflow-hidden flex flex-col">
      {/* Header Section - Compact */}
      <div className="mb-3 bg-white rounded-xl shadow-lg p-3 flex-shrink-0">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-[#1F3463] tracking-wide">
              Admissions Office
            </h1>
            <div className="text-sm text-gray-600 font-medium">
              Queue Monitor Display
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold text-gray-800">
              {currentDateTime}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: 3-Column Layout with 4 Rows - Flex to fill remaining space */}
      <div className="flex-1 grid grid-rows-4 gap-2 overflow-hidden">
        {displayWindows.map((window, rowIndex) => {
          // Display all incoming queue numbers - they will dynamically fill the available space
          const displayIncoming = window.incomingQueues || [];

          return (
            <div
              key={window.id}
              className="grid grid-cols-3 gap-3 bg-white rounded-xl shadow-lg p-3"
            >
              {/* Column 1: Window Name and Now Serving */}
              <div
                className={`relative rounded-xl p-3 flex flex-col items-center justify-center ${
                  window.isServing && window.isOpen
                    ? 'bg-gradient-to-br from-[#1F3463] to-[#2a4a7a] text-white'
                    : 'bg-gradient-to-br from-gray-400 to-gray-500 text-gray-100'
                }`}
              >
                {/* Window Name */}
                <div className="text-xl font-bold tracking-wide mb-2 text-center">
                  {window.name}
                </div>

                {/* Now Serving Section - Relative for On Break overlay */}
                <div className="relative w-full flex flex-col items-center">
                  {/* On Break indicator - covers NOW SERVING label and number */}
                  {(!window.isServing || !window.isOpen) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-400 to-gray-500 rounded-lg z-10">
                      <span className="text-3xl font-bold text-gray-100 tracking-wide">On Break</span>
                    </div>
                  )}

                  {/* Now Serving Label */}
                  <div className="text-sm font-semibold mb-1 tracking-wide">
                    NOW SERVING
                  </div>

                  {/* Now Serving Number */}
                  <div className="text-5xl font-bold tracking-wider">
                    {window.serving > 0 ? window.serving.toString().padStart(2, '0') : '--'}
                  </div>
                </div>
              </div>

              {/* Columns 2-3: Incoming Queue Numbers or On Break Message */}
              {window.isServing && window.isOpen ? (
                <div className="col-span-2 flex items-center">
                  <div className="w-full">
                    <div className="text-base font-bold text-gray-700 mb-2 tracking-wide">
                      INCOMING QUEUES
                    </div>
                    <div className="flex gap-2 overflow-hidden">
                      {displayIncoming.length > 0 ? (
                        displayIncoming.map((queueNum, idx) => (
                          <div
                            key={idx}
                            className="bg-[#3930A8] text-white rounded-lg px-3 py-2 shadow-md flex-shrink-0"
                          >
                            <span className="text-2xl font-bold tracking-wide">
                              {queueNum.toString().padStart(2, '0')}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-lg text-gray-400 font-semibold italic">
                          No queues waiting
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="col-span-2 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-500 tracking-wide mb-2">
                      Window is on break
                    </div>
                    <div className="text-lg text-gray-400 font-medium">
                      Will be back shortly
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {windowsData.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center bg-white rounded-xl shadow-lg p-8">
            <div className="text-3xl font-bold text-gray-400 mb-2">No Windows Available</div>
            <div className="text-xl text-gray-500">Waiting for window data...</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdmissionsQueueMonitor;
