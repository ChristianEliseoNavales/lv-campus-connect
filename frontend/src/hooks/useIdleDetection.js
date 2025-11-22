import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const useIdleDetection = (idleTimeout = 60000) => { // 60 seconds (1 minute) for production
  const [isIdle, setIsIdle] = useState(false);
  const [showIdleModal, setShowIdleModal] = useState(false);
  const [countdown, setCountdown] = useState(20);
  const navigate = useNavigate();
  const location = useLocation();

  const idleTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const modalTimerRef = useRef(null);

  // Reset idle timer - Fixed to remove circular dependency
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }

    // Don't start idle timer if we're on idle page (both / and /idle)
    if (location.pathname === '/idle' || location.pathname === '/') {
      return;
    }

    idleTimerRef.current = setTimeout(() => {
      setShowIdleModal(true);
      setCountdown(20);
    }, idleTimeout);
  }, [idleTimeout, location.pathname]); // Removed showIdleModal dependency

  // Handle user activity - Fixed to remove circular dependency
  const handleActivity = useCallback(() => {
    if (location.pathname !== '/idle' && location.pathname !== '/') {
      resetIdleTimer();
    }
  }, [resetIdleTimer, location.pathname]);

  // Handle modal countdown
  useEffect(() => {
    if (showIdleModal && countdown > 0) {
      countdownTimerRef.current = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    } else if (showIdleModal && countdown === 0) {
      // Redirect to idle page (landing page)
      setShowIdleModal(false);
      setIsIdle(true);
      navigate('/');
    }

    return () => {
      if (countdownTimerRef.current) {
        clearTimeout(countdownTimerRef.current);
      }
    };
  }, [showIdleModal, countdown, navigate]);

  // Handle user staying active (clicking YES) - Fixed to restart timer properly
  const handleStayActive = useCallback(() => {
    setShowIdleModal(false);
    setCountdown(20);
    // Restart the idle timer immediately
    resetIdleTimer();
  }, [resetIdleTimer]);

  // Handle returning from idle page
  const handleReturnFromIdle = useCallback(() => {
    setIsIdle(false);
    navigate('/home');
    // Start idle detection again after a short delay
    setTimeout(() => {
      resetIdleTimer();
    }, 100);
  }, [navigate, resetIdleTimer]);

  // Set up event listeners for user activity - Fixed to prevent frequent re-attachment
  useEffect(() => {
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click'
    ];

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    return () => {
      // Cleanup event listeners
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
    };
  }, [handleActivity]); // Removed resetIdleTimer and location.pathname to prevent frequent re-attachment

  // Separate effect for timer management
  useEffect(() => {
    // Start initial timer if not on idle page (both / and /idle)
    if (location.pathname !== '/idle' && location.pathname !== '/') {
      resetIdleTimer();
    }

    return () => {
      // Cleanup timers
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      if (countdownTimerRef.current) {
        clearTimeout(countdownTimerRef.current);
      }
      if (modalTimerRef.current) {
        clearTimeout(modalTimerRef.current);
      }
    };
  }, [resetIdleTimer, location.pathname]);

  // Reset when location changes (except to idle page)
  useEffect(() => {
    if (location.pathname !== '/idle' && location.pathname !== '/') {
      setIsIdle(false);
      setShowIdleModal(false);
      setCountdown(20);
      resetIdleTimer();
    }
  }, [location.pathname, resetIdleTimer]);

  return {
    isIdle,
    showIdleModal,
    countdown,
    handleStayActive,
    handleReturnFromIdle
  };
};

export default useIdleDetection;
