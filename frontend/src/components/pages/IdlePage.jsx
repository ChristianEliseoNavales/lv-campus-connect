import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSocket } from '../../contexts/SocketContext';
import useIdleDetection from '../../hooks/useIdleDetection';
import API_CONFIG from '../../config/api';

const IdlePage = () => {
  const { socket, isConnected, joinRoom, leaveRoom, subscribe } = useSocket();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [bulletins, setBulletins] = useState([]);
  const { handleReturnFromIdle } = useIdleDetection();

  // Fetch bulletins from API
  const fetchBulletins = async () => {
    try {
      const response = await fetch(`${API_CONFIG.getKioskUrl()}/api/public/bulletin`);
      if (response.ok) {
        const data = await response.json();
        const bulletinList = Array.isArray(data) ? data : (data.records || []);
        // Filter to only include images (not videos)
        const imageBulletins = bulletinList.filter(bulletin => {
          const resourceType = bulletin.image?.resource_type;
          const mimeType = bulletin.image?.mimeType;
          return resourceType === 'image' || (mimeType && mimeType.startsWith('image/'));
        });
        setBulletins(imageBulletins);
      } else {
        console.error('Failed to fetch bulletins');
      }
    } catch (error) {
      console.error('Error fetching bulletins:', error);
    }
  };

  // Join Socket.io room and listen for real-time updates
  useEffect(() => {
    if (!socket || !isConnected) return;

    console.log('🔌 IdlePage: Joining kiosk room');
    joinRoom('kiosk');

    // Subscribe to bulletin updates
    const unsubscribe = subscribe('bulletin-updated', (data) => {
      console.log('📡 Bulletin update received in idle page:', data);

      if (data.type === 'bulletin-created') {
        // Add new bulletin to the list if it's an image
        const bulletin = data.data;
        const resourceType = bulletin.image?.resource_type;
        const mimeType = bulletin.image?.mimeType;
        if (resourceType === 'image' || (mimeType && mimeType.startsWith('image/'))) {
          setBulletins(prev => [...prev, bulletin]);
        }
      } else if (data.type === 'bulletin-deleted') {
        // Remove deleted bulletin from the list
        setBulletins(prev => prev.filter(b => b._id !== data.data.id));
      } else if (data.type === 'bulletin-updated') {
        // Update existing bulletin
        const bulletin = data.data;
        const resourceType = bulletin.image?.resource_type;
        const mimeType = bulletin.image?.mimeType;
        if (resourceType === 'image' || (mimeType && mimeType.startsWith('image/'))) {
          setBulletins(prev => prev.map(b => b._id === bulletin._id ? bulletin : b));
        } else {
          // If updated to video, remove it
          setBulletins(prev => prev.filter(b => b._id !== bulletin._id));
        }
      }
    });

    // Fetch initial bulletins
    fetchBulletins();

    return () => {
      unsubscribe();
      leaveRoom('kiosk');
    };
  }, [socket, isConnected]);

  // Transform bulletins to carousel images format
  const carouselImages = bulletins.length > 0
    ? bulletins.map((bulletin, index) => ({
        src: bulletin.image?.secure_url || bulletin.image?.url || `${API_CONFIG.getKioskUrl()}/${bulletin.image?.path}`,
        alt: bulletin.title || `Bulletin ${index + 1}`
      }))
    : [
        // Fallback to static images if no bulletins
        { src: '/idle/image1.png', alt: 'University Campus View 1' },
        { src: '/idle/image2.png', alt: 'University Campus View 2' },
        { src: '/idle/image3.png', alt: 'University Campus View 3' },
        { src: '/idle/image4.png', alt: 'University Campus View 4' },
        { src: '/idle/image5.png', alt: 'University Campus View 5' }
      ];

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Auto-advance carousel every 2.5 seconds for more dynamic display
  useEffect(() => {
    if (carouselImages.length === 0) return;

    const interval = setInterval(() => {
      setCurrentImageIndex((prev) =>
        prev === carouselImages.length - 1 ? 0 : prev + 1
      );
    }, 2500);

    return () => clearInterval(interval);
  }, [carouselImages.length]);

  // Format time and date
  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDay = (date) => {
    return date.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  };

  const formatDate = (date) => {
    return {
      day: date.getDate(),
      month: date.toLocaleDateString('en-US', { month: 'long' }).toUpperCase(),
      year: date.getFullYear()
    };
  };

  const dateInfo = formatDate(currentTime);

  // Enhanced animation variants for staggered effects
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 60, scale: 0.9 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15,
        duration: 0.6
      }
    }
  };

  const logoVariants = {
    hidden: { opacity: 0, scale: 0.5, rotate: -10 },
    visible: {
      opacity: 1,
      scale: 1,
      rotate: 0,
      transition: {
        type: "spring",
        stiffness: 120,
        damping: 12,
        duration: 0.8
      }
    }
  };

  const textVariants = {
    hidden: { opacity: 0, x: -50 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15,
        duration: 0.7
      }
    }
  };

  const timeVariants = {
    hidden: { opacity: 0, scale: 0.8, y: -30 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 120,
        damping: 12,
        duration: 0.7
      }
    }
  };

  const dateBoxVariants = {
    hidden: { opacity: 0, scale: 0.7, rotateY: -20 },
    visible: {
      opacity: 1,
      scale: 1,
      rotateY: 0,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15,
        duration: 0.8
      }
    }
  };

  const dateItemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 120,
        damping: 12
      }
    }
  };

  return (
    <div
      className="w-screen h-screen overflow-hidden grid grid-cols-4 bg-cover bg-center bg-no-repeat cursor-pointer kiosk-layout font-kiosk-public relative"
      onClick={handleReturnFromIdle}
      style={{
        backgroundImage: 'url(/idle/idleBG.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Navy blue overlay with 70% opacity */}
      <motion.div
        className="absolute inset-0 z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.7 }}
        transition={{ duration: 0.5 }}
        style={{
          backgroundColor: '#1F3463'
        }}
      />

      {/* Column 1 - Left sidebar (25% width) */}
      <motion.div
        className="col-span-1 flex flex-col justify-center items-center p-6 pb-[200px] text-center relative z-20"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Logo and Branding */}
        <motion.div
          className="mb-8 flex flex-col items-center"
          variants={itemVariants}
        >
          <div className="flex items-center space-x-3 mb-6">
            <motion.img
              src="/idle/logo.png"
              alt="Logo"
              className="w-12 h-12 object-contain drop-shadow-lg"
              variants={logoVariants}
            />
            <motion.div
              className="text-white text-2xl font-days-one"
              variants={textVariants}
            >
              LVCampusConnect
            </motion.div>
          </div>
          <motion.div
            className="text-white text-2xl"
            variants={textVariants}
            transition={{ delay: 0.1 }}
          >
            WELCOME TO LA VERDAD
          </motion.div>
        </motion.div>

        {/* Time Display */}
        <motion.div
          className="mb-8"
          variants={itemVariants}
        >
          <motion.div
            className="text-white text-5xl font-bold mb-1.5"
            variants={timeVariants}
          >
            {formatTime(currentTime)}
          </motion.div>
          <motion.div
            className="text-white text-2xl font-semibold"
            variants={textVariants}
            transition={{ delay: 0.15 }}
          >
            {formatDay(currentTime)}
          </motion.div>
        </motion.div>

        {/* Date Box */}
        <motion.div
          className="text-white bg-white bg-opacity-30 rounded-2xl p-[40px] shadow-lg"
          variants={dateBoxVariants}
        >
          <motion.div
            className="text-6xl font-bold mb-5"
            variants={dateItemVariants}
          >
            {dateInfo.day}
          </motion.div>
          <motion.div
            className="text-4xl font-semibold mb-0.5"
            variants={dateItemVariants}
          >
            {dateInfo.month}
          </motion.div>
          <motion.div
            className="text-2xl"
            variants={dateItemVariants}
          >
            {dateInfo.year}
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Columns 2-4 - Right section with carousel (75% width) */}
      <div className="col-span-3 relative flex flex-col z-20">
        {/* Main content area with carousel */}
        <div className="flex-grow relative overflow-hidden px-3 py-6 pb-[200px]">
          {/* Carousel Container with Flex Layout */}
          <motion.div
            className="relative w-full h-full flex items-center"
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{
              type: "spring",
              stiffness: 80,
              damping: 15,
              duration: 0.8,
              delay: 0.4
            }}
          >
            {/* Image Carousel Container - Centered between arrows with controlled height */}
            <div className="flex-grow relative mx-6 flex flex-col">
              {/* Image Container with explicit height to ensure visibility */}
              <div
                className="relative w-full flex items-center justify-center"
                style={{
                  height: 'calc(100vh - 256px)',
                  minHeight: '320px'
                }}
              >
                {carouselImages.map((image, index) => (
                  <motion.div
                    key={index}
                    className="absolute inset-0 flex items-center justify-center"
                    initial={{ opacity: 0 }}
                    animate={{
                      opacity: index === currentImageIndex ? 1 : 0,
                      scale: index === currentImageIndex ? 1 : 0.95,
                      transition: {
                        opacity: { duration: 1 },
                        scale: { duration: 1, type: "spring", stiffness: 100 }
                      }
                    }}
                  >
                    <img
                      src={image.src}
                      alt={image.alt}
                      className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                      onError={(e) => {
                        // Fallback to a solid color if image fails to load
                        e.target.style.display = 'none';
                        e.target.parentElement.style.backgroundColor = '#1F3463';
                        e.target.parentElement.style.backgroundImage = 'linear-gradient(45deg, #1F3463, #2d4a7a)';
                        e.target.parentElement.style.borderRadius = '0.5rem';
                      }}
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Footer Image - Positioned at bottom spanning full width */}
      <motion.footer
        className="absolute bottom-0 left-0 right-0 z-20"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          type: "spring",
          stiffness: 100,
          damping: 15,
          duration: 0.7,
          delay: 0.6
        }}
      >
        <img
          src="/idle/footer.png"
          alt="University Footer"
          className="w-full h-auto object-cover object-center"
        />
      </motion.footer>

      {/* TAP TO START with Touch Icon - Bottom Right Corner */}
      <motion.div
        className="absolute bottom-5 right-[280px] z-30 flex items-center space-x-3"
        initial={{ opacity: 0, scale: 0.5, y: 30 }}
        animate={{
          opacity: 1,
          scale: 1,
          y: 0,
          transition: {
            type: "spring",
            stiffness: 120,
            damping: 12,
            duration: 0.8,
            delay: 0.8
          }
        }}
      >
        <motion.img
          src="/idle/touch.png"
          alt="Touch Icon"
          className="w-[80px] h-[80px] object-contain"
          animate={{
            y: [0, -6, 0],
            filter: [
              'drop-shadow(0 0 6px rgba(255, 226, 81, 0.4))',
              'drop-shadow(0 0 16px rgba(255, 226, 81, 0.8))',
              'drop-shadow(0 0 6px rgba(255, 226, 81, 0.4))'
            ]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="text-white text-4xl font-bold tracking-wider"
          animate={{
            filter: [
              'drop-shadow(0 0 6px rgba(255, 226, 81, 0.4))',
              'drop-shadow(0 0 16px rgba(255, 226, 81, 0.8))',
              'drop-shadow(0 0 6px rgba(255, 226, 81, 0.4))'
            ]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          TAP TO START
        </motion.div>
      </motion.div>
    </div>
  );
};

export default IdlePage;
