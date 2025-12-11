import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingSpinner } from '../ui';

const Login = () => {
  const { isAuthenticated, isLoading, signIn, error, clearError, isGoogleLoaded, getDefaultRoute } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const location = useLocation();

  // Determine redirect destination
  // Priority: 1) Intended page from navigation state, 2) Role-based default route
  const getRedirectPath = () => {
    // If user was trying to access a specific page, redirect there
    if (location.state?.from?.pathname) {
      return location.state.from.pathname;
    }
    // Otherwise, use role-based default route
    return getDefaultRoute();
  };

  // Debug: Log error state changes
  useEffect(() => {
    // Error handling is done via error prop display
  }, [error]);

  // Redirect if already authenticated
  if (isAuthenticated) {
    const redirectPath = getRedirectPath();
    return <Navigate to={redirectPath} replace />;
  }

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    clearError();

    try {
      const result = await signIn();
      if (result.success) {
        // Navigation will be handled by the redirect above
      }
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setIsSigningIn(false);
    }
  };

  const GoogleIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );

  // Animation variants for staggered effects
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15,
        duration: 0.4
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
        duration: 0.5
      }
    }
  };

  const errorVariants = {
    hidden: { opacity: 0, y: -20, scale: 0.9 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 150,
        damping: 15,
        duration: 0.3
      }
    },
    exit: {
      opacity: 0,
      y: -20,
      scale: 0.9,
      transition: {
        duration: 0.2
      }
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 admin-layout bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: 'url(/login-bg.jpg)' }}
    >
      {/* Blurred background overlay */}
      <motion.div
        className="absolute inset-0 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      />

      {/* Centered white container */}
      <motion.div
        className="relative z-10 bg-white rounded-3xl shadow-2xl p-12 max-w-md w-full border-t-8 border-[#1F3463]"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{
          type: "spring",
          stiffness: 100,
          damping: 15,
          duration: 0.5
        }}
      >
        {/* Content Stack */}
        <motion.div
          className="flex flex-col items-center space-y-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* WELCOME text */}
          <motion.h1
            className="text-4xl font-bold text-[#1F3463] tracking-wide font-days-one"
            variants={itemVariants}
          >
            WELCOME
          </motion.h1>

          {/* LVCampusConnect text with logo */}
          <motion.div
            className="flex items-center gap-3"
            variants={itemVariants}
          >
            <motion.img
              src="/logo.png"
              alt="LVCampusConnect Logo"
              className="w-12 h-12"
              variants={logoVariants}
            />
            <h2 className="text-2xl font-semibold text-[#1F3463] font-days-one">LVCampusConnect</h2>
          </motion.div>

          {/* Error Messages - Positioned between logo and button */}
          {error && (
            <motion.div
              className="w-full p-4 bg-red-50 border-2 border-red-500 rounded-lg shadow-md relative"
              variants={errorVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3 flex-1 pr-8">
                  <h3 className="text-base font-semibold text-red-900">Authentication Error</h3>
                  <p className="text-sm text-red-600 mt-1 font-medium">{error}</p>
                  {/* Additional help text based on error type */}
                  {error.includes('not registered') && (
                    <p className="text-xs text-red-500 mt-2">
                      Contact lvcampusconnect@gmail.com to register your account.
                    </p>
                  )}
                  {error.includes('deactivated') && (
                    <p className="text-xs text-red-500 mt-2">
                      Contact lvcampusconnect@gmail.com for assistance.
                    </p>
                  )}
                  {error.includes('Failed to initialize') && (
                    <p className="text-xs text-red-500 mt-2">
                      Try refreshing the page.
                    </p>
                  )}
                  {error.includes('Unable to connect') && (
                    <p className="text-xs text-red-500 mt-2">
                      Check your network connection.
                    </p>
                  )}
                  {(error.includes('taking too long') || error.includes('database may be unavailable')) && (
                    <p className="text-xs text-red-500 mt-2">
                      Database unavailable. Please try again later or contact lvcampusconnect@gmail.com.
                    </p>
                  )}
                </div>
                {/* Close button */}
                <button
                  onClick={clearError}
                  className="absolute top-3 right-3 text-red-600 hover:text-red-800 transition-colors"
                  aria-label="Dismiss error"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </motion.div>
          )}

          {/* Sign in with Google button */}
          <motion.button
            onClick={handleGoogleSignIn}
            disabled={!isGoogleLoaded || isSigningIn || isLoading}
            className="w-full flex items-center justify-center px-6 py-3 border border-gray-300 rounded-lg shadow-sm bg-[#1F3463] text-white hover:bg-[#1F3463]-20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1F3463] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            variants={itemVariants}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {isSigningIn || isLoading ? (
              <LoadingSpinner size="sm" />
            ) : (
              <>
                <GoogleIcon />
                <span className="ml-3 font-medium">Sign in with Google</span>
              </>
            )}
          </motion.button>

          {/* Google Sign In Button Container (for fallback) */}
          <motion.div
            id="google-signin-button"
            className="w-full flex justify-center"
            variants={itemVariants}
          />

          {/* Loading State */}
          {!isGoogleLoaded && (
            <motion.div
              className="text-center py-4"
              variants={itemVariants}
            >
              <LoadingSpinner size="sm" />
              <p className="text-sm text-gray-500 mt-2">Loading Google Sign-In...</p>
            </motion.div>
          )}

          {/* Contact info */}
          <motion.p
            className="text-sm text-gray-600 text-center"
            variants={itemVariants}
          >
            Need help? Contact IT Support at{' '}
            <a href="mailto:lvcampusconnect@gmail.com" className="text-[#1F3463] hover:underline font-medium">
              lvcampusconnect@gmail.com
            </a>
          </motion.p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Login;
