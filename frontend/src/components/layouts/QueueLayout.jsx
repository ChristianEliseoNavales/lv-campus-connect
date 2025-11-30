import React from 'react';
import useIdleDetection from '../../hooks/useIdleDetection';
import IdleModal from '../ui/IdleModal';

const QueueLayout = ({ children, customFooter = null, showKeyboard = false, onToggleKeyboard = null, noScroll = false }) => {
  // Idle detection hook
  const { showIdleModal, countdown, handleStayActive } = useIdleDetection();

  return (
    <div
      className="flex flex-col w-screen h-screen overflow-hidden kiosk-container kiosk-layout font-kiosk-public bg-cover bg-center bg-no-repeat relative"
      style={{
        backgroundImage: 'url(/main.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Light blue-white overlay with 60% opacity */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{ backgroundColor: 'rgba(248, 250, 252, 0.6)' }}
      />
      {/* Header Image - Positioned at absolute top spanning full width */}
      <header className="w-full flex-shrink-0 relative z-10">
        <img
          src="/header.png"
          alt="University Header"
          className="w-full h-auto object-cover object-center"
          style={{
            display: 'block',
            maxHeight: '20vh' // Limit height to preserve space for content
          }}
        />
      </header>

      {/* Main Content - Full width utilization for 16:9 landscape */}
      <main className={`flex-grow px-4 py-4 w-full ${noScroll ? 'overflow-hidden' : 'overflow-auto'} relative z-10`}>
        {children}
      </main>

      {/* Navy Blue Gradient Background at Bottom */}
      <div
        className="absolute bottom-0 left-0 w-full h-16 z-0"
        style={{
          background: 'linear-gradient(to top, #1F3463 0%, rgba(255, 255, 255, 0.0) 90%)'
        }}
      />

      {/* Half-Circle Keyboard Toggle Button - Positioned above gradient */}
      {onToggleKeyboard && (
        <button
          onClick={onToggleKeyboard}
          className={`absolute left-1/2 transform -translate-x-1/2 bottom-0 w-32 h-16 flex flex-col items-center justify-center transition-all duration-150 focus:outline-none focus:ring-4 focus:ring-blue-200 z-20 ${
            showKeyboard
              ? 'bg-yellow-300 text-blue-900 font-bold shadow-md'
              : 'bg-[#1F3463] text-white active:bg-[#1A2E56] active:scale-95'
          }`}
          style={{
            borderTopLeftRadius: '50px',
            borderTopRightRadius: '50px',
            borderBottomLeftRadius: '0',
            borderBottomRightRadius: '0',
            background: showKeyboard
              ? 'linear-gradient(135deg, #fef08a 0%, #fbbf24 100%)'
              : 'linear-gradient(135deg, #1F3463 0%, #1A2E56 100%)'
          }}
          aria-label="Toggle virtual keyboard"
        >
          <svg className="w-7 h-7 mb-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm5.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L10.586 10 8.293 7.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
          <span className="text-xs font-semibold">
            {showKeyboard ? 'Hide' : 'Keyboard'}
          </span>
        </button>
      )}

      {/* Custom Footer - Only if provided */}
      {customFooter && (
        <footer className="relative w-full z-10">
          {customFooter}
        </footer>
      )}

      {/* Idle Modal */}
      <IdleModal
        isOpen={showIdleModal}
        countdown={countdown}
        onStayActive={handleStayActive}
      />
    </div>
  );
};

export default QueueLayout;
