import React from 'react';
import { motion } from 'framer-motion';

/**
 * NavigationLoadingOverlay Component
 *
 * Displays an inline animated spinner during page transitions in the kiosk interface
 * Uses LVCampusConnect theme colors (#1F3463 navy blue, #FFE251 yellow)
 * Uses SF Pro Rounded font family
 * Positioned consistently in the center of the main content area
 *
 * Note: This component should be wrapped in AnimatePresence for proper animations
 */
const NavigationLoadingOverlay = () => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.2 }}
      className="h-full w-full flex flex-col items-center justify-center"
      style={{ fontFamily: 'SF Pro Rounded, -apple-system, BlinkMacSystemFont, sans-serif' }}
    >
      {/* Animated Spinner */}
      <motion.div
        animate={{
          rotate: [0, 360],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "linear"
        }}
        className="relative mb-6"
      >
        {/* Outer Ring */}
        <div className="w-20 h-20 rounded-full border-4 border-[#FFE251] border-t-transparent"></div>

        {/* Inner Circle */}
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-[#FFE251] flex items-center justify-center"
        >
          <div className="w-6 h-6 rounded-full bg-[#1F3463]"></div>
        </motion.div>
      </motion.div>

      {/* Loading Text */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="text-center"
      >
        <p className="text-2xl font-semibold text-[#1F3463]">
          Loading
        </p>

        {/* Animated Dots */}
        <div className="flex justify-center space-x-1 mt-2">
          {[0, 1, 2].map((index) => (
            <motion.div
              key={index}
              animate={{
                y: [0, -6, 0],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                delay: index * 0.15,
                ease: "easeInOut"
              }}
              className="w-2 h-2 bg-[#1F3463] rounded-full"
            ></motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default NavigationLoadingOverlay;

