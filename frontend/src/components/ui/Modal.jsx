import React, { useEffect } from 'react';
import { MdClose, MdWarning, MdInfo } from 'react-icons/md';

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
          className={`relative bg-white rounded-xl shadow-xl w-full ${sizeClasses[size]} ${className}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          {showCloseButton && (
            <button
              onClick={onClose}
              className="absolute -top-1.5 -right-1.5 z-10 w-6 h-6 bg-[#1F3463] border-2 border-white rounded-full flex items-center justify-center text-white hover:bg-opacity-90 transition-colors"
            >
              <MdClose className="w-3 h-3" />
            </button>
          )}

          {/* Header */}
          {title && (
            <div className="p-5 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">
                {title}
              </h3>
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
      icon: <MdWarning className="w-12 h-12 text-yellow-600 mx-auto" />,
      confirmButton: 'bg-yellow-600 hover:bg-yellow-700 text-white'
    },
    danger: {
      icon: <MdWarning className="w-12 h-12 text-red-600 mx-auto" />,
      confirmButton: 'bg-red-600 hover:bg-red-700 text-white'
    },
    info: {
      icon: <MdInfo className="w-12 h-12 text-blue-600 mx-auto" />,
      confirmButton: 'bg-blue-600 hover:bg-blue-700 text-white'
    }
  };

  const style = typeStyles[type];

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" showCloseButton={false}>
      <div className="relative text-center pt-8">
        {/* Icon positioned to overflow top of modal */}
        <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 z-10 flex items-center justify-center">
          {/* White triangular background */}
          <div 
            className="absolute w-16 h-16 bg-white"
            style={{
              clipPath: 'polygon(50% 5%, 0% 90%, 100% 90%)'
            }}
          />
          {/* Icon on top of triangle */}
          <div className="relative z-10">
            {style.icon}
          </div>
        </div>
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
