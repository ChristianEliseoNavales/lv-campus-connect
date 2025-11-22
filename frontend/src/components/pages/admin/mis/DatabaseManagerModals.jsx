import React, { useState, useEffect } from 'react';
import { MdClose, MdSave, MdWarning, MdDelete, MdDeleteSweep } from 'react-icons/md';

// Edit/Add Record Modal
export const EditRecordModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  formData, 
  onInputChange, 
  formErrors, 
  selectedModel, 
  editingRecord 
}) => {
  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(e);
  };

  const getFormFields = () => {
    // Define form fields for each model
    const modelFields = {
      User: [
        { name: 'name', label: 'Name', type: 'text', required: true },
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'role', label: 'Role', type: 'select', required: true, options: [
          'MIS Super Admin',
          'MIS Admin',
          'MIS Admin Staff',
          'Registrar Admin',
          'Registrar Admin Staff',
          'Admissions Admin',
          'Admissions Admin Staff',
          'Senior Management Admin',
          'Senior Management Admin Staff'
        ]},
        { name: 'accessLevel', label: 'Access Level', type: 'select', options: [
          'super_admin', 'admin', 'admin_staff'
        ]},
        { name: 'office', label: 'Office', type: 'select', options: [
          'MIS', 'Registrar', 'Admissions', 'Senior Management'
        ]},
        { name: 'password', label: 'Password', type: 'password', required: !editingRecord },
        { name: 'isActive', label: 'Active', type: 'checkbox' }
      ],
      Queue: [
        { name: 'queueNumber', label: 'Queue Number', type: 'number', required: true },
        { name: 'department', label: 'Department', type: 'select', required: true, options: [
          'registrar', 'admissions'
        ]},
        { name: 'serviceId', label: 'Service ID', type: 'text', required: true },
        { name: 'windowId', label: 'Window ID', type: 'text' },
        { name: 'role', label: 'Role', type: 'select', required: true, options: [
          'Visitor', 'Student', 'Teacher', 'Alumni'
        ]},
        { name: 'studentStatus', label: 'Student Status', type: 'select', options: [
          'incoming_new', 'continuing'
        ]},
        { name: 'isPriority', label: 'Priority', type: 'checkbox' },
        { name: 'status', label: 'Status', type: 'select', options: [
          'waiting', 'serving', 'completed', 'skipped', 'cancelled', 'no-show'
        ]},
        { name: 'idNumber', label: 'ID Number', type: 'text' }
      ],
      VisitationForm: [
        { name: 'customerName', label: 'Customer Name', type: 'text', required: true },
        { name: 'contactNumber', label: 'Contact Number', type: 'text', required: true },
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'address', label: 'Address', type: 'textarea' },
        { name: 'idNumber', label: 'ID Number', type: 'text' }
      ],
      Window: [
        { name: 'name', label: 'Window Name', type: 'text', required: true },
        { name: 'department', label: 'Department', type: 'select', required: true, options: [
          'registrar', 'admissions'
        ]},
        { name: 'isOpen', label: 'Open', type: 'checkbox' },
        { name: 'isServing', label: 'Serving', type: 'checkbox' }
      ],
      Service: [
        { name: 'name', label: 'Service Name', type: 'text', required: true },
        { name: 'department', label: 'Department', type: 'select', required: true, options: [
          'registrar', 'admissions'
        ]},
        { name: 'isActive', label: 'Active', type: 'checkbox' }
      ],
      Rating: [
        { name: 'rating', label: 'Rating (1-5)', type: 'number', required: true, min: 1, max: 5 },
        { name: 'feedback', label: 'Feedback', type: 'textarea' },
        { name: 'ratingType', label: 'Rating Type', type: 'select', required: true, options: [
          'service', 'window', 'overall_experience', 'staff_performance', 'system_usability'
        ]},
        { name: 'customerName', label: 'Customer Name', type: 'text', required: true },
        { name: 'customerEmail', label: 'Customer Email', type: 'email' },
        { name: 'customerRole', label: 'Customer Role', type: 'select', required: true, options: [
          'Visitor', 'Student', 'Teacher', 'Alumni'
        ]},
        { name: 'department', label: 'Department', type: 'select', required: true, options: [
          'registrar', 'admissions'
        ]}
      ],
      Bulletin: [
        { name: 'title', label: 'Title', type: 'text', required: true },
        { name: 'content', label: 'Content', type: 'textarea', required: true },
        { name: 'summary', label: 'Summary', type: 'textarea' },
        { name: 'status', label: 'Status', type: 'select', options: [
          'draft', 'published', 'archived'
        ]},
        { name: 'category', label: 'Category', type: 'select', options: [
          'General', 'Academic', 'Administrative', 'Events', 'Announcements', 'Emergency', 'Other'
        ]},
        { name: 'priority', label: 'Priority', type: 'select', options: [
          'low', 'normal', 'high', 'urgent'
        ]},
        { name: 'isVisible', label: 'Visible', type: 'checkbox' },
        { name: 'showOnHomepage', label: 'Show on Homepage', type: 'checkbox' }
      ],
      AuditTrail: [
        { name: 'action', label: 'Action', type: 'text', required: true },
        { name: 'actionDescription', label: 'Description', type: 'text', required: true },
        { name: 'resourceType', label: 'Resource Type', type: 'select', required: true, options: [
          'User', 'Queue', 'Service', 'Window', 'Settings', 'Bulletin', 'Rating', 'System', 'Other'
        ]},
        { name: 'ipAddress', label: 'IP Address', type: 'text', required: true },
        { name: 'requestMethod', label: 'Request Method', type: 'select', required: true, options: [
          'GET', 'POST', 'PUT', 'PATCH', 'DELETE'
        ]},
        { name: 'requestUrl', label: 'Request URL', type: 'text', required: true },
        { name: 'statusCode', label: 'Status Code', type: 'number', required: true },
        { name: 'success', label: 'Success', type: 'checkbox', required: true }
      ],
      Settings: [
        { name: 'systemName', label: 'System Name', type: 'text' },
        { name: 'systemVersion', label: 'System Version', type: 'text' }
      ]
    };

    return modelFields[selectedModel] || [];
  };

  const renderField = (field) => {
    const value = formData[field.name] || '';
    const error = formErrors[field.name];

    switch (field.type) {
      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => onInputChange(field.name, e.target.value)}
            className={`w-full px-2.5 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-[#1F3463] focus:border-transparent ${
              error ? 'border-red-500' : 'border-gray-300'
            }`}
            required={field.required}
          >
            <option value="">Select {field.label}</option>
            {field.options?.map((option) => (
              <option key={option} value={option}>
                {option.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </option>
            ))}
          </select>
        );

      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => onInputChange(field.name, e.target.value)}
            className={`w-full px-2.5 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-[#1F3463] focus:border-transparent ${
              error ? 'border-red-500' : 'border-gray-300'
            }`}
            rows={3}
            required={field.required}
          />
        );

      case 'checkbox':
        return (
          <input
            type="checkbox"
            checked={value === true || value === 'true'}
            onChange={(e) => onInputChange(field.name, e.target.checked)}
            className="w-3 h-3 text-[#1F3463] border-gray-300 rounded focus:ring-[#1F3463]"
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => onInputChange(field.name, e.target.value)}
            className={`w-full px-2.5 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-[#1F3463] focus:border-transparent ${
              error ? 'border-red-500' : 'border-gray-300'
            }`}
            min={field.min}
            max={field.max}
            required={field.required}
          />
        );

      default:
        return (
          <input
            type={field.type}
            value={value}
            onChange={(e) => onInputChange(field.name, e.target.value)}
            className={`w-full px-2.5 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-[#1F3463] focus:border-transparent ${
              error ? 'border-red-500' : 'border-gray-300'
            }`}
            required={field.required}
          />
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-3">
        <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute -top-1.5 -right-1.5 z-10 w-6 h-6 bg-[#1F3463] border-2 border-white rounded-full flex items-center justify-center text-white hover:bg-opacity-90 transition-colors"
          >
            <MdClose className="w-3 h-3" />
          </button>

          {/* Modal Content with max height and scroll */}
          <div className="max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="p-5 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingRecord ? `Edit ${selectedModel} Record` : `Add New ${selectedModel} Record`}
              </h2>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-5">
          <div className="space-y-3">
            {getFormFields().map((field) => (
              <div key={field.name}>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                {renderField(field)}
                {formErrors[field.name] && (
                  <p className="text-red-500 text-xs mt-0.5">{formErrors[field.name]}</p>
                )}
              </div>
            ))}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-2.5 mt-5 pt-5 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center space-x-1.5 px-3 py-1.5 text-sm bg-[#1F3463] text-white rounded-lg hover:bg-opacity-90 transition-colors"
            >
              <MdSave className="w-3 h-3" />
              <span>{editingRecord ? 'Update' : 'Create'} Record</span>
            </button>
          </div>
        </form>
          </div>
        </div>
      </div>
    </div>
  );
};


