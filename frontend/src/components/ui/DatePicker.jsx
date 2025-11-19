import React, { useState, useRef, useEffect } from 'react';
import { HiCalendar, HiChevronLeft, HiChevronRight } from 'react-icons/hi';
import { getPhilippineDate, isDateInFuture, isToday as isPhilippineToday } from '../../utils/philippineTimezone';

const DatePicker = ({ value, onChange, placeholder = "Select date", showAllDates = true }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Helper function to safely convert value to Date object
  const getDateFromValue = (val) => {
    if (!val) return new Date();
    if (val instanceof Date) return val;
    if (typeof val === 'string') {
      const parsed = new Date(val);
      return isNaN(parsed.getTime()) ? new Date() : parsed;
    }
    return new Date();
  };

  const [currentMonth, setCurrentMonth] = useState(getDateFromValue(value));
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Format date for display - handles both Date objects and date strings
  const formatDate = (date) => {
    if (!date) return placeholder;

    // Handle Date objects
    if (date instanceof Date) {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }

    // Handle date strings (from URL state)
    if (typeof date === 'string') {
      // Try to parse the date string
      const parsedDate = new Date(date);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      }
    }

    // Fallback for invalid dates
    return placeholder;
  };

  // Get days in month
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  // Handle date selection
  const handleDateSelect = (date) => {
    // Handle null date (for "All Dates" option)
    if (date === null) {
      onChange(null);
      setIsOpen(false);
      return;
    }

    // Prevent selection of future dates
    if (isDateInFuture(date)) {
      return; // Don't allow future date selection
    }
    onChange(date);
    setIsOpen(false);
  };

  // Navigate months
  const navigateMonth = (direction) => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      newMonth.setMonth(prev.getMonth() + direction);
      return newMonth;
    });
  };

  // Check if date is today (using Philippine timezone)
  const isToday = (date) => {
    if (!date) return false;
    return isPhilippineToday(date);
  };

  // Check if date is selected - handles both Date objects and date strings
  const isSelected = (date) => {
    if (!value || !date) return false;

    // Convert value to Date object if it's a string
    let valueDate = value;
    if (typeof value === 'string') {
      valueDate = new Date(value);
      if (isNaN(valueDate.getTime())) return false;
    }

    // Ensure valueDate is a Date object
    if (!(valueDate instanceof Date)) return false;

    return date.getDate() === valueDate.getDate() &&
           date.getMonth() === valueDate.getMonth() &&
           date.getFullYear() === valueDate.getFullYear();
  };

  const days = getDaysInMonth(currentMonth);
  const monthYear = currentMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-1.5 px-2.5 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent text-xs bg-white hover:bg-gray-50 transition-colors"
      >
        <HiCalendar className="text-gray-400 text-base" />
        <span className="text-gray-700">{formatDate(value)}</span>
      </button>

      {/* Calendar Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-3 min-w-[224px]">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => navigateMonth(-1)}
              className="p-0.5 hover:bg-gray-100 rounded transition-colors"
            >
              <HiChevronLeft className="text-gray-600 text-sm" />
            </button>
            <h3 className="text-xs font-medium text-gray-900">{monthYear}</h3>
            <button
              type="button"
              onClick={() => navigateMonth(1)}
              className="p-0.5 hover:bg-gray-100 rounded transition-colors"
            >
              <HiChevronRight className="text-gray-600 text-sm" />
            </button>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-0.5 mb-1.5">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
              <div key={day} className="text-center text-[10px] font-medium text-gray-500 py-1.5">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-0.5">
            {days.map((date, index) => {
              const isFutureDate = date && isDateInFuture(date);
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => date && !isFutureDate && handleDateSelect(date)}
                  disabled={!date || isFutureDate}
                  className={`
                    h-6 w-6 text-xs rounded transition-colors
                    ${!date ? 'invisible' : ''}
                    ${isFutureDate
                      ? 'text-gray-300 cursor-not-allowed'
                      : isSelected(date)
                      ? 'bg-[#1F3463] text-white'
                      : isToday(date)
                      ? 'bg-blue-100 text-blue-600 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                    }
                  `}
                >
                  {date?.getDate()}
                </button>
              );
            })}
          </div>

          {/* Footer Buttons */}
          <div className="mt-3 pt-2.5 border-t border-gray-200 space-y-1.5">
            <button
              type="button"
              onClick={() => handleDateSelect(getPhilippineDate())}
              className="w-full px-2.5 py-1.5 text-xs text-[#1F3463] hover:bg-[#1F3463]/5 rounded transition-colors"
            >
              Today
            </button>
            {showAllDates && (
              <button
                type="button"
                onClick={() => handleDateSelect(null)}
                className="w-full px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50 rounded transition-colors"
              >
                All Dates
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DatePicker;
