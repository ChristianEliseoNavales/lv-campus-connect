import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { MdAdd, MdLocationOn, MdClose, MdKeyboardArrowDown, MdMonitor } from 'react-icons/md';
import { AiOutlineEye, AiOutlineEyeInvisible } from 'react-icons/ai';
import { LuSettings2 } from 'react-icons/lu';
import { FiEdit3 } from 'react-icons/fi';
import { useSocket } from '../../../../contexts/SocketContext';
import { ToastContainer, ConfirmModal } from '../../../ui';
import { useNotification } from '../../../../hooks/useNotification';
import API_CONFIG from '../../../../config/api';
import { authFetch } from '../../../../utils/apiClient';

// Utility functions for change detection
const deepEqual = (obj1, obj2) => {
  if (obj1 === obj2) return true;

  if (obj1 == null || obj2 == null) return obj1 === obj2;

  if (typeof obj1 !== typeof obj2) return false;

  if (typeof obj1 !== 'object') return obj1 === obj2;

  if (Array.isArray(obj1) !== Array.isArray(obj2)) return false;

  if (Array.isArray(obj1)) {
    if (obj1.length !== obj2.length) return false;
    for (let i = 0; i < obj1.length; i++) {
      if (!deepEqual(obj1[i], obj2[i])) return false;
    }
    return true;
  }

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  for (let key of keys1) {
    if (!keys2.includes(key)) return false;
    if (!deepEqual(obj1[key], obj2[key])) return false;
  }

  return true;
};

const hasChanges = (initialState, currentState) => {
  return !deepEqual(initialState, currentState);
};

// Location options for the autocomplete dropdown
const LOCATION_OPTIONS = [
  'EFS 101', 'EFS 102', 'EFS 103', 'EFS 104', 'EFS 105', 'EFS 106', 'EFS 107', 'EFS 108', 'EFS 109', 'EFS 110',
  'EFS 201', 'EFS 202', 'EFS 203', 'EFS 204', 'EFS 205', 'EFS 206', 'EFS 207', 'EFS 208', 'EFS 209', 'EFS 210',
  'EFS 301', 'EFS 302', 'EFS 303', 'EFS 304', 'EFS 305', 'EFS 306', 'EFS 307', 'EFS 308', 'EFS 309', 'EFS 310',
  'EFS 401', 'EFS 402', 'EFS 403', 'EFS 404', 'EFS 405', 'EFS 406', 'EFS 407', 'EFS 408', 'EFS 409', 'EFS 410',
  'DSR 101', 'DSR 102', 'DSR 103', 'DSR 104', 'DSR 105', 'DSR 106', 'DSR 107', 'DSR 108', 'DSR 109', 'DSR 110',
  'DSR 201', 'DSR 202', 'DSR 203', 'DSR 204', 'DSR 205', 'DSR 206', 'DSR 207', 'DSR 208', 'DSR 209', 'DSR 210',
  'DSR 301', 'DSR 302', 'DSR 303', 'DSR 304', 'DSR 305', 'DSR 306', 'DSR 307', 'DSR 308', 'DSR 309', 'DSR 310',
  'DSR 401', 'DSR 402', 'DSR 403', 'DSR 404', 'DSR 405', 'DSR 406', 'DSR 407', 'DSR 408', 'DSR 409', 'DSR 410',
  'COMLAB A', 'COMLAB B', 'Physics Room', 'IC Room'
];

// Service Display Component with Tooltip
const ServiceDisplay = ({ services, totalServices, isPriority = false }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const handleMouseEnter = (e) => {
    setTooltipPosition({ x: e.clientX, y: e.clientY });
    setShowTooltip(true);
  };

  const handleMouseMove = (e) => {
    setTooltipPosition({ x: e.clientX, y: e.clientY });
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
  };

  const getDisplayText = () => {
    if (!services || services.length === 0) {
      return 'No services assigned';
    }

    // If priority window or all services assigned
    if (isPriority || services.length === totalServices) {
      return 'All';
    }

    // If 1 service only, display normally
    if (services.length === 1) {
      return services[0]?.name || 'Unknown Service';
    }

    // If 2+ services, show first service and count
    const firstName = services[0]?.name || 'Unknown Service';
    const remaining = services.length - 1;
    return `${firstName} and ${remaining} more`;
  };

  const getAllServicesText = () => {
    if (!services || services.length === 0) {
      return 'No services assigned';
    }
    return services.map(service => service?.name || 'Unknown Service').join(', ');
  };

  return (
    <div className="relative">
      <div
        className="font-medium text-sm text-gray-900 cursor-pointer"
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {getDisplayText()}
      </div>

      {/* Tooltip */}
      {showTooltip && services && services.length > 0 && (
        <div
          className="fixed z-50 bg-[#1F3463] text-white text-xs px-2.5 py-1.5 rounded-lg shadow-lg max-w-xs break-words pointer-events-none"
          style={{
            left: tooltipPosition.x + 10,
            top: tooltipPosition.y - 10,
            transform: 'translateY(-100%)'
          }}
        >
          <div className="font-medium mb-0.5">Assigned Services:</div>
          <div>{getAllServicesText()}</div>
          {/* Arrow */}
          <div
            className="absolute top-full left-3 w-0 h-0 border-l-3 border-r-3 border-t-3 border-transparent border-t-[#1F3463]"
          />
        </div>
      )}
    </div>
  );
};