// Delete All Records Modal
export const DeleteAllRecordsModal = ({
  isOpen,
  onClose,
  onConfirm,
  selectedModel,
  recordCount
}) => {
  const [confirmText, setConfirmText] = useState('');
  const [isConfirmEnabled, setIsConfirmEnabled] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setConfirmText('');
      setIsConfirmEnabled(false);
    }
  }, [isOpen]);

  // Handle confirmation text change
  const handleConfirmTextChange = (e) => {
    const value = e.target.value;
    setConfirmText(value);
    setIsConfirmEnabled(value === 'DELETE ALL');
    console.log('🔤 Confirm text changed:', value, 'Enabled:', value === 'DELETE ALL');
  };

  // Handle confirm button click
  const handleConfirm = () => {
    if (isConfirmEnabled) {
      console.log('✅ Delete All confirmed for model:', selectedModel);
      onConfirm();
    } else {
      console.log('❌ Delete All not confirmed - button should be disabled');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-3">
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full">
        {/* Content - Centered like ConfirmModal */}
        <div className="p-5 text-center">
          <div className="text-3xl mb-3">🗑️</div>
          <h3 className="text-base font-semibold text-gray-900 mb-1.5">Delete All Records</h3>
          <p className="text-sm text-gray-600 mb-3">
            Are you sure you want to delete <strong>ALL {recordCount}</strong> {selectedModel} records?
          </p>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 text-left">
            <div className="flex items-start">
              <MdWarning className="w-4 h-4 text-red-500 mt-0.5 mr-1.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-red-800 font-medium mb-0.5">
                  DANGER: This will permanently delete ALL records!
                </p>
                <p className="text-xs text-red-700">
                  This action will remove all {selectedModel} records from the database and cannot be undone.
                </p>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-600 mb-1.5">
            Type <strong>DELETE ALL</strong> below to confirm:
          </p>
          <input
            type="text"
            value={confirmText}
            placeholder="Type DELETE ALL to confirm"
            className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            onChange={handleConfirmTextChange}
          />
        </div>

        {/* Actions - Centered like ConfirmModal */}
        <div className="flex space-x-2.5 justify-center pb-5 px-5">
          <button
            onClick={onClose}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 active:bg-gray-50 active:scale-95 transition-all duration-150"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isConfirmEnabled}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <MdDeleteSweep className="w-3 h-3" />
            <span>Delete All Records</span>
          </button>
        </div>
      </div>
    </div>
  );
};
