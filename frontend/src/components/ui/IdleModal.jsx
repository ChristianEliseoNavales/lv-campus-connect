import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AiOutlineExclamationCircle } from "react-icons/ai";

const IdleModal = ({ isOpen, countdown, onStayActive }) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-100 flex flex-col items-center justify-center font-kiosk-public">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm" />

      {/* Modal Content */}
      <div className="relative bg-white rounded-2xl shadow-3xl drop-shadow-2xl px-3 py-6 mx-3 max-w-md w-full text-center">
        {/* Main Message with Warning Icon */}
        <h2 className="text-xl font-bold text-[#1F3463] mb-5 flex items-center justify-center">
          <AiOutlineExclamationCircle className="text-[#1F3463] mr-1.5" />
          You have been inactive for too long.
        </h2>

        {/* Question */}
        <p className="text-lg text-[#1F3463] mb-5">
          Are you still there?
        </p>

        {/* Countdown Message */}
        <p className="text-lg text-gray-500 mb-1.5">
          Returning to main screen in {countdown}
        </p>
      </div>

      {/* Buttons positioned just below the modal */}
      <div className="relative flex justify-center gap-3 mt-5">
        {/* YES Button */}
        <button
          onClick={onStayActive}
          className="w-20 h-20 text-[#1F3463] font-bold text-lg border-2 border-white rounded-full shadow-lg active:shadow-md drop-shadow-lg active:drop-shadow-sm active:scale-95 transition-all duration-150 focus:outline-none focus:ring-3 focus:ring-blue-200 touch-target-lg"
          style={{ backgroundColor: '#FFE251' }}
          onTouchStart={(e) => e.target.style.backgroundColor = '#E6CB49'}
          onTouchEnd={(e) => e.target.style.backgroundColor = '#FFE251'}
          onMouseDown={(e) => e.target.style.backgroundColor = '#E6CB49'}
          onMouseUp={(e) => e.target.style.backgroundColor = '#FFE251'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#FFE251'}
        >
          YES
        </button>

        {/* HOME Button */}
        <button
          onClick={() => navigate('/home')}
          className="w-20 h-20 text-white font-bold text-lg border-2 border-white rounded-full shadow-lg active:shadow-md drop-shadow-lg active:drop-shadow-sm active:scale-95 transition-all duration-150 focus:outline-none focus:ring-3 focus:ring-blue-200 touch-target-lg"
          style={{ backgroundColor: '#1F3463' }}
          onTouchStart={(e) => e.target.style.backgroundColor = '#1A2E56'}
          onTouchEnd={(e) => e.target.style.backgroundColor = '#1F3463'}
          onMouseDown={(e) => e.target.style.backgroundColor = '#1A2E56'}
          onMouseUp={(e) => e.target.style.backgroundColor = '#1F3463'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#1F3463'}
        >
          HOME
        </button>
      </div>
    </div>
  );
};

export default IdleModal;
