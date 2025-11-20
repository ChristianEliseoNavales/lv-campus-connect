import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { io } from 'socket.io-client';
import useIdleDetection from '../../hooks/useIdleDetection';
import API_CONFIG from '../../config/api';

const IdlePage = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [bulletins, setBulletins] = useState([]);
  const [socket, setSocket] = useState(null);
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

  // Initialize Socket.io connection and fetch bulletins
  useEffect(() => {
    const newSocket = io(API_CONFIG.getKioskUrl());
    setSocket(newSocket);

    // Join kiosk room for real-time updates
    newSocket.emit('join-room', 'kiosk');

    // Listen for bulletin updates
    newSocket.on('bulletin-updated', (data) => {
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
      newSocket.disconnect();
    };
  }, []);

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
      <div
        className="absolute inset-0 z-10"
        style={{
          backgroundColor: '#1F3463',
          opacity: 0.7
        }}
      />

      {/* Column 1 - Left sidebar (25% width) */}
      <div className="col-span-1 flex flex-col justify-center items-center p-8 pb-[250px] text-center relative z-20">
        {/* Logo and Branding */}
        <motion.div
          className="mb-10 flex flex-col items-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0 }}
        >
          <div className="flex items-center space-x-4 mb-8">
            <img
              src="/idle/logo.png"
              alt="Logo"
              className="w-16 h-16 object-contain drop-shadow-lg"
            />
            <div className="text-white text-3xl font-days-one">
              LVCampusConnect
            </div>
          </div>
          <div className="text-white text-3xl">
            WELCOME TO LA VERDAD
          </div>
        </motion.div>

        {/* Time Display */}
        <motion.div
          className="mb-10"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="text-white text-6xl font-bold mb-2">
            {formatTime(currentTime)}
          </div>
          <div className="text-white text-3xl font-semibold">
            {formatDay(currentTime)}
          </div>
        </motion.div>

        {/* Date Box */}
        <motion.div
          className="text-white bg-white bg-opacity-30 rounded-2xl p-[50px] shadow-lg"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <div className="text-7xl font-bold mb-6" >
            {dateInfo.day}
          </div>
          <div className="text-5xl font-semibold mb-1" >
            {dateInfo.month}
          </div>
          <div className="text-3xl">
            {dateInfo.year}
          </div>
        </motion.div>
      </div>

      {/* Columns 2-4 - Right section with carousel (75% width) */}
      <div className="col-span-3 relative flex flex-col z-20">
        {/* Main content area with carousel */}
        <div className="flex-grow relative overflow-hidden px-4 py-8 pb-[250px]">
          {/* Carousel Container with Flex Layout */}
          <motion.div
            className="relative w-full h-full flex items-center"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            {/* Image Carousel Container - Centered between arrows with controlled height */}
            <div className="flex-grow relative mx-8 flex flex-col">
              {/* Image Container with explicit height to ensure visibility */}
              <div
                className="relative w-full flex items-center justify-center"
                style={{
                  height: 'calc(100vh - 320px)',
                  minHeight: '400px'
                }}
              >
                {carouselImages.map((image, index) => (
                  <div
                    key={index}
                    className={`absolute inset-0 transition-opacity duration-1000 flex items-center justify-center ${
                      index === currentImageIndex ? 'opacity-100' : 'opacity-0'
                    }`}
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
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Footer Image - Positioned at bottom spanning full width */}
      <motion.footer
        className="absolute bottom-0 left-0 right-0 z-20"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        <img
          src="/idle/footer.png"
          alt="University Footer"
          className="w-full h-auto object-cover object-center"
        />
      </motion.footer>

      {/* TAP TO START with Touch Icon - Bottom Right Corner */}
      <motion.div
        className="absolute bottom-6 right-[350px] z-30 flex items-center space-x-4 animate-tap-attention"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.5 }}
      >
        <img
          src="/idle/touch.png"
          alt="Touch Icon"
          className="w-[100px] h-[100px] object-contain animate-glow-pulse"
        />
        <div className="text-white text-5xl font-bold tracking-wider animate-glow-pulse">
          TAP TO START
        </div>
      </motion.div>
    </div>
  );
};

export default IdlePage;
