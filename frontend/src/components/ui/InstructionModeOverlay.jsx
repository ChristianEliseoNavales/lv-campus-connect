import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Instruction Mode Overlay Component for University Kiosk System
 * 
 * Features:
 * - Full-screen overlay with darkened background
 * - Interactive instruction bubbles positioned near UI elements
 * - Page-specific instructions based on current route
 * - Click anywhere or ESC key to exit
 * - Smooth fade-in/fade-out animations
 * - Prevents interaction with underlying content
 */
const InstructionModeOverlay = ({ isVisible, onClose }) => {
  const location = useLocation();

  // Handle ESC key press to close overlay
  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.key === 'Escape' && isVisible) {
        onClose();
      }
    };

    if (isVisible) {
      document.addEventListener('keydown', handleKeyPress);
      // Prevent scrolling when overlay is active
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyPress);
      document.body.style.overflow = 'unset';
    };
  }, [isVisible, onClose]);

  // Instruction Bubble Component
  const InstructionBubble = ({ 
    position, 
    text, 
    arrowDirection = 'bottom',
    className = '' 
  }) => {
    const getArrowClasses = () => {
      switch (arrowDirection) {
        case 'top':
          return 'before:top-full before:left-1/2 before:transform before:-translate-x-1/2 before:border-t-[#1F3463] before:border-l-transparent before:border-r-transparent before:border-b-transparent';
        case 'bottom':
          return 'before:bottom-full before:left-1/2 before:transform before:-translate-x-1/2 before:border-b-[#1F3463] before:border-l-transparent before:border-r-transparent before:border-t-transparent';
        case 'left':
          return 'before:left-full before:top-1/2 before:transform before:-translate-y-1/2 before:border-l-[#1F3463] before:border-t-transparent before:border-b-transparent before:border-r-transparent';
        case 'right':
          return 'before:right-full before:top-1/2 before:transform before:-translate-y-1/2 before:border-r-[#1F3463] before:border-t-transparent before:border-b-transparent before:border-l-transparent';
        default:
          return '';
      }
    };

    return (
      <div
        className={`
          absolute z-[41]
          bg-[#1F3463] bg-opacity-95
          text-white
          px-6 py-5
          rounded-2xl
          shadow-2xl drop-shadow-2xl
          border-3 border-white border-opacity-50
          max-w-sm
          animate-bounce-in animate-instruction-pulse
          before:content-[''] before:absolute before:w-0 before:h-0 before:border-[12px]
          ${getArrowClasses()}
          ${className}
        `}
        style={position}
      >
        <p className="text-lg font-bold leading-tight tracking-wide">{text}</p>
      </div>
    );
  };

  // Get page-specific instructions
  const getPageInstructions = () => {
    switch (location.pathname) {
      case '/home':
        return [
          {
            id: 'registrar-office',
            position: { top: '20%', left: '24%' },
            text: 'View current queue numbers for Registrar and Admissions services',
            arrowDirection: 'top'
          },
          {
            id: 'find-locations',
            position: { top: '15%', right: '7%' },
            text: 'Tap here to find department or office locations',
            arrowDirection: 'top'
          },
          {
            id: 'get-queue',
            position: { bottom: '15%', right: '7%' },
            text: 'Tap here to get a queue number for services',
            arrowDirection: 'bottom'
          },
          {
            id: 'navigation',
            position: { bottom: '15%', left: '40%', transform: 'translateX(-50%)' },
            text: 'Use these buttons to navigate between different sections',
            arrowDirection: 'top'
          }
        ];
      
      case '/bulletin':
        return [
          {
            id: 'bulletin-content',
            position: { top: '20%', left: '40%', transform: 'translateX(-50%)' },
            text: 'Browse La Verdad\'s latest highlights and achievements!',
            arrowDirection: 'top'
          }
        ];
      
      case '/map':
        return [
          {
            id: 'map-search',
            position: { top: '25%', left: '30%', transform: 'translateX(-50%)' },
            text: 'Click to enter your desired location.',
            arrowDirection: 'bottom'
          },
          {
            id: 'search-button',
            position: { top: '25%', left: '71%', transform: 'translateX(-50%)' },
            text: 'Click to Search.',
            arrowDirection: 'bottom'
          },
          {
            id: 'location-options',
            position: { top: '65%', left: '7%', transform: 'translateX(-50%)' },
            text: 'Click to select a specific department or office you are looking for.',
            arrowDirection: 'top'
          },
          {
            id: 'floor-options',
            position: { top: '68%', left: '40%', transform: 'translateX(-50%)' },
            text: 'Click to select Floor Level.',
            arrowDirection: 'top'
          },
          {
            id: 'map-controls',
            position: { top: '62%', right: '7%' },
            text: 'Use these controls to select PWD friendly routes, zoom-in, zoom-out, and enter full screen of the map',
            arrowDirection: 'top'
          }
        ];
      
      case '/directory':
        return [
          {
            id: 'directory-grid',
            position: { top: '30%', left: '40%', transform: 'translateX(-50%)' },
            text: 'Select office directories and view contact information',
            arrowDirection: 'top'
          }
        ];
      
      case '/queue':
        return [
          {
            id: 'queue-selection',
            position: { top: '30%', left: '40%', transform: 'translateX(-50%)' },
            text: 'Select the office you need to visit to get a queue number',
            arrowDirection: 'top'
          }
        ];
      
      case '/faq':
        return [
          {
            id: 'faq-content',
            position: { top: '40%', right: '40%' },
            text: 'Tap on questions or the plus sign to expand and view the content',
            arrowDirection: 'top'
          }
        ];
      
      default:
        return [
          {
            id: 'general-help',
            position: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
            text: 'Use the navigation buttons to explore the kiosk system',
            arrowDirection: 'bottom'
          }
        ];
    }
  };

  if (!isVisible) return null;

  const instructions = getPageInstructions();

  return (
    <div
      className="fixed inset-0 z-40 bg-black bg-opacity-60 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      {/* Instruction Bubbles */}
      {instructions.map((instruction) => (
        <InstructionBubble
          key={instruction.id}
          position={instruction.position}
          text={instruction.text}
          arrowDirection={instruction.arrowDirection}
        />
      ))}

      {/* Exit Instructions */}
      <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-[41]">
        <div className="bg-white bg-opacity-95 text-[#1F3463] px-10 py-6 rounded-2xl shadow-2xl border-3 border-[#1F3463] animate-slide-up">
          <p className="text-2xl font-bold text-center tracking-wide">
            Tap anywhere to exit instruction mode
          </p>
        </div>
      </div>
    </div>
  );
};

export default InstructionModeOverlay;
