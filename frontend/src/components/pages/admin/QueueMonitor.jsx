import React, { useState, useEffect } from 'react';
import { getPhilippineDate } from '../../../utils/philippineTimezone';

const QueueMonitor = () => {
  // State for real-time date/time display
  const [currentDateTime, setCurrentDateTime] = useState('');

  // Mock data for queue monitoring (prepare for future dynamic integration)
  const [windowsData] = useState([
    { id: 1, name: 'Window 1', serving: 14 },
    { id: 2, name: 'Window 2', serving: 23 },
    { id: 3, name: 'Window 3', serving: 18 },
    { id: 4, name: 'Priority', serving: 1 }
  ]);

  const [nextQueueInfo] = useState({
    nextNumber: 14,
    assignedWindow: 3
  });

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
              className="bg-[#1F3463] text-white rounded-xl flex shadow-lg"
            >
              {/* Left sub-column: Window name */}
              <div className="flex-1 flex items-center justify-center py-6 text-center">
                <span className="text-3xl font-bold">{window.name}</span>
              </div>

              {/* Right sub-column: Serving number */}
              <div className="flex-1 flex items-center justify-center py-6 text-center">
                <span className="text-4xl font-bold">
                  {window.serving.toString().padStart(2, '0')}
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
              {nextQueueInfo.nextNumber.toString().padStart(2, '0')}
            </div>
          </div>

          {/* Second row: Window Assignment */}
          <div className="flex-1 bg-white flex flex-col items-center justify-center">
            <div className="text-xl text-gray-600 mb-2">Please Proceed to</div>
            <div className="text-2xl text-gray-700 mb-3">Window</div>
            <div className="text-6xl font-bold text-[#1F3463]">
              {nextQueueInfo.assignedWindow}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QueueMonitor;
