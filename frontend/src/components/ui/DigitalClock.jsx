import React, { useState, useEffect } from 'react';

const DigitalClock = () => {
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Format time in 12-hour format
  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Format day of week
  const formatDayOfWeek = (date) => {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  };

  // Format day number
  const formatDayNumber = (date) => {
    return date.getDate().toString().padStart(2, '0');
  };

  // Format month name
  const formatMonth = (date) => {
    return date.toLocaleDateString('en-US', { month: 'long' });
  };

  return (
    <div className="bg-[#1F3463] rounded-lg p-2 flex gap-2 items-center">
      {/* Column 1 - Time (wider column) */}
      <div className="bg-white rounded-lg px-3 py-3 flex-grow">
        <div className="text-xl font-bold text-[#1F3463] text-center">
          {formatTime(currentTime)}
        </div>
      </div>

      {/* Column 2 - Date (narrower column) */}
      <div className="flex flex-col items-center justify-center text-white space-y-0">
        <div className="text-sm font-semibold">
          {formatDayOfWeek(currentTime)}
        </div>
        <div className="text-base font-bold">
          {formatDayNumber(currentTime)}
        </div>
        <div className="text-sm font-semibold">
          {formatMonth(currentTime)}
        </div>
      </div>
    </div>
  );
};

export default DigitalClock;
