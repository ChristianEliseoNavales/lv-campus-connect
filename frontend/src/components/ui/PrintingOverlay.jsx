import React from 'react';
import { motion } from 'framer-motion';

/**
 * PrintingOverlay Component
 *
 * Displays an animated overlay during thermal receipt printing process
 * Uses LVCampusConnect theme colors (#1F3463 navy blue, #FFE251 yellow)
 *
 * Note: This component should be wrapped in AnimatePresence for proper animations
 */
const PrintingOverlay = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60"
      style={{ fontFamily: 'SF Pro Rounded, -apple-system, BlinkMacSystemFont, sans-serif' }}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="bg-white rounded-3xl shadow-2xl p-12 flex flex-col items-center justify-center max-w-md"
      >
        {/* Animated Printer Icon */}
        <div className="relative mb-8">
          {/* Printer Body */}
          <motion.div
            animate={{
              y: [0, -4, 0],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="relative"
          >
            {/* Printer Top */}
            <div className="w-32 h-8 bg-[#1F3463] rounded-t-lg relative">
              {/* Paper slot */}
              <div className="absolute top-1 left-1/2 transform -translate-x-1/2 w-20 h-1 bg-gray-300 rounded"></div>
            </div>
            
            {/* Printer Main Body */}
            <div className="w-32 h-20 bg-[#1F3463] relative">
              {/* Display panel */}
              <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-16 h-4 bg-gray-700 rounded flex items-center justify-center">
                <motion.div
                  animate={{
                    opacity: [0.3, 1, 0.3],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="w-2 h-2 bg-[#FFE251] rounded-full"
                ></motion.div>
              </div>
              
              {/* Button */}
              <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-6 h-6 bg-gray-600 rounded-full"></div>
            </div>
            
            {/* Printer Base */}
            <div className="w-36 h-4 bg-[#1F3463] rounded-b-lg -ml-2"></div>
          </motion.div>

          {/* Animated Paper Coming Out */}
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{
              height: [0, 60, 60],
              opacity: [0, 1, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeOut",
              times: [0, 0.5, 1]
            }}
            className="absolute -bottom-14 left-1/2 transform -translate-x-1/2 w-24 bg-white border-2 border-gray-300 rounded-b-md shadow-lg overflow-hidden"
          >
            {/* Receipt lines */}
            <div className="p-2 space-y-1">
              <div className="h-1 bg-gray-400 rounded w-full"></div>
              <div className="h-1 bg-gray-400 rounded w-3/4"></div>
              <div className="h-1 bg-gray-400 rounded w-full"></div>
              <div className="h-1 bg-gray-400 rounded w-2/3"></div>
            </div>
          </motion.div>
        </div>

        {/* Text Content */}
        <div className="text-center mt-16">
          <motion.h2
            animate={{
              opacity: [1, 0.7, 1],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="text-3xl font-bold text-[#1F3463] mb-3"
          >
            Printing Receipt
          </motion.h2>
          
          <p className="text-lg text-gray-600 mb-4">
            Please wait while your receipt is being printed...
          </p>

          {/* Animated Dots */}
          <div className="flex justify-center space-x-2">
            {[0, 1, 2].map((index) => (
              <motion.div
                key={index}
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  delay: index * 0.2,
                  ease: "easeInOut"
                }}
                className="w-3 h-3 bg-[#FFE251] rounded-full"
              ></motion.div>
            ))}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full mt-8 bg-gray-200 rounded-full h-2 overflow-hidden">
          <motion.div
            animate={{
              width: ["0%", "100%"],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="h-full bg-gradient-to-r from-[#1F3463] to-[#FFE251] rounded-full"
          ></motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default PrintingOverlay;

