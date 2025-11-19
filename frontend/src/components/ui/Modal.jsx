import React, { useEffect } from 'react';

const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  className = ''
}) => {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-full mx-4'
  };

  const CloseIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={closeOnOverlayClick ? onClose : undefined}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-3">
        <div
          className={`relative bg-white rounded-lg shadow-xl w-full ${sizeClasses[size]} ${className}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          {(title || showCloseButton) && (
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              {title && (
                <h3 className="text-base font-semibold text-gray-900">
                  {title}
                </h3>
              )}
              {showCloseButton && (
                <button
                  onClick={onClose}
                  className="text-gray-400 active:text-gray-600 active:scale-95 transition-all duration-150"
                >
                  <CloseIcon />
                </button>
              )}
            </div>
          )}

          {/* Content */}
          <div className="p-5">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

// Modal Header Component
export const ModalHeader = ({ children, className = '' }) => (
  <div className={`border-b border-gray-200 pb-3 mb-3 ${className}`}>
    {children}
  </div>
);

// Modal Body Component
export const ModalBody = ({ children, className = '' }) => (
  <div className={`${className}`}>
    {children}
  </div>
);

// Modal Footer Component
export const ModalFooter = ({ children, className = '' }) => (
  <div className={`border-t border-gray-200 pt-3 mt-3 flex items-center justify-end space-x-2.5 ${className}`}>
    {children}
  </div>
);

// Confirmation Modal
export const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning' // 'warning', 'danger', 'info'
}) => {
  const typeStyles = {
    warning: {
      icon: '⚠️',
      confirmButton: 'bg-yellow-600 hover:bg-yellow-700 text-white'
    },
    danger: {
      icon: '🗑️',
      confirmButton: 'bg-red-600 hover:bg-red-700 text-white'
    },
    info: {
      icon: 'ℹ️',
      confirmButton: 'bg-blue-600 hover:bg-blue-700 text-white'
    }
  };

  const style = typeStyles[type];

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <div className="text-center">
        <div className="text-3xl mb-3">{style.icon}</div>
        <h3 className="text-base font-semibold text-gray-900 mb-1.5">{title}</h3>
        <p className="text-sm text-gray-600 mb-5">{message}</p>

        <div className="flex space-x-2.5 justify-center">
          <button
            onClick={onClose}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 active:bg-gray-50 active:scale-95 transition-all duration-150"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${style.confirmButton}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default Modal;
