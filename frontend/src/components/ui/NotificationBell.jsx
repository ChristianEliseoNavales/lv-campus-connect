import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BsBellFill } from 'react-icons/bs';
import { MdClose, MdCheckCircle, MdError, MdWarning, MdInfo } from 'react-icons/md';
import { authFetch } from '../../utils/apiClient';
import API_CONFIG from '../../config/api';

/**
 * NotificationBell Component
 * 
 * Displays a notification bell icon with unread count badge.
 * Clicking the bell opens a dropdown showing all notifications.
 * Notifications are fetched from the database and can be marked as read.
 */
const NotificationBell = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  /**
   * Fetch notifications from the database
   */
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/notifications?limit=50`);
      
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Mark a notification as read
   */
  const markAsRead = useCallback(async (notificationId) => {
    try {
      const response = await authFetch(
        `${API_CONFIG.getAdminUrl()}/api/notifications/${notificationId}/read`,
        {
          method: 'PATCH'
        }
      );

      if (response.ok) {
        // Update local state
        setNotifications(prev =>
          prev.map(notif =>
            notif._id === notificationId
              ? { ...notif, isRead: true, readAt: new Date() }
              : notif
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, []);

  /**
   * Mark all notifications as read
   */
  const markAllAsRead = useCallback(async () => {
    try {
      const response = await authFetch(
        `${API_CONFIG.getAdminUrl()}/api/notifications/mark-all-read`,
        {
          method: 'PATCH'
        }
      );

      if (response.ok) {
        // Update local state
        setNotifications(prev =>
          prev.map(notif => ({ ...notif, isRead: true, readAt: new Date() }))
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }, []);

  /**
   * Delete a notification
   */
  const deleteNotification = useCallback(async (notificationId) => {
    try {
      const response = await authFetch(
        `${API_CONFIG.getAdminUrl()}/api/notifications/${notificationId}`,
        {
          method: 'DELETE'
        }
      );

      if (response.ok) {
        // Update local state
        setNotifications(prev => prev.filter(notif => notif._id !== notificationId));
        // Recalculate unread count
        setUnreadCount(prev => {
          const deletedNotif = notifications.find(n => n._id === notificationId);
          return deletedNotif && !deletedNotif.isRead ? Math.max(0, prev - 1) : prev;
        });
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }, [notifications]);

  /**
   * Toggle dropdown open/close
   */
  const toggleDropdown = useCallback(() => {
    if (!isOpen) {
      fetchNotifications();
    }
    setIsOpen(prev => !prev);
  }, [isOpen, fetchNotifications]);

  /**
   * Close dropdown when clicking outside
   */
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  /**
   * Fetch initial unread count on mount
   */
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/notifications/unread-count`);
        if (response.ok) {
          const data = await response.json();
          setUnreadCount(data.unreadCount || 0);
        }
      } catch (error) {
        console.error('Error fetching unread count:', error);
      }
    };

    fetchUnreadCount();
  }, []);

  /**
   * Get icon for notification type
   */
  const getNotificationIcon = (type) => {
    const iconClass = "h-5 w-5";
    switch (type) {
      case 'success':
        return <MdCheckCircle className={`${iconClass} text-green-600`} />;
      case 'error':
        return <MdError className={`${iconClass} text-red-600`} />;
      case 'warning':
        return <MdWarning className={`${iconClass} text-yellow-600`} />;
      case 'info':
      default:
        return <MdInfo className={`${iconClass} text-blue-600`} />;
    }
  };

  /**
   * Format timestamp
   */
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Notification Bell Button */}
      <button
        onClick={toggleDropdown}
        className="relative flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200 hover:bg-white/10"
        style={{ backgroundColor: '#1F3463' }}
      >
        <BsBellFill className="h-6 w-6 text-white" />
        
        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 max-h-[600px] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1F3463]"></div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <BsBellFill className="h-12 w-12 text-gray-300 mb-3" />
                <p className="text-gray-500 text-center">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => (
                  <div
                    key={notification._id}
                    className={`px-4 py-3 hover:bg-gray-50 transition-colors ${
                      !notification.isRead ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className="flex-shrink-0 mt-0.5">
                        {getNotificationIcon(notification.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {notification.title}
                          </p>
                          <button
                            onClick={() => deleteNotification(notification._id)}
                            className="flex-shrink-0 text-gray-400 hover:text-gray-600"
                          >
                            <MdClose className="h-4 w-4" />
                          </button>
                        </div>
                        <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-xs text-gray-500">
                            {formatTimestamp(notification.createdAt)}
                          </span>
                          {!notification.isRead && (
                            <button
                              onClick={() => markAsRead(notification._id)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              Mark as read
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;

