
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Import debug utilities (only loads in development)
if (import.meta.env.DEV) {
  import('./utils/debugPermissions.js').then(() => {
    console.log('🔧 Debug utilities loaded. Type debugPermissions() in console to check your permissions.');
  });
}

// Temporarily disable StrictMode for better HMR compatibility
// Re-enable for production builds
ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
);
