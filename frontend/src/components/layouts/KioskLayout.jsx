import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HiHome } from "react-icons/hi2";
import { BiSolidNotepad } from "react-icons/bi";
import { FaLocationDot } from "react-icons/fa6";
import { FaUserFriends } from "react-icons/fa";
import { MdQueue } from "react-icons/md";
import { TbMessage2Question } from "react-icons/tb";
import useIdleDetection from '../../hooks/useIdleDetection';
import IdleModal from '../ui/IdleModal';
import { DigitalClock, CircularHelpButton, InstructionModeOverlay } from '../ui';

const KioskLayout = ({ children, customFooter = null }) => {
  // Idle detection hook
  const { showIdleModal, countdown, handleStayActive } = useIdleDetection();

  // Instruction mode state
  const [showInstructionMode, setShowInstructionMode] = useState(false);

  // Remove timer-based loading - pages will handle their own loading states
  // This prevents unnecessary loading animations when navigating between pages

  // Handle help button click to activate instruction mode
  const handleHelpButtonClick = () => {
    setShowInstructionMode(true);
  };

  // Handle instruction mode close
  const handleInstructionModeClose = () => {
    setShowInstructionMode(false);
  };



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
            maxHeight: '20vh' // Limit height to preserve space for content and navigation
          }}
        />
      </header>

      {/* Main Content - Full width utilization for 16:9 landscape */}
      <main className="flex-grow px-5 py-5 overflow-auto w-full relative z-10">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="h-full w-full"
        >
          {children}
        </motion.div>
      </main>

      {/* Circular Help Button - Fixed position overlay */}
      <div className="relative z-20 pointer-events-auto">
        <CircularHelpButton onClick={handleHelpButtonClick} />
      </div>

      {/* Bottom Navigation - Fixed positioning with rectangular container */}
      <footer className="relative w-full z-10">
        {customFooter ? (
          customFooter
        ) : (
          <div
            className="relative w-full px-6"
            style={{
              background: 'linear-gradient(to top, #1F3463 0%, rgba(255, 255, 255, 0.0) 70%)'
            }}
          >
            {/* Digital Clock - Positioned to the left of navigation */}
            <div className="absolute left-6 bottom-3 z-10">
              <DigitalClock />
            </div>

            {/* Navigation Container - Centered and anchored to bottom */}
            <div className="flex justify-center">
              <nav className="flex justify-center items-center space-x-4 pt-4 pb-2.5 px-8 w-full max-w-4xl rounded-t-full" style={{ backgroundColor: '#1F3463', borderRight: '5px solid #FFE251', borderLeft: '5px solid #FFE251' }}>
                <NavLink
                  to="/home"
                  className={({ isActive }) =>
                    `w-28 h-20 flex flex-col items-center justify-center px-5 py-3 rounded-full transition-all duration-150 ${
                      isActive
                        ? 'font-bold shadow-md'
                        : 'active:bg-white active:bg-opacity-20 active:scale-95'
                    }`
                  }
                  style={({ isActive }) => ({
                    backgroundColor: isActive ? 'white' : 'transparent',
                    color: isActive ? '#1F3463' : 'white'
                  })}
                >
                  <HiHome className="w-10 h-10" />
                  <span className="mt-0.5 font-bold text-lg">HOME</span>
                </NavLink>

                <NavLink
                  to="/bulletin"
                  className={({ isActive }) =>
                    `w-28 h-20 flex flex-col items-center justify-center px-5 py-3 rounded-full transition-all duration-150 ${
                      isActive
                        ? 'font-bold shadow-md'
                        : 'active:bg-white active:bg-opacity-20 active:scale-95'
                    }`
                  }
                  style={({ isActive }) => ({
                    backgroundColor: isActive ? 'white' : 'transparent',
                    color: isActive ? '#1F3463' : 'white'
                  })}
                >
                  <BiSolidNotepad className="w-10 h-10" />
                  <span className="mt-0.5 font-bold text-base text-center leading-tight">BULLETIN</span>
                </NavLink>

                <NavLink
                  to="/map"
                  className={({ isActive }) =>
                    `w-28 h-20 flex flex-col items-center justify-center px-5 py-3 rounded-full transition-all duration-150 ${
                      isActive
                        ? 'font-bold shadow-md'
                        : 'active:bg-white active:bg-opacity-20 active:scale-95'
                    }`
                  }
                  style={({ isActive }) => ({
                    backgroundColor: isActive ? 'white' : 'transparent',
                    color: isActive ? '#1F3463' : 'white'
                  })}
                >
                  <FaLocationDot className="w-10 h-10" />
                  <span className="mt-0.5 font-bold text-lg">MAP</span>
                </NavLink>

                <NavLink
                  to="/directory"
                  className={({ isActive }) =>
                    `w-28 h-20 flex flex-col items-center justify-center px-5 py-3 rounded-full transition-all duration-150 ${
                      isActive
                        ? 'font-bold shadow-md'
                        : 'active:bg-white active:bg-opacity-20 active:scale-95'
                    }`
                  }
                  style={({ isActive }) => ({
                    backgroundColor: isActive ? 'white' : 'transparent',
                    color: isActive ? '#1F3463' : 'white'
                  })}
                >
                  <FaUserFriends className="w-10 h-10" />
                  <span className="mt-0.5 font-bold text-lg">DIRECTORY</span>
                </NavLink>

                <NavLink
                  to="/queue"
                  className={({ isActive }) =>
                    `w-28 h-20 flex flex-col items-center justify-center px-5 py-3 rounded-full transition-all duration-150 ${
                      isActive
                        ? 'font-bold shadow-md'
                        : 'active:bg-white active:bg-opacity-20 active:scale-95'
                    }`
                  }
                  style={({ isActive }) => ({
                    backgroundColor: isActive ? 'white' : 'transparent',
                    color: isActive ? '#1F3463' : 'white'
                  })}
                >
                  <MdQueue className="w-10 h-10" />
                  <span className="mt-0.5 font-bold text-lg">QUEUE</span>
                </NavLink>

                <NavLink
                  to="/faq"
                  className={({ isActive }) =>
                    `w-28 h-20 flex flex-col items-center justify-center px-5 py-3 rounded-full transition-all duration-150 ${
                      isActive
                        ? 'font-bold shadow-md'
                        : 'active:bg-white active:bg-opacity-20 active:scale-95'
                    }`
                  }
                  style={({ isActive }) => ({
                    backgroundColor: isActive ? 'white' : 'transparent',
                    color: isActive ? '#1F3463' : 'white'
                  })}
                >
                  <TbMessage2Question className="w-10 h-10" />
                  <span className="mt-0.5 font-bold text-lg">FAQ</span>
                </NavLink>
              </nav>
            </div>
          </div>
        )}
      </footer>

      {/* Idle Modal */}
      <IdleModal
        isOpen={showIdleModal}
        countdown={countdown}
        onStayActive={handleStayActive}
      />

      {/* Instruction Mode Overlay */}
      <InstructionModeOverlay
        isVisible={showInstructionMode}
        onClose={handleInstructionModeClose}
      />
    </div>
  );
};

export default KioskLayout;
