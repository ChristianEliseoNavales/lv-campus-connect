import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingSpinner, Form, FormField, FormActions, Button } from '../ui';

const Login = () => {
  const { isAuthenticated, isLoading, signIn, signInWithCredentials, error, clearError, isGoogleLoaded } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [loginMethod, setLoginMethod] = useState('google'); // 'google' or 'manual'
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [isManualLoading, setIsManualLoading] = useState(false);
  const location = useLocation();
  
  // Redirect to intended page after login
  const from = location.state?.from?.pathname || '/admin';

  // Clear any existing errors when component mounts
  useEffect(() => {
    clearError();
  }, [clearError]);

  // Redirect if already authenticated
  if (isAuthenticated) {
    return <Navigate to={from} replace />;
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

  const validateForm = () => {
    const errors = {};

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.password.trim()) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleManualLogin = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsManualLoading(true);
    clearError();
    setFormErrors({});

    try {
      const result = await signInWithCredentials(formData.email, formData.password);

      if (result.success) {
        // Navigation will be handled by the redirect above
      } else {
        setFormErrors({ general: result.error || 'Login failed. Please check your credentials.' });
      }
    } catch (error) {
      console.error('Manual login error:', error);
      setFormErrors({ general: 'Unable to connect to server. Please try again.' });
    } finally {
      setIsManualLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear field-specific error when user starts typing
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
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

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 admin-layout">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
            <span className="text-white font-bold text-xl">LV</span>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Admin Sign In</h2>
          <p className="mt-2 text-gray-600">University Queue System</p>
          <p className="text-sm text-gray-500 mt-1">Access restricted to authorized personnel only</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-lg shadow-md p-8">
          {/* Login Method Toggle */}
          <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setLoginMethod('google')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                loginMethod === 'google'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Google SSO
            </button>
            <button
              onClick={() => setLoginMethod('manual')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                loginMethod === 'manual'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Email & Password
            </button>
          </div>

          {/* Error Messages */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Authentication Error</h3>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {formErrors.general && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Login Error</h3>
                  <p className="text-sm text-red-700 mt-1">{formErrors.general}</p>
                </div>
              </div>
            </div>
          )}

          {/* Google SSO Login */}
          {loginMethod === 'google' && (
            <div className="space-y-4">
              <button
                onClick={handleGoogleSignIn}
                disabled={!isGoogleLoaded || isSigningIn || isLoading}
                className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg shadow-sm bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSigningIn || isLoading ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <>
                    <GoogleIcon />
                    <span className="ml-3 font-medium">Sign in with Google</span>
                  </>
                )}
              </button>

              {/* Google Sign In Button Container (for fallback) */}
              <div id="google-signin-button" className="w-full flex justify-center"></div>

              {/* Loading State */}
              {!isGoogleLoaded && (
                <div className="text-center py-4">
                  <LoadingSpinner size="sm" />
                  <p className="text-sm text-gray-500 mt-2">Loading Google Sign-In...</p>
                </div>
              )}

              {/* Info for Google SSO */}
              <div className="text-center">
                <p className="text-sm text-gray-500">
                  Sign in with your university Google account
                </p>
              </div>
            </div>
          )}

          {/* Manual Login Form */}
          {loginMethod === 'manual' && (
            <Form onSubmit={handleManualLogin}>
              <FormField
                label="Email Address"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                error={formErrors.email}
                placeholder="Enter your university email"
                required
                autoComplete="email"
              />

              <FormField
                label="Password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                error={formErrors.password}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
              />

              <FormActions className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isManualLoading}
                  className="w-full"
                >
                  {isManualLoading ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span className="ml-2">Signing in...</span>
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </FormActions>

              {/* Test Credentials Info */}
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="text-sm font-medium text-blue-800 mb-2">Test Credentials</h4>
                <div className="text-xs text-blue-700 space-y-1">
                  <p><strong>Super Admin:</strong> admin@test.edu / Admin123!</p>
                  <p><strong>Registrar Admin:</strong> registrar@test.edu / Registrar123!</p>
                  <p><strong>Admissions Admin:</strong> admissions@test.edu / Admissions123!</p>
                </div>
              </div>
            </Form>
          )}

          {/* Info */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              {loginMethod === 'google'
                ? 'Only authorized university personnel with valid Google accounts can access this system.'
                : 'Use your university credentials or contact IT support for access.'
              }
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-sm text-gray-500">
            Need help? Contact IT Support at{' '}
            <a href="mailto:support@university.edu" className="text-blue-600 hover:text-blue-500">
              support@university.edu
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