// Location Autocomplete Component
const LocationAutocomplete = ({
  value,
  onChange,
  onSave,
  disabled,
  isUpdating,
  placeholder = "Enter office location...",
  initialValue = '',
  showWarning
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState([]);

  // Filter options based on input
  useEffect(() => {
    if (value.trim()) {
      const filtered = LOCATION_OPTIONS.filter(option =>
        option.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredOptions(filtered);
    } else {
      setFilteredOptions([]);
    }
  }, [value]);

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    onChange(newValue);
    setIsOpen(newValue.trim().length > 0);
  };

  const handleOptionSelect = (option) => {
    onChange(option);
    setIsOpen(false);
  };

  const handleInputFocus = () => {
    if (value.trim()) {
      setIsOpen(true);
    }
  };

  const handleInputBlur = () => {
    // Delay closing to allow option selection
    setTimeout(() => setIsOpen(false), 150);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSave();
      setIsOpen(false);
    }
  };

  const handleSave = () => {
    // Check if there are any changes
    const trimmedValue = value.trim();
    const trimmedInitial = initialValue.trim();

    if (trimmedValue === trimmedInitial) {
      showWarning('No Changes Detected', 'The location has not been modified.');
      return;
    }

    onSave();
  };

  return (
    <div className="relative flex items-center">
      <MdLocationOn className="absolute left-2.5 text-gray-500 text-base z-10" />
      <div className="relative flex-1">
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          className={`w-full pl-8 pr-6 py-1.5 text-sm rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
            disabled ? 'bg-gray-100 cursor-not-allowed' : ''
          }`}
          style={{ backgroundColor: disabled ? '#f3f4f6' : '#efefef' }}
          disabled={disabled || isUpdating}
        />
        {!disabled && filteredOptions.length > 0 && (
          <MdKeyboardArrowDown
            className={`absolute right-2.5 top-1/2 transform -translate-y-1/2 text-sm text-gray-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        )}

        {/* Dropdown */}
        {isOpen && filteredOptions.length > 0 && !disabled && (
          <div className="absolute top-full left-0 right-0 mt-0.5 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto z-20">
            {filteredOptions.map((option, index) => (
              <motion.button
                key={index}
                onClick={() => handleOptionSelect(option)}
                className="w-full text-left text-sm px-3 py-1.5 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none transition-colors duration-150"
                whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
                whileTap={{ scale: 0.98, transition: { duration: 0.15 } }}
              >
                {option}
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* Save Button - Positioned outside on the right */}
      <motion.button
        onClick={handleSave}
        disabled={isUpdating || !value.trim() || disabled || value.trim() === initialValue.trim()}
        className={`ml-2.5 px-3 py-1.5 text-xs rounded-full transition-colors ${
          isUpdating || !value.trim() || disabled || value.trim() === initialValue.trim()
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-[#1F3463] text-white hover:opacity-90'
        }`}
        whileHover={!(isUpdating || !value.trim() || disabled || value.trim() === initialValue.trim()) ? { scale: 1.02, transition: { duration: 0.2 } } : undefined}
        whileTap={!(isUpdating || !value.trim() || disabled || value.trim() === initialValue.trim()) ? { scale: 0.95, transition: { duration: 0.15 } } : undefined}
      >
        {isUpdating ? 'Saving...' : 'Save'}
      </motion.button>
    </div>
  );
};

// Add/Edit Window Modal Component - Moved outside to prevent re-creation on every render
const AddEditWindowModal = ({
  isOpen,
  onClose,
  windowFormData,
  onFormChange,
  onSave,
  services,
  windows,
  adminUsers,
  adminUsersLoading,
  isEditing,
  errors = {},
  initialFormData = { name: '', serviceIds: [], assignedAdmin: '', isPriority: false },
  showWarning
}) => {
  if (!isOpen) return null;

  // Check if there are changes in the form data
  const hasFormChanges = () => {
    return hasChanges(initialFormData, windowFormData);
  };

  const handleSave = () => {
    if (!hasFormChanges()) {
      showWarning('No Changes Detected', 'The window configuration has not been modified.');
      return;
    }
    onSave();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-3">
        <div
          className="relative bg-white rounded-xl shadow-xl w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <motion.button
            onClick={onClose}
            className="absolute -top-1.5 -right-1.5 z-10 w-6 h-6 bg-[#1F3463] border-2 border-white rounded-full flex items-center justify-center text-white hover:bg-opacity-90 transition-colors"
            whileHover={{ scale: 1.1, transition: { duration: 0.2 } }}
            whileTap={{ scale: 0.9, transition: { duration: 0.15 } }}
          >
            <MdClose className="w-3 h-3" />
          </motion.button>

          {/* Row 1: Header */}
          <div className="p-5">
            <h3 className="text-lg font-semibold text-gray-900">
              Adjusting Windows
            </h3>
          </div>

          {/* Modal Content */}
          <div className="p-5 space-y-5">
            {/* Row 2: Window Name */}
            <div>
              <label className="block text-xs font-medium text-gray-900 mb-1.5">
                Name for Window
              </label>
              <input
                type="text"
                value={windowFormData.name}
                onChange={(e) => onFormChange('name', e.target.value)}
                disabled={windowFormData.isPriority}
                className={`w-full px-2.5 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${
                  windowFormData.isPriority
                    ? 'bg-gray-100 cursor-not-allowed border-gray-300'
                    : errors.name
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                placeholder="Enter window name"
              />
              {errors.name && (
                <p className="mt-0.5 text-xs text-red-600">{errors.name}</p>
              )}
            </div>

            {/* Priority Checkbox */}
            <div>
              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={windowFormData.isPriority}
                  onChange={(e) => onFormChange('isPriority', e.target.checked)}
                  className="w-3 h-3 text-[#1F3463] border-gray-300 rounded focus:ring-[#1F3463] focus:ring-2"
                />
                <span className="text-xs font-medium text-gray-900">
                  Set as Priority
                </span>
              </label>
              <p className="mt-0.5 text-[10px] text-gray-500">
                Priority windows automatically serve all services and handle PWD/Senior Citizen queues
              </p>
            </div>

            {/* Row 3: Service Selection */}
            <div>
              <label className="block text-xs font-medium text-gray-900 mb-1.5">
                Services <span className="text-red-500">*</span>
                {windowFormData.isPriority && (
                  <span className="ml-1.5 text-[10px] text-gray-500">(All services auto-assigned for Priority window)</span>
                )}
              </label>
              <div className={`border rounded-lg p-2.5 max-h-32 overflow-y-auto ${
                windowFormData.isPriority
                  ? 'bg-gray-50 border-gray-300'
                  : errors.serviceIds
                  ? 'border-red-500'
                  : 'border-gray-300'
              }`}>
                {windowFormData.isPriority ? (
                  <div className="text-center py-3">
                    <p className="text-xs text-gray-600 font-medium">All Services Assigned</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Priority windows automatically handle all available services</p>
                  </div>
                ) : services.length === 0 ? (
                  <p className="text-gray-500 text-xs">No services available</p>
                ) : (
                  <div className="space-y-1.5">
                    {(services || []).map((service) => {
                      // Check if service is assigned to another window (excluding current window being edited)
                      const assignedToOtherWindow = (windows || []).find(window => {
                        // Skip the current window being edited
                        if (isEditing && window.id === windowFormData.id) return false;

                        return window.serviceIds && window.serviceIds.some(s =>
                          (s._id === service.id || s === service.id)
                        );
                      });

                      const isCurrentlyAssigned = windowFormData.serviceIds.includes(service.id);
                      const isDisabled = assignedToOtherWindow && !isCurrentlyAssigned;

                      return (
                        <label key={service.id} className={`flex items-center space-x-1.5 ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={isCurrentlyAssigned}
                            disabled={isDisabled}
                            onChange={(e) => {
                              const currentServices = windowFormData.serviceIds;
                              if (e.target.checked) {
                                onFormChange('serviceIds', [...currentServices, service.id]);
                              } else {
                                onFormChange('serviceIds', currentServices.filter(id => id !== service.id));
                              }
                            }}
                            className={`w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500 ${
                              isDisabled ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                          />
                          <div className="flex items-center space-x-1.5 flex-1">
                            <span className={`text-xs ${isDisabled ? 'text-gray-400' : 'text-gray-900'}`}>
                              {service.name}
                            </span>
                            {assignedToOtherWindow && (
                              <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                                Assigned to {assignedToOtherWindow.name}
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              {errors.serviceIds && (
                <p className="mt-0.5 text-xs text-red-600">{errors.serviceIds}</p>
              )}
            </div>

            {/* Row 4: Assigned Admin */}
            <div>
              <label className="block text-xs font-medium text-gray-900 mb-1.5">
                Assigned Admin <span className="text-red-500">*</span>
              </label>
              <select
                value={windowFormData.assignedAdmin}
                onChange={(e) => onFormChange('assignedAdmin', e.target.value)}
                className={`w-full px-2.5 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${
                  errors.assignedAdmin
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                disabled={adminUsersLoading}
              >
                <option value="">
                  {adminUsersLoading ? 'Loading admins...' : 'Select an admin'}
                </option>
                {(adminUsers || []).map((admin) => (
                  <option key={admin._id} value={admin._id}>
                    {admin.name} ({admin.email})
                  </option>
                ))}
              </select>
              {errors.assignedAdmin && (
                <p className="mt-0.5 text-xs text-red-600">{errors.assignedAdmin}</p>
              )}
            </div>

            {/* Row 5: Action Buttons */}
            <div className="flex space-x-2.5">
              <motion.button
                onClick={handleSave}
                disabled={!hasFormChanges()}
                className={`flex-1 flex items-center justify-center space-x-1.5 p-2.5 text-sm rounded-lg transition-colors ${
                  !hasFormChanges()
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'text-white hover:opacity-90'
                }`}
                style={{ backgroundColor: !hasFormChanges() ? undefined : '#1F3463' }}
                whileHover={hasFormChanges() ? { scale: 1.02, transition: { duration: 0.2 } } : undefined}
                whileTap={hasFormChanges() ? { scale: 0.95, transition: { duration: 0.15 } } : undefined}
              >
                <span className="font-medium">Save</span>
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Add/Edit Service Modal Component - Moved outside to prevent re-creation on every render
const AddEditServiceModal = ({
  isOpen,
  onClose,
  serviceFormData,
  onFormChange,
  onSave,
  errors = {},
  initialFormData = { name: '', id: '' },
  isEditing = false,
  showWarning
}) => {
  if (!isOpen) return null;

  // Check if there are changes in the form data
  const hasFormChanges = () => {
    return hasChanges(initialFormData, serviceFormData);
  };

  const handleSave = () => {
    if (!hasFormChanges()) {
      showWarning('No Changes Detected', 'The service information has not been modified.');
      return;
    }
    onSave();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-3">
        <div
          className="relative bg-white rounded-xl shadow-xl w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <motion.button
            onClick={onClose}
            className="absolute -top-1.5 -right-1.5 z-10 w-6 h-6 bg-[#1F3463] border-2 border-white rounded-full flex items-center justify-center text-white hover:bg-opacity-90 transition-colors"
            whileHover={{ scale: 1.1, transition: { duration: 0.2 } }}
            whileTap={{ scale: 0.9, transition: { duration: 0.15 } }}
          >
            <MdClose className="w-3 h-3" />
          </motion.button>

          {/* Row 1: Header */}
          <div className="p-5">
            <h3 className="text-lg font-semibold text-gray-900">
              {isEditing ? 'Editing Service' : 'Adding Service'}
            </h3>
          </div>

          {/* Modal Content */}
          <div className="p-5 space-y-5">
            {/* Row 2: Service Name */}
            <div>
              <label className="block text-xs font-medium text-gray-900 mb-1.5">
                Name of the Service
              </label>
              <input
                type="text"
                value={serviceFormData.name}
                onChange={(e) => onFormChange('name', e.target.value)}
                className={`w-full px-2.5 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${
                  errors.name
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                placeholder="Enter service name"
              />
              {errors.name && (
                <p className="mt-0.5 text-xs text-red-600">{errors.name}</p>
              )}
            </div>

            {/* Row 3: Save Button */}
            <motion.button
              onClick={handleSave}
              disabled={!hasFormChanges()}
              className={`w-full flex items-center justify-center space-x-1.5 p-2.5 text-sm rounded-lg transition-colors ${
                !hasFormChanges()
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'text-white hover:opacity-90'
              }`}
              style={{ backgroundColor: !hasFormChanges() ? undefined : '#1F3463' }}
              whileHover={hasFormChanges() ? { scale: 1.02, transition: { duration: 0.2 } } : undefined}
              whileTap={hasFormChanges() ? { scale: 0.95, transition: { duration: 0.15 } } : undefined}
            >
              <span className="font-medium">Save</span>
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Settings = () => {
  const { socket, isConnected, joinRoom, leaveRoom, subscribe } = useSocket();

  // State management
  const [isQueueingEnabled, setIsQueueingEnabled] = useState(false);
  const [locationText, setLocationText] = useState('');
  const [windowLocationSearch, setWindowLocationSearch] = useState(''); // For window-specific location search
  const [services, setServices] = useState([]);
  const [windows, setWindows] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);

  // Toggle queueing state management
  const [isToggling, setIsToggling] = useState(false);
  const [toggleCooldown, setToggleCooldown] = useState(0);

  // Location update state management
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);

  // Scroll detection for windows container
  const [isWindowsScrollable, setIsWindowsScrollable] = useState(false);
  const windowsContainerRef = useRef(null);

  // Initial state tracking for change detection
  const [initialState, setInitialState] = useState({
    isQueueingEnabled: false,
    locationText: '',
    services: [],
    windows: [],
    windowFormData: { name: '', serviceIds: [], assignedAdmin: '', isPriority: false },
    serviceFormData: { name: '', id: '' }
  });

  // Notifications (saves to database)
  const { toasts, removeToast, showSuccess, showError, showWarning } = useNotification();

  // Join Socket.io room and listen for real-time updates
  useEffect(() => {
    if (!socket || !isConnected) return;

    console.log('🔌 Admissions Settings: Joining admin-admissions room');
    joinRoom('admin-admissions');

    // Subscribe to settings updates
    const unsubscribeSettings = subscribe('settings-updated', (data) => {
      if (data.department === 'admissions' && data.type === 'queue-toggle') {
        setIsQueueingEnabled(data.data.isEnabled);
        showSuccess(
          'Queue System Updated',
          `Queue system has been ${data.data.isEnabled ? 'enabled' : 'disabled'}`
        );
      }
    });

    // Subscribe to services updates
    const unsubscribeServices = subscribe('services-updated', (data) => {
      if (data.department === 'admissions') {
        fetchServices();
        if (data.type === 'service-added') {
          showSuccess('Service Added', `${data.data.name} has been added`);
        } else if (data.type === 'service-updated') {
          showSuccess('Service Updated', `${data.data.name} has been updated`);
        } else if (data.type === 'service-deleted') {
          showSuccess('Service Removed', 'Service has been removed');
        }
      }
    });

    // Subscribe to windows updates
    const unsubscribeWindows = subscribe('windows-updated', (data) => {
      if (data.department === 'admissions') {
        fetchWindows();
        if (data.type === 'window-added') {
          showSuccess('Window Added', `${data.data.name} has been added`);
        } else if (data.type === 'window-deleted') {
          showSuccess('Window Removed', 'Window has been removed');
        }
      }
    });

    return () => {
      unsubscribeSettings();
      unsubscribeServices();
      unsubscribeWindows();
      leaveRoom('admin-admissions');
    };
  }, [socket, isConnected]);

  // Fetch initial data
  useEffect(() => {
    fetchAllData();
  }, []);

  // Check if windows container is scrollable
  useEffect(() => {
    const checkScrollable = () => {
      if (windowsContainerRef.current) {
        const container = windowsContainerRef.current;
        const isScrollable = container.scrollHeight > container.clientHeight;
        setIsWindowsScrollable(isScrollable);
      }
    };

    // Check initially and after windows/loading changes
    checkScrollable();

    // Use ResizeObserver to detect size changes
    const resizeObserver = new ResizeObserver(checkScrollable);
    if (windowsContainerRef.current) {
      resizeObserver.observe(windowsContainerRef.current);
    }

    // Also check on window resize
    window.addEventListener('resize', checkScrollable);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', checkScrollable);
    };
  }, [windows, loading]);

  // API functions
  const fetchAllData = async () => {
    setLoading(true);
    try {
      // Fetch all data and capture responses directly
      const [queueData, servicesData, windowsData, , locationData] = await Promise.all([
        fetchQueueSettings(),
        fetchServices(),
        fetchWindows(),
        fetchAdminUsers(),
        fetchLocationSettings()
      ]);

      // Capture initial state directly from API responses to avoid stale state issues
      setInitialState(prev => ({
        ...prev,
        isQueueingEnabled: queueData?.isEnabled ?? false,
        locationText: locationData?.location ?? '',
        services: servicesData ? [...servicesData] : [],
        windows: windowsData ? [...windowsData] : []
      }));
    } catch (error) {
      showError('Error', 'Failed to load settings data');
    } finally {
      setLoading(false);
    }
  };

  const fetchQueueSettings = async () => {
    try {
      const response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/settings/queue/admissions`);
      if (response.ok) {
        const data = await response.json();
        setIsQueueingEnabled(data.isEnabled);
        return data; // Return data for initial state capture
      }
    } catch (error) {
      console.error('Error fetching queue settings:', error);
    }
    return null;
  };

  const fetchServices = async () => {
    try {
      const response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/services/admissions`);
      if (response.ok) {
        const data = await response.json();
        setServices(data);
        return data; // Return data for initial state capture
      }
    } catch (error) {
      console.error('Error fetching services:', error);
    }
    return null;
  };

  const fetchWindows = async () => {
    try {
      const response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/windows/admissions`);
      if (response.ok) {
        const data = await response.json();
        setWindows(data);
        return data; // Return data for initial state capture
      }
    } catch (error) {
      console.error('Error fetching windows:', error);
    }
    return null;
  };

  // Modal states
  const [showAddEditWindowModal, setShowAddEditWindowModal] = useState(false);
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [editingWindow, setEditingWindow] = useState(null);
  const [editingService, setEditingService] = useState(null);

  // Form states for Add/Edit Window Modal
  const [windowFormData, setWindowFormData] = useState({
    name: '',
    serviceIds: [],
    assignedAdmin: '',
    isPriority: false
  });

  // Form state for Add/Edit Service Modal
  const [serviceFormData, setServiceFormData] = useState({
    name: '',
    id: ''
  });

  // Error states for form validation
  const [windowErrors, setWindowErrors] = useState({});
  const [serviceErrors, setServiceErrors] = useState({});

  // Confirmation modal states
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalConfig, setConfirmModalConfig] = useState({
    title: '',
    message: '',
    onConfirm: null,
    type: 'warning'
  });

  // Fetch admin users for dropdown
  const fetchAdminUsers = async () => {
    try {
      setAdminUsersLoading(true);
      // Fetch users with Admissions office (both Admin and Admin Staff)
      const response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/users?office=Admissions&isActive=true&role=Admissions Admin,Admissions Admin Staff`);
      if (response.ok) {
        const result = await response.json();
        const data = result.success ? result.data : [];
        setAdminUsers(data);
      } else {
        console.error('Failed to fetch admin users');
        showError('Error', 'Failed to load admin users');
      }
    } catch (error) {
      console.error('Error fetching admin users:', error);
      showError('Error', 'Failed to load admin users');
    } finally {
      setAdminUsersLoading(false);
    }
  };

  const fetchLocationSettings = async () => {
    try {
      const response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/settings/location/admissions`);
      if (response.ok) {
        const data = await response.json();
        setLocationText(data.location || '');
        return data; // Return data for initial state capture
      }
    } catch (error) {
      console.error('Error fetching location settings:', error);
    }
    return null;
  };

  const handleToggleQueueing = async () => {
    // Prevent multiple rapid toggles
    if (isToggling || toggleCooldown > 0) {
      showWarning('Please Wait', 'Toggle operation in progress. Please wait before trying again.');
      return;
    }

    try {
      setIsToggling(true);
      const newState = !isQueueingEnabled;

      const response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/settings/queue/admissions/toggle`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isEnabled: newState }),
      });

      if (response.ok) {
        const data = await response.json();
        setIsQueueingEnabled(data.isEnabled);
        showSuccess(
          'Queue System Updated',
          `Queue system has been ${data.isEnabled ? 'enabled' : 'disabled'}`
        );

        // Set cooldown period to prevent rapid toggles
        setToggleCooldown(3); // 3 second cooldown
        const cooldownInterval = setInterval(() => {
          setToggleCooldown(prev => {
            if (prev <= 1) {
              clearInterval(cooldownInterval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

      } else {
        throw new Error('Failed to update queue system');
      }
    } catch (error) {
      showError('Error', 'Failed to update queue system');
      console.error('Error toggling queue system:', error);
    } finally {
      setIsToggling(false);
    }
  };

  const handleLocationUpdate = async () => {
    if (isUpdatingLocation || !locationText.trim()) {
      return;
    }

    // Check for changes before proceeding
    const trimmedValue = locationText.trim();
    const trimmedInitial = initialState.locationText.trim();

    if (trimmedValue === trimmedInitial) {
      showWarning('No Changes Detected', 'The office location has not been modified.');
      return;
    }

    try {
      setIsUpdatingLocation(true);
      const response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/settings/location/admissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ location: trimmedValue }),
      });

      if (response.ok) {
        const data = await response.json();
        setLocationText(data.location);
        // Update initial state after successful save
        setInitialState(prev => ({ ...prev, locationText: data.location }));
        showSuccess('Location Updated', 'Office location has been updated successfully');
      } else {
        throw new Error('Failed to update location');
      }
    } catch (error) {
      showError('Error', 'Failed to update location');
      console.error('Error updating location:', error);
    } finally {
      setIsUpdatingLocation(false);
    }
  };

  // Modal handlers
  const openAddWindowModal = () => {
    if (isQueueingEnabled) {
      showError('Settings Locked', 'Cannot modify windows while queueing is active. Please disable queueing first.');
      return;
    }
    setEditingWindow(null);
    setWindowLocationSearch('');
    const newFormData = { name: '', serviceIds: [], assignedAdmin: '', isPriority: false };
    setWindowFormData(newFormData);
    setWindowErrors({});
    // Set initial state for change detection
    setInitialState(prev => ({ ...prev, windowFormData: newFormData }));
    setShowAddEditWindowModal(true);
  };

  const openEditWindowModal = (window) => {
    if (isQueueingEnabled) {
      showError('Settings Locked', 'Cannot modify windows while queueing is active. Please disable queueing first.');
      return;
    }
    setEditingWindow(window);
    setWindowLocationSearch(window.location || '');
    const editFormData = {
      id: window.id,
      name: window.name,
      serviceIds: (window.serviceIds || []).map(s => s._id || s),
      assignedAdmin: window.assignedAdmin?._id || window.assignedAdmin || '',
      isPriority: window.name === 'Priority' || false
    };
    setWindowFormData(editFormData);
    setWindowErrors({});
    // Set initial state for change detection
    setInitialState(prev => ({ ...prev, windowFormData: editFormData }));
    setShowAddEditWindowModal(true);
  };

  const closeAddEditWindowModal = () => {
    setShowAddEditWindowModal(false);
    setEditingWindow(null);
    setWindowLocationSearch('');
    setWindowFormData({ name: '', serviceIds: [], assignedAdmin: '', isPriority: false });
    setWindowErrors({});
  };

  const openAddServiceModal = () => {
    setEditingService(null);
    const newFormData = { name: '', id: '' };
    setServiceFormData(newFormData);
    setServiceErrors({});
    // Set initial state for change detection
    setInitialState(prev => ({ ...prev, serviceFormData: newFormData }));
    setShowAddServiceModal(true);
  };

  const openEditServiceModal = (service) => {
    if (isQueueingEnabled) {
      showError('Settings Locked', 'Cannot modify services while queueing is active. Please disable queueing first.');
      return;
    }
    setEditingService(service);
    const editFormData = {
      name: service.name,
      id: service.id
    };
    setServiceFormData(editFormData);
    setServiceErrors({});
    // Set initial state for change detection
    setInitialState(prev => ({ ...prev, serviceFormData: editFormData }));
    setShowAddServiceModal(true);
  };

  const closeAddServiceModal = () => {
    setShowAddServiceModal(false);
    setEditingService(null);
    setServiceFormData({ name: '', id: '' });
    setServiceErrors({});
  };

  // Form handlers
  const handleWindowFormChange = (field, value) => {
    if (field === 'isPriority') {
      if (value) {
        // When priority is checked, set name to "Priority" and assign all services
        const allServiceIds = services.map(service => service.id);
        setWindowFormData(prev => ({
          ...prev,
          [field]: value,
          name: 'Priority',
          serviceIds: allServiceIds
        }));
      } else {
        // When priority is unchecked, clear name and services
        setWindowFormData(prev => ({
          ...prev,
          [field]: value,
          name: '',
          serviceIds: []
        }));
      }
    } else {
      setWindowFormData(prev => ({ ...prev, [field]: value }));
    }

    // Clear error for this field when user starts typing
    if (windowErrors[field]) {
      setWindowErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleServiceFormChange = (field, value) => {
    setServiceFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (serviceErrors[field]) {
      setServiceErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSaveWindow = async () => {
    // Validate form and set inline errors
    const errors = {};

    if (!windowFormData.name?.trim()) {
      errors.name = 'Window name is required';
    }

    if (!windowFormData.serviceIds || windowFormData.serviceIds.length === 0) {
      errors.serviceIds = 'Please select at least one service';
    }

    if (!windowFormData.assignedAdmin) {
      errors.assignedAdmin = 'Please select an admin';
    }

    // Check for duplicate window names (case-insensitive)
    const windowName = windowFormData.name?.trim();
    if (windowName) {
      const isDuplicateName = windows.some(window =>
        window.name.toLowerCase() === windowName.toLowerCase() &&
        (!editingWindow || window.id !== editingWindow.id)
      );

      if (isDuplicateName) {
        errors.name = `Window '${windowName}' already exists. Please use a different name.`;
      }
    }

    // If there are errors, set them and show toast
    if (Object.keys(errors).length > 0) {
      setWindowErrors(errors);
      showError('Validation Error', 'Please fix the errors below and try again');
      return;
    }

    // Clear any existing errors
    setWindowErrors({});

    // No need to check for duplicate service assignments since each window has only one service

    try {
      if (editingWindow) {
        // Edit existing window
        const response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/windows/${editingWindow.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: windowFormData.name.trim(),
            serviceIds: windowFormData.serviceIds,
            assignedAdmin: windowFormData.assignedAdmin
          }),
        });

        if (response.ok) {
          const updatedWindow = await response.json();
          setWindows(prev => prev.map(window =>
            window.id === editingWindow.id ? updatedWindow : window
          ));
          showSuccess('Window Updated', `${updatedWindow.name} has been updated successfully`);
        } else {
          throw new Error('Failed to update window');
        }
      } else {
        // Add new window
        const response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/windows`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: windowFormData.name.trim(),
            office: 'admissions',
            serviceIds: windowFormData.serviceIds,
            assignedAdmin: windowFormData.assignedAdmin
          }),
        });

        if (response.ok) {
          const newWindow = await response.json();
          setWindows(prev => [...prev, newWindow]);
          showSuccess('Window Added', `${newWindow.name} has been added successfully`);
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to add window');
        }
      }

      closeAddEditWindowModal();
    } catch (error) {
      showError('Error', error.message);
      console.error('Error saving window:', error);
    }
  };

  const handleSaveService = async () => {
    // Validate form and set inline errors
    const errors = {};

    if (!serviceFormData.name?.trim()) {
      errors.name = 'Service name is required';
    }

    // Check for duplicate service names (case-insensitive)
    const serviceName = serviceFormData.name?.trim();
    if (serviceName) {
      const isDuplicate = services.some(service =>
        service.name.toLowerCase() === serviceName.toLowerCase() &&
        (!editingService || service.id !== editingService.id)
      );

      if (isDuplicate) {
        errors.name = `Service '${serviceName}' already exists. Please use a different name.`;
      }
    }

    // If there are errors, set them and show toast
    if (Object.keys(errors).length > 0) {
      setServiceErrors(errors);
      showError('Validation Error', 'Please fix the errors below and try again');
      return;
    }

    // Clear any existing errors
    setServiceErrors({});

    try {
      if (editingService) {
        // Edit existing service
        const response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/services/${editingService.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: serviceName
          }),
        });

        if (response.ok) {
          const updatedService = await response.json();
          setServices(prev => prev.map(service =>
            service.id === editingService.id ? updatedService : service
          ));
          closeAddServiceModal();
          showSuccess('Service Updated', `${updatedService.name} has been updated successfully`);
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update service');
        }
      } else {
        // Add new service
        const response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/services`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: serviceName,
            office: 'admissions'
          }),
        });

        if (response.ok) {
          const newService = await response.json();
          setServices(prev => [...prev, newService]);
          closeAddServiceModal();
          showSuccess('Service Added', `${newService.name} has been added successfully`);
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to add service');
        }
      }
    } catch (error) {
      showError('Error', error.message);
      console.error(`Error ${editingService ? 'updating' : 'adding'} service:`, error);
    }
  };

  const handleAddService = () => {
    if (isQueueingEnabled) {
      showError('Settings Locked', 'Cannot modify services while queueing is active. Please disable queueing first.');
      return;
    }
    openAddServiceModal();
  };

  const handleToggleServiceVisibility = async (serviceId, currentActive) => {
    try {
      const response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/services/${serviceId}/toggle`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const updatedService = await response.json();
        setServices(prev => prev.map(service =>
          service.id === serviceId ? updatedService : service
        ));
        showSuccess(
          'Service Updated',
          `${updatedService.name} is now ${updatedService.isActive ? 'active' : 'inactive'}`
        );
      } else {
        throw new Error('Failed to update service status');
      }
    } catch (error) {
      showError('Error', 'Failed to update service status');
      console.error('Error toggling service status:', error);
    }
  };


  const handleToggleWindow = async (windowId) => {
    try {
      const response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/windows/${windowId}/toggle`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const updatedWindow = await response.json();
        setWindows(prev => prev.map(window =>
          window.id === windowId ? { ...window, isOpen: updatedWindow.isOpen } : window
        ));
        showSuccess('Window Updated', `${updatedWindow.name} is now ${updatedWindow.isOpen ? 'open' : 'closed'}`);
      } else {
        throw new Error('Failed to toggle window');
      }
    } catch (error) {
      showError('Error', 'Failed to toggle window status');
      console.error('Error toggling window:', error);
    }
  };

  const handleConfigureWindow = (windowId) => {
    const window = windows.find(w => w.id === windowId);
    if (window) {
      openEditWindowModal(window);
    }
  };


  if (loading) {
    return (
      <div className="space-y-5">
        {/* Settings Management Grid Skeleton */}
        <div className="grid gap-3 h-[calc(100vh-10rem)] bg-white p-5 border border-gray-200" style={{ gridTemplateColumns: '1fr 2fr', gridTemplateRows: 'auto auto 1fr 1fr' }}>
          {/* Header Skeleton */}
          <div className="col-span-2 row-span-1 bg-white rounded-xl p-5">
            <div className="grid grid-cols-2 gap-3 items-center">
              <div>
                <div className="h-8 bg-gray-200 rounded w-64 animate-pulse"></div>
              </div>
              <div className="flex justify-end">
                <div className="h-12 bg-gray-200 rounded-lg w-52 animate-pulse"></div>
              </div>
            </div>
          </div>

          {/* Toggle Section Skeleton */}
          <div className="col-span-1 row-span-1 bg-white rounded-xl border border-gray-300 shadow-md p-5">
            <div className="flex items-center justify-between">
              <div className="flex flex-col space-y-1.5">
                <div className="h-5 bg-gray-200 rounded w-40 animate-pulse"></div>
                <div className="h-3 bg-gray-200 rounded w-24 animate-pulse"></div>
              </div>
              <div className="w-14 h-7 bg-gray-200 rounded-full animate-pulse"></div>
            </div>
          </div>

          {/* Services Section Skeleton */}
          <div className="col-start-1 row-start-3 row-span-2 bg-white rounded-xl border border-gray-300 shadow-md p-5">
            <div className="h-full flex flex-col">
              <div className="h-6 bg-gray-200 rounded w-20 mb-3 animate-pulse"></div>
              <div className="flex-1 space-y-1.5 mb-3">
                {[...Array(5)].map((_, index) => (
                  <div key={index} className="p-2.5 bg-gray-50 rounded-lg border border-gray-200 animate-pulse">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div className="h-3 bg-gray-200 rounded w-24"></div>
                        <div className="h-4 bg-gray-200 rounded-full w-12"></div>
                      </div>
                      <div className="w-6 h-6 bg-gray-200 rounded-lg"></div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="h-10 bg-gray-200 rounded-lg animate-pulse"></div>
            </div>
          </div>

          {/* Windows Section Skeleton */}
          <div className="col-start-2 row-start-2 row-span-3 bg-white rounded-xl border border-gray-300 shadow-md p-5">
            <div className="mb-3">
              <div className="grid grid-cols-3 gap-3 items-center p-2.5">
                <div className="h-5 bg-gray-200 rounded w-12 animate-pulse"></div>
                <div className="h-5 bg-gray-200 rounded w-24 animate-pulse"></div>
                <div className="h-8 bg-gray-200 rounded-lg animate-pulse"></div>
              </div>
            </div>
            <div className="flex-1 flex flex-col space-y-2.5">
              {[...Array(4)].map((_, index) => (
                <div key={index} className="grid grid-cols-3 gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 animate-pulse">
                  <div className="flex items-center">
                    <div className="h-3 bg-gray-200 rounded w-16"></div>
                  </div>
                  <div className="flex flex-col justify-center space-y-0.5">
                    <div className="h-3 bg-gray-200 rounded w-20"></div>
                    <div className="h-2.5 bg-gray-200 rounded w-24"></div>
                  </div>
                  <div className="flex items-center justify-center space-x-0.5">
                    <div className="w-6 h-6 bg-gray-200 rounded-lg"></div>
                    <div className="w-6 h-6 bg-gray-200 rounded-lg"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">


      {/* Settings Management Grid Container - with visible background, rounded corners, and padding */}
      <div className="flex flex-col lg:grid gap-2 sm:gap-2.5 md:gap-3 min-h-[calc(100vh-10rem)] lg:h-[calc(100vh-10rem)] bg-white p-3 sm:p-4 md:p-5 border border-gray-200" style={{ gridTemplateColumns: '1fr 2fr', gridTemplateRows: 'auto auto 1fr 1fr' }}>
        {/* First div: Row 1, spanning both columns */}
        <div className="lg:col-span-2 lg:row-span-1 bg-white rounded-xl sm:rounded-2xl px-3 sm:px-4 md:px-5 py-1 sm:py-1.5 md:py-2">
          <div className="flex flex-col lg:grid lg:grid-cols-3 gap-2 sm:gap-2.5 md:gap-3 items-start lg:items-center">
            {/* Column 1: Settings Management heading */}
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">Settings Management</h1>
            </div>

            {/* Column 2: Queue Monitor Button */}
            <div className="flex justify-start lg:justify-center w-full lg:w-auto">
              <motion.button
                onClick={() => window.open('/admin/admissions/queue-monitor', '_blank')}
                className="bg-[#1F3463] hover:bg-[#2F4573] text-white px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors duration-200 flex items-center space-x-1 sm:space-x-1.5"
                whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
                whileTap={{ scale: 0.95, transition: { duration: 0.15 } }}
              >
                <MdMonitor className="text-base sm:text-lg" />
                <span>Open Queue Monitor</span>
              </motion.button>
            </div>

            {/* Column 3: Warning banner when queueing is enabled */}
            <div className="flex justify-start lg:justify-end w-full lg:w-auto">
              {isQueueingEnabled && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 sm:p-2.5 flex items-center space-x-1 sm:space-x-1.5 max-w-md">
                  <div className="flex-shrink-0">
                    <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[9px] sm:text-[10px] font-medium text-yellow-800">Settings Locked</h3>
                    <p className="text-[9px] sm:text-[10px] text-yellow-700">
                      Management disabled while queueing is active.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Second div: Row 2, Column 1 only - Toggle Section */}
        <div className="lg:col-span-1 lg:row-span-1 bg-white rounded-xl sm:rounded-2xl border border-gray-300 shadow-md p-3 sm:p-4 md:p-5 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm sm:text-base font-medium text-gray-900">Tap to Enable Queueing</span>
            {(isToggling || toggleCooldown > 0) && (
              <span className="text-[10px] sm:text-xs text-gray-500 mt-0.5">
                {isToggling ? 'Processing...' : `Wait ${toggleCooldown}s before next toggle`}
              </span>
            )}
          </div>
          <button
            onClick={handleToggleQueueing}
            disabled={isToggling || toggleCooldown > 0}
            className={`relative inline-flex h-6 w-12 sm:h-7 sm:w-14 items-center rounded-full transition-colors focus:outline-none ${
              isToggling || toggleCooldown > 0
                ? 'opacity-50 cursor-not-allowed bg-gray-300'
                : isQueueingEnabled
                ? 'bg-[#1F3463]'
                : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 sm:h-5 sm:w-5 transform rounded-full bg-white transition-transform ${
                isQueueingEnabled ? 'translate-x-7 sm:translate-x-8' : 'translate-x-1'
              }`}
            />
            {isToggling && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </button>
        </div>

        {/* Third div: Column 1, spanning rows 3-4 - Services Section */}
        <div className="lg:col-span-1 lg:row-span-2 bg-white rounded-xl sm:rounded-2xl border border-gray-300 shadow-md p-3 sm:p-4 md:p-5 flex flex-col">
          {/* Row 1: Header */}
          <div className="mb-2 sm:mb-2.5 md:mb-3">
            <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900">Services</h2>
          </div>

          {/* Row 2: Content Area - Scrollable */}
          <div className="flex-1 overflow-y-auto mb-2 sm:mb-2.5 md:mb-3 space-y-1 sm:space-y-1.5">
            {loading ? (
              <div className="flex items-center justify-center py-4 sm:py-5 md:py-6">
                <div className="animate-spin rounded-full h-5 w-5 sm:h-6 sm:w-6 border-b-2 border-[#1F3463]"></div>
              </div>
            ) : services.length === 0 ? (
              <div className="text-center py-4 sm:py-5 md:py-6 text-xs sm:text-sm text-gray-500">
                No services available. Add a service to get started.
              </div>
            ) : (
              (services || []).map((service) => (
                <div
                  key={service.id}
                  className="p-2 sm:p-2.5 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center space-x-1.5 sm:space-x-2 md:space-x-2.5">
                    <span className="text-xs sm:text-sm text-gray-900 font-medium">{service.name}</span>
                    {!service.isActive && (
                      <span className="px-1 sm:px-1.5 py-0.5 text-[9px] sm:text-[10px] bg-gray-200 text-gray-600 rounded-full">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-1 sm:space-x-1.5">
                    <motion.button
                      onClick={() => openEditServiceModal(service)}
                      disabled={isQueueingEnabled}
                      className={`p-0.5 sm:p-1 rounded-lg transition-colors ${
                        isQueueingEnabled
                          ? 'opacity-50 cursor-not-allowed text-gray-400'
                          : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                      }`}
                      title={
                        isQueueingEnabled
                          ? 'Cannot edit services while queueing is active'
                          : 'Edit Service'
                      }
                      whileHover={!isQueueingEnabled ? { scale: 1.1, transition: { duration: 0.2 } } : undefined}
                      whileTap={!isQueueingEnabled ? { scale: 0.9, transition: { duration: 0.15 } } : undefined}
                    >
                      <FiEdit3 className="text-sm sm:text-base" />
                    </motion.button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Row 3: Add Button */}
          <motion.button
            onClick={handleAddService}
            disabled={isQueueingEnabled}
            className={`flex items-center justify-center space-x-1 sm:space-x-1.5 p-2 sm:p-2.5 text-xs sm:text-sm text-white rounded-lg transition-colors ${
              isQueueingEnabled
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:opacity-90'
            }`}
            style={{ backgroundColor: '#1F3463' }}
            title={isQueueingEnabled ? 'Cannot add services while queueing is active' : 'Add Service'}
            whileHover={!isQueueingEnabled ? { scale: 1.02, transition: { duration: 0.2 } } : undefined}
            whileTap={!isQueueingEnabled ? { scale: 0.95, transition: { duration: 0.15 } } : undefined}
          >
            <MdAdd className="text-base sm:text-lg" />
            <span className="font-medium">Add Service</span>
          </motion.button>
        </div>

        {/* Fourth div: Column 2, spanning rows 2-4 - Windows Management Section */}
        <div className="lg:col-start-2 lg:row-start-2 lg:row-span-3 bg-white rounded-xl sm:rounded-2xl border border-gray-300 shadow-md p-3 sm:p-4 md:p-5 flex flex-col">
          {/* Row 1: Table Header */}
          <div className="mb-2 sm:mb-2.5 md:mb-3">
            <div className="hidden md:grid md:grid-cols-3 gap-2 sm:gap-2.5 md:gap-3 items-center p-2 sm:p-2.5">
              <div className="font-bold text-xs sm:text-sm text-gray-900">Window</div>
              <div className="font-bold text-xs sm:text-sm text-gray-900">Service & Admin</div>
              <div className="relative">
                <LocationAutocomplete
                  value={locationText}
                  onChange={setLocationText}
                  onSave={handleLocationUpdate}
                  disabled={isQueueingEnabled}
                  isUpdating={isUpdatingLocation}
                  placeholder="Enter office location..."
                  initialValue={initialState.locationText}
                  showWarning={showWarning}
                />
              </div>
            </div>
            {/* Mobile header with location */}
            <div className="md:hidden space-y-2">
              <h3 className="font-bold text-sm text-gray-900">Windows</h3>
              <LocationAutocomplete
                value={locationText}
                onChange={setLocationText}
                onSave={handleLocationUpdate}
                disabled={isQueueingEnabled}
                isUpdating={isUpdatingLocation}
                placeholder="Enter office location..."
                initialValue={initialState.locationText}
                showWarning={showWarning}
              />
            </div>
          </div>

          {/* Rows 2-5: Container for displaying added windows - Fixed height for exactly 4 windows */}
          <div ref={windowsContainerRef} className="flex-1 flex flex-col space-y-1.5 sm:space-y-2 md:space-y-2.5 overflow-y-auto lg:h-[calc(100%-3.5rem)] min-h-0">
            {(windows || []).slice(0, 4).map((window) => (
              <div
                key={window.id}
                className={`flex flex-col md:grid md:grid-cols-3 gap-2 sm:gap-2.5 md:gap-3 p-2.5 sm:p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors ${
                  isWindowsScrollable ? 'flex-shrink-0' : 'flex-1'
                }`}
              >
                {/* Desktop view */}
                <div className="hidden md:flex items-center">
                  <span className="font-bold text-xs sm:text-sm text-gray-900">{window.name}</span>
                </div>

                <div className="hidden md:flex flex-col justify-center space-y-0.5">
                  <ServiceDisplay
                    services={window.serviceIds || []}
                    totalServices={services.length}
                    isPriority={window.name === 'Priority'}
                  />
                  <div className="text-xs sm:text-sm text-gray-600">
                    {window.assignedAdmin?.email || 'No admin assigned'}
                  </div>
                </div>

                <div className="hidden md:flex items-center justify-center space-x-2 sm:space-x-2.5">
                  <motion.button
                    onClick={() => !isQueueingEnabled && handleToggleWindow(window.id)}
                    disabled={isQueueingEnabled}
                    className={`p-1 sm:p-1.5 rounded-lg transition-colors ${
                      isQueueingEnabled
                        ? 'opacity-50 cursor-not-allowed text-gray-400'
                        : window.isOpen
                        ? 'text-green-600 hover:text-green-700 hover:bg-green-50'
                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                    }`}
                    title={
                      isQueueingEnabled
                        ? 'Cannot change window visibility while queueing is active'
                        : window.isOpen ? 'Close Window' : 'Open Window'
                    }
                    whileHover={!isQueueingEnabled ? { scale: 1.1, transition: { duration: 0.2 } } : undefined}
                    whileTap={!isQueueingEnabled ? { scale: 0.9, transition: { duration: 0.15 } } : undefined}
                  >
                    {window.isOpen ? (
                      <AiOutlineEye className="text-lg sm:text-xl" />
                    ) : (
                      <AiOutlineEyeInvisible className="text-lg sm:text-xl" />
                    )}
                  </motion.button>
                  <motion.button
                    onClick={() => handleConfigureWindow(window.id)}
                    disabled={isQueueingEnabled}
                    className={`p-1 sm:p-1.5 rounded-lg transition-colors ${
                      isQueueingEnabled
                        ? 'opacity-50 cursor-not-allowed text-gray-400'
                        : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                    }`}
                    title={
                      isQueueingEnabled
                        ? 'Cannot configure windows while queueing is active'
                        : 'Configure Window'
                    }
                    whileHover={!isQueueingEnabled ? { scale: 1.1, transition: { duration: 0.2 } } : undefined}
                    whileTap={!isQueueingEnabled ? { scale: 0.9, transition: { duration: 0.15 } } : undefined}
                  >
                    <LuSettings2 className="text-xl sm:text-2xl" />
                  </motion.button>
                </div>

                {/* Mobile card view */}
                <div className="md:hidden w-full space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] text-gray-500 uppercase tracking-wide block mb-0.5">Window</span>
                      <span className="font-bold text-sm text-gray-900">{window.name}</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => !isQueueingEnabled && handleToggleWindow(window.id)}
                        disabled={isQueueingEnabled}
                        className={`p-1 rounded-lg transition-colors ${
                          isQueueingEnabled
                            ? 'opacity-50 cursor-not-allowed text-gray-400'
                            : window.isOpen
                            ? 'text-green-600 hover:text-green-700 hover:bg-green-50'
                            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {window.isOpen ? (
                          <AiOutlineEye className="text-lg" />
                        ) : (
                          <AiOutlineEyeInvisible className="text-lg" />
                        )}
                      </button>
                      <button
                        onClick={() => handleConfigureWindow(window.id)}
                        disabled={isQueueingEnabled}
                        className={`p-1 rounded-lg transition-colors ${
                          isQueueingEnabled
                            ? 'opacity-50 cursor-not-allowed text-gray-400'
                            : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                        }`}
                      >
                        <LuSettings2 className="text-xl" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase tracking-wide block mb-0.5">Services</span>
                    <ServiceDisplay
                      services={window.serviceIds || []}
                      totalServices={services.length}
                      isPriority={window.name === 'Priority'}
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase tracking-wide block mb-0.5">Admin</span>
                    <div className="text-xs text-gray-600">
                      {window.assignedAdmin?.email || 'No admin assigned'}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Fill remaining slots with clickable add buttons if fewer than 4 windows */}
            {Array.from({ length: Math.max(0, 4 - (windows || []).length) }).map((_, index) => (
              <button
                key={`placeholder-${index}`}
                onClick={openAddWindowModal}
                disabled={isQueueingEnabled}
                className={`border-2 border-dashed rounded-lg flex items-center justify-center transition-colors ${
                  isWindowsScrollable ? 'flex-shrink-0' : 'flex-1'
                } ${
                  isQueueingEnabled
                    ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                    : 'border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-500 hover:bg-gray-50'
                }`}
                title={
                  isQueueingEnabled
                    ? 'Cannot add windows while queueing is active'
                    : 'Add new window'
                }
              >
                <span className="text-xs sm:text-sm md:text-base font-medium">
                  {isQueueingEnabled ? 'Locked' : 'Available Window Slot'}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddEditWindowModal
        isOpen={showAddEditWindowModal}
        onClose={closeAddEditWindowModal}
        windowFormData={windowFormData}
        onFormChange={handleWindowFormChange}
        onSave={handleSaveWindow}
        services={services}
        windows={windows}
        adminUsers={adminUsers}
        adminUsersLoading={adminUsersLoading}
        isEditing={!!editingWindow}
        errors={windowErrors}
        initialFormData={initialState.windowFormData}
        showWarning={showWarning}
      />
      <AddEditServiceModal
        isOpen={showAddServiceModal}
        onClose={closeAddServiceModal}
        serviceFormData={serviceFormData}
        onFormChange={handleServiceFormChange}
        onSave={handleSaveService}
        errors={serviceErrors}
        initialFormData={initialState.serviceFormData}
        isEditing={!!editingService}
        showWarning={showWarning}
      />

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={confirmModalConfig.onConfirm}
        title={confirmModalConfig.title}
        message={confirmModalConfig.message}
        type={confirmModalConfig.type}
        confirmText="Remove"
        cancelText="Cancel"
      />

      {/* Toast Container for Settings page notifications */}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
    </div>
  );
};

export default Settings;

