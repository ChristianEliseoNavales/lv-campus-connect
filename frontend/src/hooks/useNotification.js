import { useCallback } from 'react';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import API_CONFIG from '../config/api';
import { authFetch } from '../utils/apiClient';

/**
 * Custom hook that extends useToast to automatically save notifications to the database
 *
 * This hook wraps the standard toast notification system and persists all notifications
 * to the database so users can review them later through the notification bell.
 *
 * Usage:
 * const { showSuccess, showError, showWarning, showInfo, toasts, removeToast } = useNotification();
 *
 * showSuccess('Success!', 'Your changes have been saved.');
 */
export const useNotification = () => {
  const toast = useToast();
  const { user, isAuthenticated } = useAuth();

  /**
   * Save notification to database
   * Only saves if user is authenticated (admin users)
   */
  const saveNotificationToDatabase = useCallback(async (type, title, message, metadata = {}) => {
    // Only save notifications for authenticated users
    if (!isAuthenticated || !user) {
      return;
    }

    try {
      await authFetch(`${API_CONFIG.getAdminUrl()}/api/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type,
          title,
          message,
          metadata
        })
      });
    } catch (error) {
      // Silently fail - don't show error toast for notification save failures
      // to avoid infinite loops. Connection errors are expected if backend is down.
      // Only log non-connection errors in development mode to reduce console noise.
      const isConnectionError =
        error.message?.includes('Failed to fetch') ||
        error.message?.includes('ERR_CONNECTION_REFUSED') ||
        error.message?.includes('NetworkError') ||
        error.name === 'TypeError';

      // Completely suppress connection errors (backend may be down, which is fine)
      // Only log other errors in development
      if (!isConnectionError && import.meta.env.DEV) {
        console.warn('Failed to save notification to database (this is non-critical):', error.message);
      }
    }
  }, [isAuthenticated, user]);

  /**
   * Show success notification
   */
  const showSuccess = useCallback((title, message, options = {}) => {
    // Save to database
    saveNotificationToDatabase('success', title, message, options.metadata);

    // Show toast
    return toast.showSuccess(title, message, options);
  }, [toast, saveNotificationToDatabase]);

  /**
   * Show error notification
   */
  const showError = useCallback((title, message, options = {}) => {
    // Save to database
    saveNotificationToDatabase('error', title, message, options.metadata);

    // Show toast
    return toast.showError(title, message, options);
  }, [toast, saveNotificationToDatabase]);

  /**
   * Show warning notification
   */
  const showWarning = useCallback((title, message, options = {}) => {
    // Save to database
    saveNotificationToDatabase('warning', title, message, options.metadata);

    // Show toast
    return toast.showWarning(title, message, options);
  }, [toast, saveNotificationToDatabase]);

  /**
   * Show info notification
   */
  const showInfo = useCallback((title, message, options = {}) => {
    // Save to database
    saveNotificationToDatabase('info', title, message, options.metadata);

    // Show toast
    return toast.showInfo(title, message, options);
  }, [toast, saveNotificationToDatabase]);

  // Return all toast methods plus the enhanced notification methods
  return {
    ...toast,
    showSuccess,
    showError,
    showWarning,
    showInfo
  };
};

export default useNotification;

