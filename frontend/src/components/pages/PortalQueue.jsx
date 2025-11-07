import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSocket } from '../../contexts/SocketContext';
import API_CONFIG from '../../config/api';
import notificationService from '../../services/notificationService';

const PortalQueue = () => {
  const [searchParams] = useSearchParams();
  const { joinRoom, subscribe } = useSocket();

  // State for queue data
  const [queueData, setQueueData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentDate, setCurrentDate] = useState('');
  const [isQueueCalled, setIsQueueCalled] = useState(false);
  const [showNotificationAlert, setShowNotificationAlert] = useState(false);
  const [showEnableNotificationsPrompt, setShowEnableNotificationsPrompt] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // Ref to track previous status to detect changes
  const previousStatusRef = useRef(null);

  // Get queue ID from URL parameters
  const queueId = searchParams.get('queueId');

  // Function to enable notifications (requires user interaction for iOS)
  const enableNotifications = async () => {
    try {
      console.log('🔔 User enabling notifications...');

      // Initialize and unlock audio context with user gesture
      const success = await notificationService.initializeWithUserGesture();

      if (success) {
        setNotificationsEnabled(true);
        setShowEnableNotificationsPrompt(false);
        console.log('✅ Notifications enabled successfully!');

        // Don't play test sound - just enable silently
      } else {
        console.error('❌ Failed to enable notifications');
        alert('Failed to enable notifications. Please try again or use Safari browser for best experience on iOS.');
      }
    } catch (error) {
      console.error('❌ Error enabling notifications:', error);
      alert('Error enabling notifications: ' + error.message);
    }
  };

  // Initialize notification service on component mount
  useEffect(() => {
    const initNotifications = async () => {
      await notificationService.initialize();
      const support = notificationService.getSupport();
      console.log('🔔 Notification support:', support);

      // Show alert if user needs to enable sound
      if (!support.audio) {
        setShowNotificationAlert(true);
      }
    };

    initNotifications();

    // Cleanup on unmount
    return () => {
      notificationService.cleanup();
    };
  }, []);

  // Set current date on component mount
  useEffect(() => {
    const today = new Date();
    const options = {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    setCurrentDate(today.toLocaleDateString('en-US', options));
  }, []);

  // Fetch queue data
  const fetchQueueData = async () => {
    if (!queueId) {
      setError('No queue ID provided');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Use cloud backend for PortalQueue (accessed via QR codes on mobile devices)
      const response = await fetch(`${API_CONFIG.CLOUD_BACKEND}/api/public/queue-lookup/${queueId}`);
      const result = await response.json();

      if (response.ok && result.success) {
        const newData = result.data;

        // Check if status changed from 'waiting' to 'serving'
        if (previousStatusRef.current === 'waiting' && newData.status === 'serving') {
          console.log('🔔 Queue status changed to SERVING - triggering notifications!');

          // Trigger all notifications (sound + haptic)
          const notificationResults = await notificationService.notifyQueueCalled();
          console.log('🔔 Notification results:', notificationResults);

          // Set visual alert state
          setIsQueueCalled(true);

          // Auto-dismiss visual alert after 10 seconds
          setTimeout(() => {
            setIsQueueCalled(false);
          }, 10000);
        }

        // Update previous status ref
        previousStatusRef.current = newData.status;

        setQueueData(newData);
        setError(null);
      } else {
        setError(result.error || 'Failed to load queue data');
      }
    } catch (err) {
      console.error('Error fetching queue data:', err);
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  // Initialize data and real-time updates
  useEffect(() => {
    if (queueId) {
      fetchQueueData();

      // Join queue-specific room for real-time updates
      joinRoom(`queue-${queueId}`);

      // Listen for queue updates
      const unsubscribe = subscribe('queue-updated', async (data) => {
        console.log('📡 PortalQueue - Real-time update received:', data);

        // Check if this is a status update to 'serving' for our queue
        if (data.queueId === queueId && data.type === 'queue-status-updated' && data.data?.status === 'serving') {
          console.log('🔔 Real-time notification: Queue is now being served!');

          // Trigger notifications immediately via Socket.io event
          const notificationResults = await notificationService.notifyQueueCalled();
          console.log('🔔 Real-time notification results:', notificationResults);

          // Set visual alert state
          setIsQueueCalled(true);

          // Auto-dismiss visual alert after 10 seconds
          setTimeout(() => {
            setIsQueueCalled(false);
          }, 10000);
        }

        // Always refresh data for any queue update
        if (data.queueId === queueId || data.type === 'queue-status-updated') {
          fetchQueueData();
        }
      });

      return () => {
        unsubscribe();
      };
    } else {
      setError('No queue ID provided in URL');
      setLoading(false);
    }
  }, [queueId, joinRoom, subscribe]);

  // Auto-refresh every 30 seconds as backup
  useEffect(() => {
    if (queueData && !error) {
      const interval = setInterval(() => {
        fetchQueueData();
      }, 30000); // 30 seconds

      return () => clearInterval(interval);
    }
  }, [queueData, error]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col font-kiosk-public">
        {/* Header Section */}
        <header
          className="w-full flex-shrink-0 relative bg-cover bg-center bg-no-repeat h-24 sm:h-28 md:h-32 lg:h-36 xl:h-40"
          style={{
            backgroundImage: 'url(/mobile/headerBg.png)'
          }}
        >
          <div className="absolute inset-0 bg-white opacity-20"></div>
          <div className="absolute inset-0 flex items-center justify-center px-2 sm:px-4 md:px-6 lg:px-8">
            <div className="flex items-center justify-center gap-2 xs:gap-3 sm:gap-4 md:gap-6 lg:gap-8 max-w-[98%] xs:max-w-[95%] sm:max-w-[90%] md:max-w-[85%] lg:max-w-none overflow-hidden">
              <div className="flex-shrink-0 flex items-center">
                <img
                  src="/mobile/logo.png"
                  alt="University Logo"
                  className="h-10 w-auto xs:h-12 sm:h-14 md:h-16 lg:h-20 xl:h-24 object-contain"
                />
              </div>
              <div className="flex-shrink min-w-0 flex items-center justify-center">
                <h1
                  className="font-days-one text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-normal text-center leading-tight whitespace-nowrap"
                  style={{
                    color: '#1F3463',
                    lineHeight: '0.9'
                  }}
                >
                  LVCampusConnect
                </h1>
              </div>
            </div>
          </div>
        </header>

        {/* Loading Content */}
        <main className="flex-grow flex items-center justify-center px-4 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#1F3463] mx-auto mb-4"></div>
            <p className="text-lg text-gray-600">Loading queue information...</p>
          </div>
        </main>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col font-kiosk-public">
        {/* Header Section */}
        <header
          className="w-full flex-shrink-0 relative bg-cover bg-center bg-no-repeat h-24 sm:h-28 md:h-32 lg:h-36 xl:h-40"
          style={{
            backgroundImage: 'url(/mobile/headerBg.png)'
          }}
        >
          <div className="absolute inset-0 bg-white opacity-20"></div>
          <div className="absolute inset-0 flex items-center justify-center px-2 sm:px-4 md:px-6 lg:px-8">
            <div className="flex items-center justify-center gap-2 xs:gap-3 sm:gap-4 md:gap-6 lg:gap-8 max-w-[98%] xs:max-w-[95%] sm:max-w-[90%] md:max-w-[85%] lg:max-w-none overflow-hidden">
              <div className="flex-shrink-0 flex items-center">
                <img
                  src="/mobile/logo.png"
                  alt="University Logo"
                  className="h-10 w-auto xs:h-12 sm:h-14 md:h-16 lg:h-20 xl:h-24 object-contain"
                />
              </div>
              <div className="flex-shrink min-w-0 flex items-center justify-center">
                <h1
                  className="font-days-one text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-normal text-center leading-tight whitespace-nowrap"
                  style={{
                    color: '#1F3463',
                    lineHeight: '0.9'
                  }}
                >
                  LVCampusConnect
                </h1>
              </div>
            </div>
          </div>
        </header>

        {/* Error Content */}
        <main className="flex-grow flex items-center justify-center px-4 py-8">
          <div className="text-center max-w-md">
            <div className="text-6xl mb-4">❌</div>
            <h2 className="text-2xl font-bold text-[#1F3463] mb-4">Queue Not Found</h2>
            <p className="text-lg text-gray-600 mb-6">{error}</p>
          </div>
        </main>
      </div>
    );
  }

  // Main content with queue data
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-kiosk-public">
      {/* Header Section */}
      <header
        className="w-full flex-shrink-0 relative bg-cover bg-center bg-no-repeat h-24 sm:h-28 md:h-32 lg:h-36 xl:h-40"
        style={{
          backgroundImage: 'url(/mobile/headerBg.png)'
        }}
      >
        {/* White Overlay for Text Readability */}
        <div className="absolute inset-0 bg-white opacity-20"></div>

        {/* Header Content Container - Simplified flex structure for perfect centering */}
        <div className="absolute inset-0 flex items-center justify-center px-2 sm:px-4 md:px-6 lg:px-8">
          {/* Centered Content Group - Single flex container with proper alignment */}
          <div className="flex items-center justify-center gap-2 xs:gap-3 sm:gap-4 md:gap-6 lg:gap-8 max-w-[98%] xs:max-w-[95%] sm:max-w-[90%] md:max-w-[85%] lg:max-w-none overflow-hidden">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center">
              <img
                src="/mobile/logo.png"
                alt="University Logo"
                className="h-10 w-auto xs:h-12 sm:h-14 md:h-16 lg:h-20 xl:h-24 object-contain"
              />
            </div>

            {/* Header Text */}
            <div className="flex-shrink min-w-0 flex items-center justify-center">
              <h1
                className="font-days-one text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-normal text-center leading-tight whitespace-nowrap"
                style={{
                  color: '#1F3463',
                  lineHeight: '0.9' // Tighter line height for better vertical centering
                }}
              >
                LVCampusConnect
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow px-4 py-4 sm:px-6 sm:py-6 md:py-8">
        {/* Queue Called Alert - Prominent Visual Notification */}
        {isQueueCalled && (
          <div className="mb-6 sm:mb-8 animate-pulse">
            <div
              className="rounded-2xl p-4 sm:p-6 shadow-2xl border-4 mx-auto max-w-md sm:max-w-lg"
              style={{
                backgroundColor: '#FFE251',
                borderColor: '#1F3463'
              }}
            >
              <div className="text-center">
                <div className="text-4xl sm:text-5xl md:text-6xl mb-2">🔔</div>
                <h3
                  className="text-xl sm:text-2xl md:text-3xl font-bold mb-2"
                  style={{ color: '#1F3463' }}
                >
                  YOUR TURN!
                </h3>
                <p
                  className="text-base sm:text-lg md:text-xl font-semibold"
                  style={{ color: '#1F3463' }}
                >
                  Please proceed to {queueData?.windowName || 'your window'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Enable Notifications Modal - Full Screen */}
        {showEnableNotificationsPrompt && !notificationsEnabled && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: '#1F3463' }}
          >
            <div className="w-full max-w-2xl">
              {/* Modal Content */}
              <div className="text-center">
                {/* Icon */}
                <div className="mb-8">
                  <div className="text-8xl sm:text-9xl mb-4">🔔</div>
                </div>

                {/* Title */}
                <h2
                  className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6"
                  style={{
                    color: '#FFE251',
                    fontFamily: 'Days One, sans-serif'
                  }}
                >
                  Enable Sound Alerts
                </h2>

                {/* Description */}
                <p className="text-white text-lg sm:text-xl md:text-2xl mb-8 leading-relaxed px-4">
                  To receive audio notifications when your queue number is called, please tap the button below.
                </p>

                <p className="text-white/80 text-sm sm:text-base mb-12 px-4">
                  This allows the system to play sound alerts on your device.
                </p>

                {/* Enable Button */}
                <button
                  onClick={enableNotifications}
                  className="px-12 py-6 rounded-2xl font-bold text-xl sm:text-2xl shadow-2xl transition-all duration-200 transform hover:scale-105 active:scale-95 mb-6"
                  style={{
                    backgroundColor: '#FFE251',
                    color: '#1F3463'
                  }}
                >
                  🔊 Enable Sound Alerts
                </button>

                {/* Skip Button */}
                <div>
                  <button
                    onClick={() => setShowEnableNotificationsPrompt(false)}
                    className="text-white/60 text-sm sm:text-base underline hover:text-white/80 transition-colors"
                  >
                    Continue without sound (not recommended)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notifications Enabled Confirmation */}
        {notificationsEnabled && (
          <div className="mb-4 sm:mb-6">
            <div className="bg-green-50 border-l-4 border-green-400 p-4 mx-auto max-w-md sm:max-w-lg rounded-lg">
              <div className="flex items-center">
                <div className="text-2xl mr-3">✅</div>
                <div>
                  <p className="text-sm text-green-700 font-semibold">
                    Sound alerts enabled! You'll hear a notification when your queue is called.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notification Support Alert */}
        {showNotificationAlert && (
          <div className="mb-4 sm:mb-6">
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mx-auto max-w-md sm:max-w-lg">
              <div className="flex items-start">
                <div className="text-2xl mr-3">ℹ️</div>
                <div>
                  <p className="text-sm text-blue-700">
                    <strong>Tip:</strong> Enable sound on your device to receive audio notifications when your queue is called.
                  </p>
                  <button
                    onClick={() => setShowNotificationAlert(false)}
                    className="mt-2 text-xs text-blue-600 underline"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Date Validity Section */}
        <div className="text-center mb-4 sm:mb-6 md:mb-8">
          <p className="text-base sm:text-lg md:text-xl text-gray-700 font-medium px-2">
            This queue is only valid on{' '}
            <span className="font-semibold" style={{ color: '#1F3463' }}>
              {currentDate}
            </span>
          </p>
        </div>

        {/* Queue Number Display - Large Circular Border with conditional animation */}
        <div className="flex justify-center mb-6 sm:mb-8 md:mb-10">
          <div
            className={`w-36 h-36 sm:w-44 sm:h-44 md:w-52 md:h-52 lg:w-56 lg:h-56 border-4 rounded-full flex items-center justify-center bg-white shadow-lg transition-all duration-300 ${
              isQueueCalled ? 'animate-pulse ring-8 ring-yellow-300' : ''
            }`}
            style={{ borderColor: isQueueCalled ? '#FFE251' : '#1F3463' }}
          >
            <span
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold"
              style={{ color: '#1F3463' }}
            >
              {queueData?.queueNumber?.toString().padStart(2, '0') || '00'}
            </span>
          </div>
        </div>

        {/* Queue Information Section */}
        <div className="text-center mb-6 sm:mb-8 md:mb-10 space-y-2 sm:space-y-3 md:space-y-4 px-2">
          <h2
            className="text-xl sm:text-2xl md:text-3xl font-bold"
            style={{ color: '#1F3463' }}
          >
            Queue Number
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-gray-700">
            <span className="font-semibold">
              Location: <br />
              {queueData?.location || 'Location not available'}
            </span>
          </p>
          <p className="text-base sm:text-lg md:text-xl text-gray-700">
            Please Proceed to
          </p>
          <p
            className="text-lg sm:text-xl md:text-2xl font-bold"
            style={{ color: '#1F3463' }}
          >
            {queueData?.windowName || 'Window 1'}
          </p>
          {queueData?.status && (
            <div className="mt-4">
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                queueData.status === 'waiting' ? 'bg-yellow-100 text-yellow-800' :
                queueData.status === 'serving' ? 'bg-green-100 text-green-800' :
                queueData.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                Status: {queueData.status.charAt(0).toUpperCase() + queueData.status.slice(1)}
              </span>
            </div>
          )}
        </div>

        {/* Queue Status Container */}
        <div className="bg-gray-100 rounded-2xl p-4 sm:p-6 mx-auto max-w-sm sm:max-w-md md:max-w-lg">
          {/* Labels */}
          <div className="flex justify-between mb-4 text-sm sm:text-base font-medium text-gray-600">
            <span>Serving</span>
            <span className="text-right">Waiting in line</span>
          </div>

          {/* Status Boxes */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4">
            {/* Now Serving Box */}
            <div
              className="text-white rounded-xl p-3 p-6 text-center"
              style={{ backgroundColor: '#1F3463' }}
            >
              <div className="text-xl sm:text-2xl md:text-3xl font-bold">
                {queueData?.currentServing?.toString().padStart(2, '0') || '00'}
              </div>
            </div>

            {/* Waiting Boxes */}
            {queueData?.upcomingNumbers?.length > 0 ? (
              queueData.upcomingNumbers.slice(0, 2).map((number, index) => (
                <div
                  key={index}
                  className="bg-gray-200 text-gray-700 rounded-xl p-6 text-center"
                >
                  <div className="text-xl sm:text-2xl md:text-3xl font-bold">
                    {number.toString().padStart(2, '0')}
                  </div>
                </div>
              ))
            ) : (
              // Show placeholder boxes if no upcoming numbers
              Array.from({ length: 2 }, (_, index) => (
                <div
                  key={index}
                  className="bg-gray-200 text-gray-700 rounded-xl p-6 text-center"
                >
                  <div className="text-xl sm:text-2xl md:text-3xl font-bold">
                    --
                  </div>
                </div>
              ))
            )}

            {/* Fill remaining slots if less than 2 upcoming numbers */}
            {queueData?.upcomingNumbers?.length === 1 && (
              <div className="bg-gray-200 text-gray-700 rounded-xl p-6 text-center">
                <div className="text-xl sm:text-2xl md:text-3xl font-bold">
                  --
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Refresh Button */}
      <div className="flex justify-center mb-4">
        <button
          onClick={fetchQueueData}
          disabled={loading}
          className="px-4 py-2 bg-[#1F3463] text-white rounded-lg font-semibold hover:bg-[#1A2E56] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Refreshing...
            </>
          ) : (
            <>
              🔄 Refresh Status
            </>
          )}
        </button>
      </div>

      {/* Footer Section */}
      <footer className="w-full flex-shrink-0 mt-auto py-4 px-4">
        <div className="text-center">
          <p className="font-tolkien text-sm sm:text-base md:text-lg text-gray-600 leading-relaxed">
            © 2025. LA VERDAD CHRISTIAN COLLEGE, INC.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default PortalQueue;
