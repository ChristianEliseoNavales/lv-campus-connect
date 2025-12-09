import React from 'react';

// Data Privacy Modal Component
export const DataPrivacyModal = ({ isOpen, onNext, onPrevious, consent, setConsent }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Black background with 80% opacity */}
      <div className="absolute inset-0 bg-black bg-opacity-80" />

      {/* Modal Container - Centered with buttons positioned relative to it */}
      <div className="relative flex items-center">
        {/* Modal Content - Perfectly centered */}
        <div className="bg-white rounded-2xl shadow-3xl drop-shadow-2xl p-8 mx-3 max-w-4xl w-full">
          {/* Modal Header */}
          <h2 className="text-4xl font-bold text-gray-800 mb-6 text-center">
            PRIVACY NOTICE
          </h2>

          {/* Privacy Notice Text */}
          <div className="mb-6 text-gray-700 leading-relaxed">
            <p className="mb-5 text-lg">
              Please be informed that we are collecting your personal information for the purpose of
              recording and monitoring as we follow the Data Privacy Act of 2012. The storage, use,
              and disposal of your personal information will be governed by LVCC's Data Privacy Policies.
            </p>
          </div>

          {/* Consent Checkbox */}
          <div className="mb-8">
            <label className="flex items-center space-x-5 cursor-pointer group">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 h-8 w-8 text-[#1F3463] border-3 border-gray-400 rounded-lg focus:ring-[#1F3463] focus:ring-3 focus:border-[#1F3463] transition-all duration-200 touch-target-lg shadow-lg hover:shadow-xl active:scale-95 cursor-pointer"
                style={{
                  accentColor: '#1F3463'
                }}
              />
              <span className="text-gray-700 leading-relaxed text-lg flex-1 pt-1.5">
                I voluntarily give my consent to LVCC in collecting, processing, recording, using,
                and retaining my personal information for the above-mentioned purpose in accordance
                with this Privacy Notice.
              </span>
            </label>
          </div>
        </div>

        {/* Buttons positioned adjacent to modal's right edge */}
        <div className="absolute left-full ml-3 top-1/2 transform -translate-y-1/2 flex flex-col space-y-3 z-[10000]">
          {/* Next Button (top) */}
          <button
            onClick={onNext}
            disabled={!consent}
            className={`w-20 h-20 rounded-full border-2 border-white font-bold text-xs transition-all duration-150 shadow-lg ${
              consent
                ? 'bg-[#FFE251] text-[#1A2E56] active:shadow-md active:scale-95'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            NEXT
          </button>

          {/* Previous Button (bottom) */}
          <button
            onClick={onPrevious}
            className="w-20 h-20 rounded-full border-2 border-white bg-[#1F3463] text-white font-bold text-xs active:bg-[#1A2E56] transition-all duration-150 shadow-lg active:shadow-md active:scale-95"
          >
            PREVIOUS
          </button>
        </div>
      </div>
    </div>
  );
};

// Confirmation Modal Component
export const ConfirmationModal = ({ isOpen, onYes, onNo }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center font-kiosk-public">
      {/* Black background with 80% opacity */}
      <div className="absolute inset-0 bg-black bg-opacity-80" />

      {/* Modal Container - Centered with buttons positioned below */}
      <div className="relative flex flex-col items-center">
        {/* Modal Content - Perfectly centered */}
        <div className="bg-white rounded-2xl shadow-3xl drop-shadow-2xl p-6 mx-3 max-w-lg w-full">
          {/* Modal Message */}
          <h2 className="text-2xl font-bold text-gray-800 text-center">
            Are you ready to submit your information?
          </h2>
        </div>

        {/* Buttons positioned below modal */}
        <div className="flex space-x-6 mt-6">
          {/* Yes Button */}
          <button
            onClick={onYes}
            className="w-20 h-20 rounded-full border-2 border-white bg-[#FFE251] text-[#1F3463] font-bold text-xs active:bg-[#FFD700] transition-all duration-150 shadow-lg active:shadow-md active:scale-95"
          >
            YES
          </button>

          {/* No Button */}
          <button
            onClick={onNo}
            className="w-20 h-20 rounded-full border-2 border-white bg-[#1F3463] text-white font-bold text-xs active:bg-gray-600 transition-all duration-150 shadow-lg active:shadow-md active:scale-95"
          >
            NO
          </button>
        </div>
      </div>
    </div>
  );
};

// Service Unavailable Modal Component
export const ServiceUnavailableModal = ({ isOpen, onClose, officeName, serviceName }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
      <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-2xl mx-3 text-center relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full border-2 flex items-center justify-center hover:bg-gray-100 transition-colors"
          style={{ borderColor: '#1F3463', color: '#1F3463' }}
        >
          <span className="text-xl font-bold">×</span>
        </button>

        {/* Header */}
        <h2 className="text-3xl font-semibold mb-3" style={{ color: '#1F3463' }}>
          Service Unavailable
        </h2>

        {/* Message */}
        <p className="text-lg text-gray-600 mb-6">
          The "{serviceName}" service is not currently available in the {officeName}.
          <br />
          <br />
          Please check if the office is open or try again later.
        </p>

        {/* OK Button */}
        <button
          onClick={onClose}
          className="w-38 text-white rounded-3xl shadow-lg drop-shadow-md py-3 px-6 active:shadow-md active:scale-95 transition-all duration-150 border-2 border-transparent focus:outline-none focus:ring-3 focus:ring-blue-200"
          style={{ backgroundColor: '#1F3463' }}
          onTouchStart={(e) => e.target.style.backgroundColor = '#1A2E56'}
          onTouchEnd={(e) => e.target.style.backgroundColor = '#1F3463'}
          onMouseDown={(e) => e.target.style.backgroundColor = '#1A2E56'}
          onMouseUp={(e) => e.target.style.backgroundColor = '#1F3463'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#1F3463'}
        >
          <span className="text-lg font-semibold">OK</span>
        </button>
      </div>
    </div>
  );
};

// Office Mismatch Modal Component
export const OfficeMismatchModal = ({ isOpen, onConfirm, onClose, currentOffice, suggestedOffice }) => {
  if (!isOpen || !suggestedOffice) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
      <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-2xl mx-3 text-center">
        {/* Header */}
        <h2 className="text-3xl font-semibold mb-3" style={{ color: '#1F3463' }}>
          You Selected {currentOffice}'s Office
        </h2>

        {/* Subtext */}
        <p className="text-lg text-gray-600 mb-6">
          Please switch to
        </p>

        {/* Suggested Office Button */}
        <button
          onClick={onConfirm}
          className="w-64 text-white rounded-3xl shadow-lg drop-shadow-md p-5 active:shadow-md active:scale-95 transition-all duration-150 border-2 border-transparent focus:outline-none focus:ring-3 focus:ring-blue-200 mb-5"
          style={{ backgroundColor: '#1F3463' }}
          onTouchStart={(e) => e.target.style.backgroundColor = '#1A2E56'}
          onTouchEnd={(e) => e.target.style.backgroundColor = '#1F3463'}
          onMouseDown={(e) => e.target.style.backgroundColor = '#1A2E56'}
          onMouseUp={(e) => e.target.style.backgroundColor = '#1F3463'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#1F3463'}
        >
          <div className="text-center flex flex-col items-center">
            {/* Office Image */}
            <div className="mb-3">
              <img
                src={`/queue/${suggestedOffice.key}.png`}
                alt={`${suggestedOffice.name} Icon`}
                className="w-27 h-27 object-contain rounded-xl mx-auto"
              />
            </div>
            {/* Office Name */}
            <h3 className="text-lg font-semibold text-white">
              {suggestedOffice.name}
            </h3>
          </div>
        </button>

        {/* Close button (optional - user can also click suggested office) */}
        <div>
          <button
            onClick={onClose}
            className="text-gray-500 active:text-gray-700 text-xs underline transition-colors duration-150"
          >
            Continue with current selection
          </button>
        </div>
      </div>
    </div>
  );
};

// Print Error Modal Component
export const PrintErrorModal = ({ isOpen, onClose, message }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Black background with 80% opacity */}
      <div className="absolute inset-0 bg-black bg-opacity-80" />

      {/* Modal Container - Centered */}
      <div className="relative flex flex-col items-center">
        {/* Modal Content */}
        <div className="bg-white rounded-2xl shadow-3xl drop-shadow-2xl p-8 mx-3 max-w-2xl w-full text-center">
          {/* Error Icon */}
          <div className="mb-5">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>

          {/* Error Message */}
          <p className="text-lg font-semibold text-gray-800 mb-6">
            {message}
          </p>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="px-10 py-3 rounded-full border-2 border-white bg-[#1F3463] text-white font-bold text-lg active:bg-[#1A2E56] transition-all duration-150 shadow-lg active:shadow-md active:scale-95"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

// Transaction No. Error Modal Component
export const TransactionNoErrorModal = ({ isOpen, onClose, message }) => {
  if (!isOpen) return null;

  console.log('🔔 [FRONTEND] TransactionNoErrorModal rendering:', { isOpen, message });

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center font-kiosk-public">
      {/* Black background with 80% opacity */}
      <div className="absolute inset-0 bg-black bg-opacity-80" />

      {/* Modal Container - Centered with buttons positioned below */}
      <div className="relative flex flex-col items-center">
        {/* Modal Content - Perfectly centered */}
        <div className="bg-white rounded-2xl shadow-3xl drop-shadow-2xl p-6 mx-3 max-w-lg w-full">
          {/* Modal Message */}
          <h2 className="text-2xl font-bold text-gray-800 text-center">
            {message}
          </h2>
        </div>

        {/* Buttons positioned below modal */}
        <div className="flex space-x-6 mt-6">
          {/* OK Button */}
          <button
            onClick={onClose}
            className="w-20 h-20 rounded-full border-2 border-white bg-[#FFE251] text-[#1F3463] font-bold text-xs active:bg-[#FFD700] transition-all duration-150 shadow-lg active:shadow-md active:scale-95"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};



