
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { logError } from './utils/errorHandler';

// Import debug utilities (only loads in development)
if (import.meta.env.DEV) {
  import('./utils/debugPermissions.js');
}

// Global Error Handlers
// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason;

  logError(error instanceof Error ? error : new Error(String(error)), {
    type: 'unhandledrejection',
    timestamp: new Date().toISOString()
  });

  // Prevent default browser error handling
  event.preventDefault();

  // In production, you might want to report to error tracking service
  // if (import.meta.env.PROD) {
  //   errorReportingService.captureException(error, {
  //     tags: { type: 'unhandledrejection' }
  //   });
  // }
});

// Handle global errors
window.addEventListener('error', (event) => {
  const error = event.error || new Error(event.message);

  logError(error, {
    type: 'global_error',
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    timestamp: new Date().toISOString()
  });

  // In production, you might want to report to error tracking service
  // if (import.meta.env.PROD) {
  //   errorReportingService.captureException(error, {
  //     tags: { type: 'global_error' },
  //     extra: {
  //       filename: event.filename,
  //       lineno: event.lineno,
  //       colno: event.colno
  //     }
  //   });
  // }
});

// Handle resource loading errors
window.addEventListener('error', (event) => {
  // Only handle resource errors (not script errors)
  if (event.target && event.target !== window) {
    logError(new Error(`Resource loading error: ${event.target.tagName} - ${event.target.src || event.target.href}`), {
      type: 'resource_error',
      tagName: event.target.tagName,
      src: event.target.src || event.target.href,
      timestamp: new Date().toISOString()
    });
  }
}, true); // Use capture phase to catch resource errors

// Temporarily disable StrictMode for better HMR compatibility
// Re-enable for production builds
ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
);
