import React, { useState, useEffect } from 'react';
import { MdClose } from 'react-icons/md';
import DatePicker from './DatePicker';
import { getPhilippineDate, formatPhilippineDate } from '../../utils/philippineTimezone';

/**
 * DateRangeModal Component
 * 
 * Modal for selecting date range before generating analytical reports
 * Features:
 * - Two date pickers (start date and end date)
 * - Validation to ensure end date is after start date
 * - "Generate Report" button at bottom right
 * - Consistent styling with other modals in the system
 * - Circular navy blue close button with white border
 */
const DateRangeModal = ({ isOpen, onClose, onGenerateReport, userRole }) => {
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [error, setError] = useState('');

  // Reset dates when modal opens
  useEffect(() => {
    if (isOpen) {
      // Both dates empty for consistency (user selects both freely)
      setStartDate(null);
      setEndDate(null);
      setError('');
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Validate date range
  const validateDateRange = () => {
    if (!startDate || !endDate) {
      setError('Please select both start and end dates');
      return false;
    }

    if (startDate > endDate) {
      setError('Start date must be before end date');
      return false;
    }

    setError('');
    return true;
  };

  // Handle generate report
  const handleGenerateReport = () => {
    if (validateDateRange()) {
      onGenerateReport({ startDate, endDate });
    }
  };

  // Handle start date change
  const handleStartDateChange = (date) => {
    setStartDate(date);
    setError('');
  };

  // Handle end date change
  const handleEndDateChange = (date) => {
    setEndDate(date);
    setError('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto">
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div 
          className="relative bg-white rounded-lg shadow-xl w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button - Circular Navy Blue with White Border */}
          <button
            onClick={onClose}
            className="absolute -top-2 -right-2 z-10 w-8 h-8 bg-[#1F3463] border-2 border-white rounded-full flex items-center justify-center text-white hover:bg-opacity-90 transition-colors"
            aria-label="Close"
          >
            <MdClose className="w-4 h-4" />
          </button>

          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-xl font-bold text-[#1F3463]">
              Select Date Range for Report
            </h3>
            <p className="text-sm text-gray-600 mt-2">
              Choose the date range for generating the {userRole} analytical report
            </p>
          </div>
          
          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <DatePicker
                value={startDate}
                onChange={handleStartDateChange}
                placeholder="Select start date"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <DatePicker
                value={endDate}
                onChange={handleEndDateChange}
                placeholder="Select end date"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Date Range Summary */}
            {startDate && endDate && !error && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <span className="font-medium">Selected Range (Philippine Time):</span>{' '}
                  {formatPhilippineDate(startDate, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}{' '}
                  to{' '}
                  {formatPhilippineDate(endDate, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  {Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1} days
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-200 flex justify-end">
            <button
              onClick={handleGenerateReport}
              disabled={!startDate || !endDate}
              className="px-6 py-3 bg-[#1F3463] text-white rounded-lg font-semibold hover:bg-[#152847] transition-colors duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#1F3463]"
            >
              Generate Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DateRangeModal;

