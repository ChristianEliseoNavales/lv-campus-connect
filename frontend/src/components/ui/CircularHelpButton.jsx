import React from 'react';
import { FaQuestion } from 'react-icons/fa';

/**
 * Circular Help Button Component for University Kiosk System
 * 
 * Features:
 * - Fixed positioning in top-right corner of main content area
 * - Navy blue background (#1F3463) with white border and icon
 * - Touch-friendly size (56px diameter) for kiosk interface
 * - High z-index to appear above all other UI elements
 * - Does not affect document flow or layout structure
 * - WCAG compliant color contrast
 * - Touch press animations for user feedback
 */
const CircularHelpButton = ({ onClick, className = '' }) => {
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      // Default behavior: activate instruction mode
      // This will be handled by the parent component (KioskLayout)
      console.log('Help button clicked - instruction mode should activate');
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`
        fixed top-[120px] right-5 z-30
        w-11 h-11
        rounded-full
        border-2 border-white
        flex items-center justify-center
        shadow-lg drop-shadow-md
        active:scale-95 active:shadow-md
        transition-all duration-150
        focus:outline-none focus:ring-3 focus:ring-white focus:ring-opacity-30
        touch-target-lg
        ${className}
      `}
      style={{
        backgroundColor: '#1F3463',
        color: 'white'
      }}
      onTouchStart={(e) => {
        e.target.style.backgroundColor = '#1A2E56';
        e.target.style.transform = 'scale(0.95)';
      }}
      onTouchEnd={(e) => {
        e.target.style.backgroundColor = '#1F3463';
        e.target.style.transform = 'scale(1)';
      }}
      onMouseDown={(e) => {
        e.target.style.backgroundColor = '#1A2E56';
        e.target.style.transform = 'scale(0.95)';
      }}
      onMouseUp={(e) => {
        e.target.style.backgroundColor = '#1F3463';
        e.target.style.transform = 'scale(1)';
      }}
      onMouseLeave={(e) => {
        // Reset state if mouse leaves while pressed
        e.target.style.backgroundColor = '#1F3463';
        e.target.style.transform = 'scale(1)';
      }}
      aria-label="Help - Get assistance or view frequently asked questions"
      title="Help"
    >
      <FaQuestion className="w-5 h-5" />
    </button>
  );
};

export default CircularHelpButton;
