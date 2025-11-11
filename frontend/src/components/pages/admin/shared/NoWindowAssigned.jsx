import React from 'react';
import { MdWarning } from 'react-icons/md';

const NoWindowAssigned = ({ office }) => {
  return (
    <div className="flex items-center justify-center min-h-[600px]">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <div className="w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center">
            <MdWarning className="w-12 h-12 text-yellow-600" />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          No Window Assigned
        </h2>
        
        <p className="text-lg text-gray-600 mb-6">
          You have not been assigned to any window yet. Please contact the head of the {office} office to request window assignment.
        </p>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Once you are assigned to a window, you will be able to access the queue management interface for that window.
          </p>
        </div>
      </div>
    </div>
  );
};

export default NoWindowAssigned;

