import React, { useState, useEffect, useCallback } from 'react';
import { 
  CheckCircleIcon, 
  ExclamationTriangleIcon, 
  InformationCircleIcon, 
  XCircleIcon,
  XMarkIcon 
} from '@heroicons/react/24/outline';

const Toast = ({
  isVisible = false,
  type = 'info', // 'success', 'error', 'warning', 'info'
  title,
  message,
  duration = 3000, // Auto-dismiss duration in milliseconds (0 = no auto-dismiss)
  position = 'top-right', // 'top-right', 'top-center', 'top-left', 'bottom-right', 'bottom-center', 'bottom-left'
  showCloseButton = true,
  onClose,
  className = ''
}) => {
  const [show, setShow] = useState(isVisible);
  const [isAnimating, setIsAnimating] = useState(false);

  // Memoize handleClose to prevent infinite re-renders
  const handleClose = useCallback(() => {
    setIsAnimating(false);
    setTimeout(() => {
      setShow(false);
      if (onClose) onClose();
    }, 300);
  }, [onClose]);

  // Handle visibility changes
  useEffect(() => {
    if (isVisible) {
      setShow(true);
      setIsAnimating(true);
    } else {
      setIsAnimating(false);
      // Delay hiding to allow exit animation
      const timer = setTimeout(() => setShow(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  // Auto-dismiss functionality
  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, handleClose]);

  if (!show) return null;

  // Toast type configurations
  const typeConfig = {
    success: {
      icon: CheckCircleIcon,
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      iconColor: 'text-green-600',
      titleColor: 'text-green-800',
      messageColor: 'text-green-700',
      closeButtonColor: 'text-green-500 hover:text-green-700'
    },
    error: {
      icon: XCircleIcon,
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      iconColor: 'text-red-600',
      titleColor: 'text-red-800',
      messageColor: 'text-red-700',
      closeButtonColor: 'text-red-500 hover:text-red-700'
    },
    warning: {
      icon: ExclamationTriangleIcon,
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      iconColor: 'text-yellow-600',
      titleColor: 'text-yellow-800',
      messageColor: 'text-yellow-700',
      closeButtonColor: 'text-yellow-500 hover:text-yellow-700'
    },
    info: {
      icon: InformationCircleIcon,
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      iconColor: 'text-[#1F3463]', // University navy blue
      titleColor: 'text-[#1F3463]',
      messageColor: 'text-blue-700',
      closeButtonColor: 'text-blue-500 hover:text-[#1F3463]'
    }
  };

  // Position configurations
  const positionConfig = {
    'top-right': 'top-3 right-3',
    'top-center': 'top-3 left-1/2 transform -translate-x-1/2',
    'top-left': 'top-3 left-3',
    'bottom-right': 'bottom-3 right-3',
    'bottom-center': 'bottom-3 left-1/2 transform -translate-x-1/2',
    'bottom-left': 'bottom-3 left-3'
  };

  // Animation classes
  const animationClasses = {
    'top-right': isAnimating ? 'animate-slide-in-right' : 'animate-slide-out-right',
    'top-center': isAnimating ? 'animate-slide-in-down' : 'animate-slide-out-up',
    'top-left': isAnimating ? 'animate-slide-in-left' : 'animate-slide-out-left',
    'bottom-right': isAnimating ? 'animate-slide-in-right' : 'animate-slide-out-right',
    'bottom-center': isAnimating ? 'animate-slide-in-up' : 'animate-slide-out-down',
    'bottom-left': isAnimating ? 'animate-slide-in-left' : 'animate-slide-out-left'
  };

  const config = typeConfig[type];
  const IconComponent = config.icon;

  return (
    <div
      className={`
        fixed z-50 max-w-sm w-full
        ${positionConfig[position]}
        ${animationClasses[position]}
        ${className}
      `}
    >
      <div
        className={`
          ${config.bgColor} ${config.borderColor}
          border rounded-lg shadow-lg p-3
          transition-all duration-300 ease-in-out
        `}
      >
        <div className="flex items-start">
          {/* Icon */}
          <div className="flex-shrink-0">
            <IconComponent
              className={`h-5 w-5 ${config.iconColor}`}
              aria-hidden="true"
            />
          </div>

          {/* Content */}
          <div className="ml-2.5 flex-1">
            {title && (
              <h3 className={`text-xs font-semibold ${config.titleColor}`}>
                {title}
              </h3>
            )}
            {message && (
              <p className={`text-xs ${config.messageColor} ${title ? 'mt-0.5' : ''}`}>
                {message}
              </p>
            )}
          </div>

          {/* Close Button */}
          {showCloseButton && (
            <div className="ml-3 flex-shrink-0">
              <button
                onClick={handleClose}
                className={`
                  inline-flex rounded-md p-1 transition-colors duration-150
                  ${config.closeButtonColor}
                  hover:bg-white hover:bg-opacity-20
                  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                `}
              >
                <span className="sr-only">Dismiss</span>
                <XMarkIcon className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Toast Container Component for managing multiple toasts
export const ToastContainer = ({ toasts = [], onRemoveToast }) => {
  return (
    <div className="fixed inset-0 pointer-events-none z-[110]">
      {toasts.map((toast, index) => (
        <Toast
          key={toast.id || index}
          {...toast}
          isVisible={true}
          onClose={() => onRemoveToast && onRemoveToast(toast.id || index)}
          className="pointer-events-auto"
        />
      ))}
    </div>
  );
};

// Hook for managing toast notifications
export const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((toastConfig) => {
    const id = Date.now() + Math.random();
    const newToast = { ...toastConfig, id };
    setToasts(prev => [...prev, newToast]);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  // Memoized convenience methods to prevent infinite re-renders
  const showSuccess = useCallback((title, message, options = {}) =>
    addToast({ type: 'success', title, message, ...options }), [addToast]);

  const showError = useCallback((title, message, options = {}) =>
    addToast({ type: 'error', title, message, ...options }), [addToast]);

  const showWarning = useCallback((title, message, options = {}) =>
    addToast({ type: 'warning', title, message, ...options }), [addToast]);

  const showInfo = useCallback((title, message, options = {}) =>
    addToast({ type: 'info', title, message, ...options }), [addToast]);

  return {
    toasts,
    addToast,
    removeToast,
    clearAllToasts,
    showSuccess,
    showError,
    showWarning,
    showInfo
  };
};

export default Toast;
