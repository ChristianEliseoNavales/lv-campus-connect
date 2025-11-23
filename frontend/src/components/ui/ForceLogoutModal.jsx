import React from 'react';
import { MdWarning } from 'react-icons/md';

const ForceLogoutModal = ({ isOpen, reason, onLogout }) => {
  if (!isOpen) return null;

  const handleLogout = async () => {
    if (onLogout) {
      await onLogout();
    }
    // Use window.location for navigation since we're outside Router context
    window.location.href = '/login';
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      {/* Overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md">
          {/* Content */}
          <div className="p-4 sm:p-5">
            {/* Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center">
                <MdWarning className="w-8 h-8 text-yellow-600" />
              </div>
            </div>

            {/* Title */}
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 text-center mb-3">
              Session Invalidated
            </h3>

            {/* Reason Message */}
            <p className="text-sm sm:text-base text-gray-700 text-center mb-5">
              {reason || 'Your session has been invalidated. Please log in again to continue.'}
            </p>

            {/* Log In Again Button */}
            <button
              onClick={handleLogout}
              className="w-full px-4 py-2.5 bg-[#1F3463] text-white rounded-lg hover:bg-[#1F3463]/90 transition-colors text-sm sm:text-base font-semibold"
            >
              Log In Again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForceLogoutModal;

