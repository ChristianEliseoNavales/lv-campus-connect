import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import KioskLayout from '../layouts/KioskLayout';
import QueueLayout from '../layouts/QueueLayout';
import { ResponsiveGrid } from '../ui';
import { HiSparkles } from "react-icons/hi2";
import HolographicKeyboard from '../ui/HolographicKeyboard';
import { useSocket } from '../../contexts/SocketContext';
import { useOptimizedFetch } from '../../hooks/useOptimizedFetch';
import { useToast, ToastContainer } from '../ui/Toast';
import QRCode from 'qrcode';



// Data Privacy Modal Component
const DataPrivacyModal = ({ isOpen, onNext, onPrevious, consent, setConsent }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Black background with 80% opacity */}
      <div className="absolute inset-0 bg-black bg-opacity-80" />

      {/* Modal Container - Centered with buttons positioned relative to it */}
      <div className="relative flex items-center">
        {/* Modal Content - Perfectly centered */}
        <div className="bg-white rounded-2xl shadow-3xl drop-shadow-2xl p-10 mx-4 max-w-4xl w-full">
          {/* Modal Header */}
          <h2 className="text-5xl font-bold text-gray-800 mb-8 text-center">
            PRIVACY NOTICE
          </h2>

          {/* Privacy Notice Text */}
          <div className="mb-8 text-gray-700 leading-relaxed">
            <p className="mb-6 text-xl">
              Please be informed that we are collecting your personal information for the purpose of
              recording and monitoring as we follow the Data Privacy Act of 2012. The storage, use,
              and disposal of your personal information will be governed by LVCC's Data Privacy Policies.
            </p>
          </div>

          {/* Consent Checkbox */}
          <div className="mb-10">
            <label className="flex items-center space-x-6 cursor-pointer group">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 h-10 w-10 text-[#1F3463] border-4 border-gray-400 rounded-lg focus:ring-[#1F3463] focus:ring-4 focus:border-[#1F3463] transition-all duration-200 touch-target-lg shadow-lg hover:shadow-xl active:scale-95 cursor-pointer"
                style={{
                  accentColor: '#1F3463'
                }}
              />
              <span className="text-gray-700 leading-relaxed text-xl flex-1 pt-2">
                I voluntarily give my consent to LVCC in collecting, processing, recording, using,
                and retaining my personal information for the above-mentioned purpose in accordance
                with this Privacy Notice.
              </span>
            </label>
          </div>
        </div>

        {/* Buttons positioned adjacent to modal's right edge */}
        <div className="absolute left-full ml-4 top-1/2 transform -translate-y-1/2 flex flex-col space-y-4 z-[10000]">
          {/* Next Button (top) */}
          <button
            onClick={onNext}
            disabled={!consent}
            className={`w-24 h-24 rounded-full border-2 border-white font-bold text-sm transition-all duration-150 shadow-lg ${
              consent
                ? 'bg-[#FFE251] text-[#1A2E56] active:shadow-md active:scale-95'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            NEXT
          </button>

          {/* Previous Button (bottom) */}
          <button
            onClick={onPrevious}
            className="w-24 h-24 rounded-full border-2 border-white bg-[#1F3463] text-white font-bold text-sm active:bg-[#1A2E56] transition-all duration-150 shadow-lg active:shadow-md active:scale-95"
          >
            PREVIOUS
          </button>
        </div>
      </div>
    </div>
  );
};

// Confirmation Modal Component
const ConfirmationModal = ({ isOpen, onYes, onNo }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Black background with 80% opacity */}
      <div className="absolute inset-0 bg-black bg-opacity-80" />

      {/* Modal Container - Centered with buttons positioned below */}
      <div className="relative flex flex-col items-center">
        {/* Modal Content - Perfectly centered */}
        <div className="bg-white rounded-2xl shadow-3xl drop-shadow-2xl p-8 mx-4 max-w-lg w-full">
          {/* Modal Message */}
          <h2 className="text-3xl font-bold text-gray-800 text-center">
            Are you ready to submit your information?
          </h2>
        </div>

        {/* Buttons positioned below modal */}
        <div className="flex space-x-8 mt-8">
          {/* Yes Button */}
          <button
            onClick={onYes}
            className="w-24 h-24 rounded-full border-2 border-white bg-[#1F3463] text-white font-bold text-sm active:bg-[#1A2E56] transition-all duration-150 shadow-lg active:shadow-md active:scale-95"
          >
            YES
          </button>

          {/* No Button */}
          <button
            onClick={onNo}
            className="w-24 h-24 rounded-full border-2 border-white bg-[#1F3463] text-white font-bold text-sm active:bg-gray-600 transition-all duration-150 shadow-lg active:shadow-md active:scale-95"
          >
            NO
          </button>
        </div>
      </div>
    </div>
  );
};

// Office Mismatch Modal Component
const OfficeMismatchModal = ({ isOpen, onConfirm, onClose, currentOffice, suggestedOffice }) => {
  if (!isOpen || !suggestedOffice) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-2xl mx-4 text-center">
        {/* Header */}
        <h2 className="text-4xl font-semibold mb-4" style={{ color: '#1F3463' }}>
          You Selected {currentOffice}'s Office
        </h2>

        {/* Subtext */}
        <p className="text-2xl text-gray-600 mb-8">
          Please switch to
        </p>

        {/* Suggested Office Button */}
        <button
          onClick={onConfirm}
          className="w-80 text-white rounded-3xl shadow-lg drop-shadow-md p-6 active:shadow-md active:scale-95 transition-all duration-150 border-2 border-transparent focus:outline-none focus:ring-4 focus:ring-blue-200 mb-6"
          style={{ backgroundColor: '#1F3463' }}
          onTouchStart={(e) => e.target.style.backgroundColor = '#1A2E56'}
          onTouchEnd={(e) => e.target.style.backgroundColor = '#1F3463'}
          onMouseDown={(e) => e.target.style.backgroundColor = '#1A2E56'}
          onMouseUp={(e) => e.target.style.backgroundColor = '#1F3463'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#1F3463'}
        >
          <div className="text-center flex flex-col items-center">
            {/* Office Image */}
            <div className="mb-4">
              <img
                src={`/queue/${suggestedOffice.key}.png`}
                alt={`${suggestedOffice.name} Icon`}
                className="w-34 h-34 object-contain rounded-xl mx-auto"
              />
            </div>
            {/* Office Name */}
            <h3 className="text-2xl font-semibold text-white">
              {suggestedOffice.name}
            </h3>
          </div>
        </button>

        {/* Close button (optional - user can also click suggested office) */}
        <div>
          <button
            onClick={onClose}
            className="text-gray-500 active:text-gray-700 text-sm underline transition-colors duration-150"
          >
            Continue with current selection
          </button>
        </div>
      </div>
    </div>
  );
};

const Queue = () => {
  // Multi-step queue state management
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [currentStep, setCurrentStep] = useState('department'); // 'department', 'privacy', 'service', 'studentStatus', 'role', 'priority', 'idVerification', 'form', 'formStep1', 'formStep2', 'confirmation', 'result', 'feedback', 'thankYou'
  const [selectedService, setSelectedService] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [priorityStatus, setPriorityStatus] = useState(null);
  const [studentStatus, setStudentStatus] = useState(null);
  const [showOfficeMismatchModal, setShowOfficeMismatchModal] = useState(false);
  const [suggestedOffice, setSuggestedOffice] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(true);
  const [activeField, setActiveField] = useState('name');
  const [formStep, setFormStep] = useState(1); // 1: Personal Info, 2: Additional Info
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [officeStatus, setOfficeStatus] = useState({
    registrar: { isEnabled: true, loading: false },
    admissions: { isEnabled: true, loading: false }
  });
  const [availableServices, setAvailableServices] = useState({
    registrar: [],
    admissions: []
  });
  const [departmentLocations, setDepartmentLocations] = useState({
    registrar: '',
    admissions: ''
  });

  // Use centralized Socket context
  const { joinRoom, subscribe } = useSocket();

  // Toast notifications
  const { toasts, removeToast, showSuccess, showError, showWarning, showInfo } = useToast();
  const [starRating, setStarRating] = useState(0);
  const [idNumber, setIdNumber] = useState('');
  const [queueResult, setQueueResult] = useState(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [isPrinting, setIsPrinting] = useState(false); // Prevent multiple print clicks
  const [formData, setFormData] = useState({
    name: '',
    contactNumber: '',
    email: '',
    address: ''
  });

  // Form validation errors
  const [formErrors, setFormErrors] = useState({
    name: '',
    contactNumber: '',
    email: '',
    address: ''
  });

  // Validation functions
  const validateName = (name) => {
    if (!name.trim()) {
      return 'Name is required';
    }
    if (name.trim().length < 2) {
      return 'Name must be at least 2 characters';
    }
    return '';
  };

  const validateContactNumber = (contactNumber) => {
    if (!contactNumber.trim()) {
      return 'Contact number is required';
    }
    // Philippine phone number validation: +63XXXXXXXXXX or 0XXXXXXXXXX
    const phoneRegex = /^(\+63|0)[0-9]{10}$/;
    if (!phoneRegex.test(contactNumber.trim())) {
      return 'Enter a valid Philippine phone number (e.g., +639123456789 or 09123456789)';
    }
    return '';
  };

  const validateEmail = (email) => {
    if (!email.trim()) {
      return 'Email is required';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return 'Enter a valid email address (e.g., user@example.com)';
    }
    return '';
  };

  const validateAddress = (address) => {
    // Address is optional, so only validate if provided
    if (address && address.length > 500) {
      return 'Address must be less than 500 characters';
    }
    return '';
  };
  // Service options for the queue process - now dynamic
  const [serviceOptions, setServiceOptions] = useState([]);

  // TEMPORARY TESTING FEATURE: Physical keyboard input handlers
  // TODO: Remove before production deployment - for development/testing only
  const handlePhysicalInputChange = (fieldName, value) => {
    if (fieldName === 'idNumber') {
      setIdNumber(value);
    } else {
      setFormData(prev => {
        const updatedData = { ...prev, [fieldName]: value };

        // Clear error for this field when user starts typing
        setFormErrors(prevErrors => ({
          ...prevErrors,
          [fieldName]: ''
        }));

        return updatedData;
      });
    }
  };

  // Keyboard handling functions (for virtual keyboard)
  const handleKeyPress = (key) => {
    if (activeField === 'idNumber') {
      setIdNumber(prev => prev + key);
    } else {
      setFormData(prev => {
        const newValue = prev[activeField] + key;
        const updatedData = { ...prev, [activeField]: newValue };

        // Clear error for this field when user starts typing
        setFormErrors(prevErrors => ({
          ...prevErrors,
          [activeField]: ''
        }));

        return updatedData;
      });
    }
  };

  const handleBackspace = () => {
    if (activeField === 'idNumber') {
      setIdNumber(prev => prev.slice(0, -1));
    } else {
      setFormData(prev => ({
        ...prev,
        [activeField]: prev[activeField].slice(0, -1)
      }));
    }
  };

  const handleSpace = () => {
    if (activeField === 'idNumber') {
      setIdNumber(prev => prev + ' ');
    } else {
      setFormData(prev => ({
        ...prev,
        [activeField]: prev[activeField] + ' '
      }));
    }
  };

  const handleEnter = () => {
    // Handle ID verification step only
    if (activeField === 'idNumber' && idNumber.trim()) {
      handleIdVerificationNext();
      return;
    }
  };

  const toggleKeyboard = () => {
    setShowKeyboard(!showKeyboard);
  };

  const hideKeyboard = () => {
    setShowKeyboard(false);
  };

  // Generate QR code from URL
  const generateQRCode = async (url) => {
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(url, {
        width: 400,
        margin: 2,
        color: {
          dark: '#1F3463', // Navy blue for QR code
          light: '#FFFFFF' // White background
        }
      });
      setQrCodeDataUrl(qrCodeDataUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
      setQrCodeDataUrl('');
    }
  };

  // Optimized check office availability status with caching
  const checkOfficeStatus = useCallback(async (department) => {
    try {
      setOfficeStatus(prev => ({ ...prev, [department]: { ...prev[department], loading: true } }));

      const response = await fetch(`http://localhost:5000/api/public/office-status/${department}`);
      const data = await response.json();

      setOfficeStatus(prev => ({
        ...prev,
        [department]: { isEnabled: data.isEnabled, loading: false }
      }));

      return data.isEnabled;
    } catch (error) {
      console.error(`Error checking ${department} office status:`, error);
      setOfficeStatus(prev => ({
        ...prev,
        [department]: { isEnabled: true, loading: false } // Default to enabled on error
      }));
      return true;
    }
  }, []);

  // Optimized fetch available services with caching
  const fetchAvailableServices = useCallback(async (department) => {
    try {
      const response = await fetch(`http://localhost:5000/api/public/services/${department}`);
      const data = await response.json();

      setAvailableServices(prev => ({
        ...prev,
        [department]: data.services || []
      }));

      return data.services || [];
    } catch (error) {
      console.error(`Error fetching ${department} services:`, error);
      return [];
    }
  }, []);

  // Fetch department location
  const fetchDepartmentLocation = useCallback(async (department) => {
    try {
      const response = await fetch(`http://localhost:5000/api/settings/location/${department}`);
      const data = await response.json();

      setDepartmentLocations(prev => ({
        ...prev,
        [department]: data.location || ''
      }));

      return data.location || '';
    } catch (error) {
      console.error(`Error fetching ${department} location:`, error);
      return '';
    }
  }, []);

  // Initialize Socket.io connection and check office status
  useEffect(() => {
    // Join kiosk room for real-time updates
    joinRoom('kiosk');

    // Listen for real-time updates with cleanup
    const unsubscribeSettings = subscribe('settings-updated', (data) => {
      const officeKey = data.office || data.department; // Support both 'office' and legacy 'department'
      if (officeKey === 'registrar' || officeKey === 'admissions') {
        checkOfficeStatus(officeKey);
        // Also fetch location if it's a location update
        if (data.type === 'location-updated') {
          fetchDepartmentLocation(officeKey);
        }
      }
    });

    const unsubscribeServices = subscribe('services-updated', (data) => {
      const officeKey = data.office || data.department; // Support both 'office' and legacy 'department'
      if (officeKey === 'registrar' || officeKey === 'admissions') {
        fetchAvailableServices(officeKey);
      }
    });

    // Initial status check for both offices
    checkOfficeStatus('registrar');
    checkOfficeStatus('admissions');
    fetchAvailableServices('registrar');
    fetchAvailableServices('admissions');

    // Fetch initial location data for both departments
    fetchDepartmentLocation('registrar');
    fetchDepartmentLocation('admissions');

    return () => {
      unsubscribeSettings();
      unsubscribeServices();
    };
  }, [joinRoom, subscribe]);

  // Offices following Directory.jsx structure
  const offices = [
    { key: 'registrar', name: "Registrar's Office" },
    { key: 'admissions', name: 'Admissions Office' }
  ];

  // Update service options when available services change
  useEffect(() => {
    if (selectedDepartment) {
      // Determine the department key from selectedDepartment
      const departmentKey = selectedDepartment.name === "Registrar's Office" ? 'registrar' : 'admissions';

      const departmentServices = availableServices[departmentKey];
      if (departmentServices && Array.isArray(departmentServices)) {
        const services = departmentServices
          .filter(service => service && service.name)
          .map(service => service.name);
        setServiceOptions(services);
      } else {
        setServiceOptions([]);
      }
    }
  }, [selectedDepartment, availableServices]);

  // Auto-redirect from thank you step after 3 seconds
  useEffect(() => {
    if (currentStep === 'thankYou') {
      const timer = setTimeout(() => {
        resetAllData();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [currentStep]);

  // Role options
  const roleOptions = [
    'Visitor',
    'Student',
    'Teacher',
    'Alumni'
  ];

  // Priority options
  const priorityOptions = [
    { key: 'yes', label: 'Yes' },
    { key: 'no', label: 'No' }
  ];

  // Department data for queue functionality
  const departmentData = {
    registrar: {
      name: "Registrar's Office",
      description: 'Student records, transcripts, enrollment verification',
      icon: '📋',
      services: [
        'Transcript Request',
        'Enrollment Verification',
        'Grade Change Request',
        'Student Records Update',
        'Transfer Credit Evaluation'
      ],
      currentQueue: 5,
      estimatedWait: '15-20 minutes'
    },
    admissions: {
      name: 'Admissions Office',
      description: 'New student applications, admission requirements',
      icon: '🎓',
      services: [
        'Application Assistance',
        'Admission Requirements',
        'Transfer Student Services',
        'International Student Services',
        'Campus Tour Request'
      ],
      currentQueue: 3,
      estimatedWait: '10-15 minutes'
    }
  };

  const handleOfficeSelect = async (officeKey) => {
    // Check if office is available
    const isAvailable = await checkOfficeStatus(officeKey);

    if (!isAvailable) {
      // Office is closed, don't proceed
      return;
    }

    setSelectedDepartment(departmentData[officeKey]);
    setShowPrivacyModal(true);
    setCurrentStep('privacy');
    // Reset all subsequent steps
    setSelectedService(null);
    setStudentStatus(null);
    setSelectedRole(null);
    setPriorityStatus(null);
    setShowForm(false);
  };

  const handleBackToOffices = () => {
    setSelectedDepartment(null);
    setShowPrivacyModal(false);
    setPrivacyConsent(false);
    setCurrentStep('department');
    setSelectedService(null);
    setStudentStatus(null);
    setSelectedRole(null);
    setPriorityStatus(null);
    setShowForm(false);
    setShowKeyboard(true);
    setActiveField('name');
    setFormStep(1);
    setShowConfirmationModal(false);
    setIdNumber('');
    setFormData({ name: '', contactNumber: '', email: '', address: '' });
  };

  // Privacy modal handlers
  const handlePrivacyNext = () => {
    if (privacyConsent) {
      setShowPrivacyModal(false);
      setCurrentStep('service');
    }
  };

  const handlePrivacyPrevious = () => {
    setShowPrivacyModal(false);
    setPrivacyConsent(false);
    setCurrentStep('department');
    setSelectedDepartment(null);
  };

  // Service selection handlers
  const handleServiceSelect = (service) => {
    console.log('🎯 Service selected:', service, 'Type:', typeof service);
    setSelectedService(service);
    // If "Enroll" is selected, go to student status check, otherwise go to role
    if (service === 'Enroll') {
      console.log('➡️ Going to studentStatus step');
      setCurrentStep('studentStatus');
    } else {
      console.log('➡️ Going to role step');
      setCurrentStep('role');
    }
  };

  // Student status selection handlers
  const handleStudentStatusSelect = async (status) => {
    console.log('🎓 [FRONTEND] Student status selected:', status);
    console.log('🎓 [FRONTEND] Current service:', selectedService);
    console.log('🎓 [FRONTEND] Current department:', selectedDepartment?.name);

    setStudentStatus(status);

    // Check for office mismatch scenarios
    const currentOfficeKey = selectedDepartment?.name === "Registrar's Office" ? 'registrar' : 'admissions';
    console.log('🏢 [FRONTEND] Current office key:', currentOfficeKey);

    // Scenario 1: Registrar's Office + Enroll + YES (new student) -> should use Admissions
    if (currentOfficeKey === 'registrar' && selectedService === 'Enroll' && status === 'yes') {
      console.log('🔄 [FRONTEND] Office mismatch detected: Registrar + Enroll + YES -> suggesting Admissions');
      setSuggestedOffice({ key: 'admissions', name: 'Admissions Office' });
      setShowOfficeMismatchModal(true);
      return;
    }

    // Scenario 2: Admissions Office + Enroll + NO (not new student) -> should use Registrar's
    if (currentOfficeKey === 'admissions' && selectedService === 'Enroll' && status === 'no') {
      console.log('🔄 [FRONTEND] Office mismatch detected: Admissions + Enroll + NO -> suggesting Registrar');
      setSuggestedOffice({ key: 'registrar', name: "Registrar's Office" });
      setShowOfficeMismatchModal(true);
      return;
    }

    // No mismatch - proceed normally
    console.log('✅ [FRONTEND] No office mismatch - proceeding with Enroll service submission');
    console.log('🎓 [FRONTEND] Enroll service: Auto-setting required fields and submitting to backend');

    // For Enroll service, automatically set role to "Student" since enrollment is for students only
    console.log('🎓 [FRONTEND] Auto-setting role to "Student" for Enroll service');
    setSelectedRole('Student');

    // Set priority status to "no" by default for Enroll service (can be changed if needed)
    console.log('🎓 [FRONTEND] Auto-setting priority status to "no" for Enroll service');
    setPriorityStatus('no');

    // For Enroll service, submit to backend immediately with auto-populated data
    // This ensures the queue entry is actually recorded in the database
    console.log('🚀 [FRONTEND] Submitting Enroll service to backend...');

    // Submit immediately with explicit values to avoid state timing issues
    handleEnrollSubmission();
  };

  // Role selection handlers
  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    // IMPORTANT CHANGE: Priority status check now applies to ALL roles, not just Visitor
    setCurrentStep('priority');
  };

  // Priority status handlers
  const handlePrioritySelect = (priority) => {
    setPriorityStatus(priority);
    if (priority === 'yes') {
      // If YES, go to ID verification step
      setCurrentStep('idVerification');
      setShowKeyboard(true);
      setActiveField('idNumber');
      setIdNumber(''); // Reset ID number
    } else {
      // For all services, go to visitation form (enrollment service will have simplified form)
      setCurrentStep('formStep1');
      setFormStep(1);
      setShowForm(true);
      setShowKeyboard(true);
      setActiveField('name');
      // Reset form data when starting new form
      setFormData({ name: '', contactNumber: '', email: '', address: '' });
    }
  };

  // ID verification handlers
  const handleIdVerificationNext = () => {
    if (idNumber.trim()) {
      // For all services, go to visitation form (enrollment service will have simplified form)
      setCurrentStep('formStep1');
      setFormStep(1);
      setShowForm(true);
      setShowKeyboard(true);
      setActiveField('name');
      // Reset form data when starting new form
      setFormData({ name: '', contactNumber: '', email: '', address: '' });
    }
  };

  const handleIdVerificationPrevious = () => {
    setCurrentStep('priority');
    setIdNumber('');
  };

  // Form step navigation handlers
  const handleFormStep1Next = () => {
    // Validate Step 1 fields
    const nameError = validateName(formData.name);
    const contactError = validateContactNumber(formData.contactNumber);

    setFormErrors(prev => ({
      ...prev,
      name: nameError,
      contactNumber: contactError
    }));

    // Only proceed if no errors
    if (!nameError && !contactError) {
      setFormStep(2);
      setCurrentStep('formStep2');
      setActiveField('email');
    }
  };

  const handleFormStep1Previous = () => {
    // Check if we came from ID verification or directly from priority/role
    if (priorityStatus === 'yes') {
      // If priority status was yes, go back to ID verification
      setCurrentStep('idVerification');
      setActiveField('idNumber');
    } else if (selectedRole === 'Visitor') {
      // If visitor role but priority status was no, go back to priority
      setCurrentStep('priority');
    } else {
      // For other roles (Student, Alumni, Teacher), go back to role selection
      setCurrentStep('role');
    }
    setShowForm(false);
    setFormStep(1);
  };

  const handleFormStep2Next = () => {
    // Validate Step 2 fields - email is required, address is optional
    const emailError = validateEmail(formData.email);
    const addressError = validateAddress(formData.address);

    setFormErrors(prev => ({
      ...prev,
      email: emailError,
      address: addressError
    }));

    // Only proceed if no errors
    if (!emailError && !addressError) {
      // For enrollment service, skip address collection and go directly to confirmation
      if (selectedService === 'Enroll') {
        setFormData(prev => ({ ...prev, address: '' })); // Set address to empty for enrollment
      }
      setShowConfirmationModal(true);
    }
  };

  const handleFormStep2Previous = () => {
    setFormStep(1);
    setCurrentStep('formStep1');
    setActiveField('name');
  };

  const handleConfirmationYes = async () => {
    setShowConfirmationModal(false);
    // Call the API to submit the queue request
    await handleFormSubmit();
  };

  // Print button handler - prints receipt then moves to feedback step
  const handlePrintClick = async () => {
    // Prevent multiple clicks while printing
    if (isPrinting) {
      console.log('⚠️ Print already in progress, ignoring click');
      return;
    }

    try {
      setIsPrinting(true); // Disable button

      // Show loading toast
      showInfo('Printing receipt...');

      // Prepare receipt data
      const departmentKey = selectedDepartment?.name === "Registrar's Office" ? 'registrar' : 'admissions';
      const location = departmentLocations[departmentKey] || 'Location not set';

      // Format current date for validity notice
      const formatCurrentDate = () => {
        const today = new Date();
        const options = {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        };
        return today.toLocaleDateString('en-US', options);
      };

      const receiptData = {
        queueNumber: queueResult?.queueNumber || 1,
        location: location,
        windowName: queueResult?.windowName || 'Window 1',
        validityDate: formatCurrentDate(),
        department: selectedDepartment?.name || 'Unknown'
      };

      console.log('🖨️  Sending print request:', receiptData);

      // Call backend print API
      const response = await fetch('http://localhost:5000/api/printer/print-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(receiptData)
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ Print successful:', result);
        showSuccess('Receipt printed successfully!');
      } else {
        console.error('❌ Print failed:', result.message);
        showError(result.message || 'Failed to print receipt');
      }

    } catch (error) {
      console.error('❌ Print error:', error);
      showError('Failed to print receipt. Please try again.');
    } finally {
      // Always proceed to feedback step regardless of print success
      // This ensures the flow continues even if printer is unavailable
      setTimeout(() => {
        setCurrentStep('feedback');
        setIsPrinting(false); // Re-enable button for next queue
      }, 1500); // Small delay to show toast message
    }
  };

  // Star rating handler - Only updates visual state
  const handleStarClick = (rating) => {
    setStarRating(rating);
  };

  // Submit rating handler - Handles actual submission
  const handleSubmitRating = async () => {
    if (starRating === 0) return;

    // Submit rating to backend if we have a queue ID
    if (queueResult?.queueId) {
      try {
        const response = await fetch(`http://localhost:5000/api/public/queue/${queueResult.queueId}/rating`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ rating: starRating })
        });

        if (response.ok) {
          console.log('Rating submitted successfully');
        } else {
          console.error('Failed to submit rating');
        }
      } catch (error) {
        console.error('Error submitting rating:', error);
      }
    }

    // Advance to thank you step after successful submission
    setCurrentStep('thankYou');
  };

  const handleConfirmationNo = () => {
    setShowConfirmationModal(false);
    // Stay on Step 2
  };

  // Special handler for Enroll service submission with explicit values
  const handleEnrollSubmission = async () => {
    try {
      console.log('🎓 [FRONTEND] Starting handleEnrollSubmission');

      // Map frontend studentStatus values to backend enum values
      const mapStudentStatus = (status) => {
        console.log('🔄 [FRONTEND] Mapping studentStatus:', status);
        if (status === 'yes') {
          console.log('🔄 [FRONTEND] Mapped "yes" to "incoming_new"');
          return 'incoming_new';
        }
        if (status === 'no') {
          console.log('🔄 [FRONTEND] Mapped "no" to "continuing"');
          return 'continuing';
        }
        console.log('🔄 [FRONTEND] Returning status as-is:', status);
        return status; // Return as-is if already in correct format
      };

      // Prepare submission data with explicit values for Enroll service
      const submissionData = {
        office: selectedDepartment.name === "Registrar's Office" ? 'registrar' : 'admissions',
        service: 'Enroll',
        role: 'Student', // Always Student for Enroll service
        studentStatus: studentStatus ? mapStudentStatus(studentStatus) : 'continuing',
        isPriority: false, // Always false for Enroll service
        idNumber: '',
        // Empty form data for Enroll service (no visitation form required)
        customerName: '',
        contactNumber: '',
        email: '',
        address: ''
      };

      console.log('📤 [FRONTEND] Enroll submission payload:', JSON.stringify(submissionData, null, 2));

      // Submit to backend API
      console.log('🌐 [FRONTEND] Making API request to:', 'http://localhost:5000/api/public/queue');
      const response = await fetch('http://localhost:5000/api/public/queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(submissionData)
      });

      console.log('📡 [FRONTEND] API Response status:', response.status, response.statusText);

      const result = await response.json();
      console.log('📥 [FRONTEND] API Response body:', JSON.stringify(result, null, 2));

      if (response.ok && result.success) {
        console.log('✅ [FRONTEND] Enroll submission successful!');
        console.log('✅ [FRONTEND] Queue ID received:', result.data?.queueId);
        console.log('✅ [FRONTEND] Queue Number received:', result.data?.queueNumber);

        // Store queue data for result display and rating submission
        setQueueResult({
          queueId: result.data.queueId,
          queueNumber: result.data.queueNumber,
          office: result.data.office,
          service: result.data.service,
          qrCodeUrl: result.data.qrCodeUrl,
          estimatedWaitTime: result.data.estimatedWaitTime,
          windowName: result.data.windowName
        });

        // Generate QR code from the URL
        if (result.data.qrCodeUrl) {
          await generateQRCode(result.data.qrCodeUrl);
        }

        console.log('✅ [FRONTEND] Moving to result step');
        // Move to result step
        setCurrentStep('result');
      } else {
        console.error('❌ [FRONTEND] Enroll submission failed!');
        console.error('❌ [FRONTEND] Error details:', result);
        console.error('❌ [FRONTEND] Response status:', response.status);
        showError('Submission Failed', result.error || 'Unknown error occurred while submitting your queue request.');
      }
    } catch (error) {
      console.error('💥 [FRONTEND] Enroll submission error:', error);
      console.error('💥 [FRONTEND] Error stack:', error.stack);
      showError('Network Error', 'Please check your connection and try again.');
    }
  };

  const handleFormSubmit = async () => {
    try {
      console.log('🚀 [FRONTEND] Starting handleFormSubmit for service:', selectedService);
      console.log('🚀 [FRONTEND] Current state values:', {
        selectedDepartment: selectedDepartment?.name,
        selectedService,
        selectedRole,
        studentStatus,
        priorityStatus,
        idNumber,
        formData
      });

      // Map frontend studentStatus values to backend enum values
      const mapStudentStatus = (status) => {
        console.log('🔄 [FRONTEND] Mapping studentStatus:', status);
        if (status === 'yes') {
          console.log('🔄 [FRONTEND] Mapped "yes" to "incoming_new"');
          return 'incoming_new';
        }
        if (status === 'no') {
          console.log('🔄 [FRONTEND] Mapped "no" to "continuing"');
          return 'continuing';
        }
        console.log('🔄 [FRONTEND] Returning status as-is:', status);
        return status; // Return as-is if already in correct format
      };

      // Prepare submission data
      const submissionData = {
        office: selectedDepartment.name === "Registrar's Office" ? 'registrar' : 'admissions',
        service: selectedService,
        role: selectedRole,
        studentStatus: selectedService === 'Enroll' && studentStatus ? mapStudentStatus(studentStatus) : undefined,
        isPriority: priorityStatus === 'yes',
        idNumber: priorityStatus === 'yes' ? idNumber : '',
        // For enrollment service, form data is still required but collected differently
        customerName: formData.name || '',
        contactNumber: formData.contactNumber || '',
        email: formData.email || '',
        address: formData.address || ''
      };

      console.log('📤 [FRONTEND] Final submission payload:', JSON.stringify(submissionData, null, 2));
      console.log('📤 [FRONTEND] Payload size:', JSON.stringify(submissionData).length, 'characters');

      // Submit to backend API
      console.log('🌐 [FRONTEND] Making API request to:', 'http://localhost:5000/api/public/queue');
      const response = await fetch('http://localhost:5000/api/public/queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(submissionData)
      });

      console.log('📡 [FRONTEND] API Response status:', response.status, response.statusText);
      console.log('📡 [FRONTEND] API Response headers:', Object.fromEntries(response.headers.entries()));

      const result = await response.json();
      console.log('📥 [FRONTEND] API Response body:', JSON.stringify(result, null, 2));

      if (response.ok && result.success) {
        console.log('✅ [FRONTEND] Queue submission successful!');
        console.log('✅ [FRONTEND] Queue ID received:', result.data?.queueId);
        console.log('✅ [FRONTEND] Queue Number received:', result.data?.queueNumber);

        // Store queue data for result display and rating submission
        setQueueResult({
          queueId: result.data.queueId, // Store queue ID for rating submission
          queueNumber: result.data.queueNumber,
          office: result.data.office,
          service: result.data.service,
          qrCodeUrl: result.data.qrCodeUrl,
          estimatedWaitTime: result.data.estimatedWaitTime,
          windowName: result.data.windowName
        });

        // Generate QR code from the URL
        if (result.data.qrCodeUrl) {
          await generateQRCode(result.data.qrCodeUrl);
        }

        console.log('✅ [FRONTEND] Moving to result step');
        // Move to result step
        setCurrentStep('result');
      } else {
        console.error('❌ [FRONTEND] Queue submission failed!');
        console.error('❌ [FRONTEND] Error details:', result);
        console.error('❌ [FRONTEND] Response status:', response.status);
        // Handle error with toast notification
        showError('Submission Failed', result.error || 'Unknown error occurred while submitting your queue request.');
      }
    } catch (error) {
      console.error('💥 [FRONTEND] Network/Exception error:', error);
      console.error('💥 [FRONTEND] Error stack:', error.stack);
      showError('Network Error', 'Please check your connection and try again.');
    }
  };

  // Reset all form and state data
  const resetAllData = () => {
    setFormData({ name: '', contactNumber: '', email: '', address: '' });
    setFormErrors({ name: '', contactNumber: '', email: '', address: '' }); // Clear all errors
    setShowForm(false);
    setSelectedService(null);
    setStudentStatus(null);
    setSelectedRole(null);
    setPriorityStatus(null);
    setSelectedDepartment(null);
    setShowPrivacyModal(false);
    setPrivacyConsent(false);
    setCurrentStep('department');
    setShowKeyboard(true);
    setActiveField('name');
    setFormStep(1);
    setShowConfirmationModal(false);
    setStarRating(0);
    setIdNumber('');
    setQueueResult(null);
    setQrCodeDataUrl(''); // Clear QR code
  };

  const handleFieldFocus = (fieldName) => {
    setActiveField(fieldName);
    // Auto-show keyboard when any input field is focused
    setShowKeyboard(true);
  };

  // Office mismatch modal handlers
  const handleOfficeMismatchConfirm = async () => {
    if (suggestedOffice) {
      // Switch to the suggested office and proceed directly to result
      setSelectedDepartment(departmentData[suggestedOffice.key]);
      setShowOfficeMismatchModal(false);
      setSuggestedOffice(null);

      // For Enroll service, set required fields and submit to backend
      console.log('🔄 [FRONTEND] Office mismatch resolved - setting Enroll service defaults and submitting');
      setSelectedRole('Student'); // Enroll is always for students
      setPriorityStatus('no'); // Default priority status

      // Submit to backend to ensure queue entry is recorded in database
      console.log('🚀 [FRONTEND] Submitting Enroll service after office switch...');

      // Submit immediately with explicit values to avoid state timing issues
      handleEnrollSubmission();
    }
  };

  const handleOfficeMismatchClose = () => {
    setShowOfficeMismatchModal(false);
    setSuggestedOffice(null);
  };

  // Check if form steps are valid
  const isFormStep1Valid = formData.name.trim() && formData.contactNumber.trim();
  const isFormStep2Valid = formData.email.trim(); // Email is required, address is optional



  // Handle back navigation - goes back one step in the process
  const handleBackNavigation = () => {
    switch (currentStep) {
      case 'department':
        // Already at the start, do nothing or navigate to home
        break;

      case 'privacy':
        // Go back to department selection
        handlePrivacyPrevious();
        break;

      case 'service':
        // Go back to privacy modal
        setCurrentStep('privacy');
        setShowPrivacyModal(true);
        setSelectedService(null);
        break;

      case 'studentStatus':
        // Go back to service selection
        setCurrentStep('service');
        setStudentStatus(null);
        break;

      case 'role':
        // Go back to service selection (or studentStatus if came from enrollment flow)
        if (selectedService === 'Enroll') {
          setCurrentStep('studentStatus');
        } else {
          setCurrentStep('service');
        }
        setSelectedRole(null);
        break;

      case 'priority':
        // Go back to role selection
        setCurrentStep('role');
        setPriorityStatus(null);
        break;

      case 'idVerification':
        // Go back to priority status
        handleIdVerificationPrevious();
        break;

      case 'formStep1':
        // Go back based on previous flow
        handleFormStep1Previous();
        break;

      case 'formStep2':
        // Go back to form step 1
        handleFormStep2Previous();
        break;

      case 'result':
        // Go back to form step 2 (or enrollment flow if applicable)
        if (selectedService === 'Enroll') {
          // For enrollment, go back to student status
          setCurrentStep('studentStatus');
        } else {
          // For regular flow, go back to form step 2
          setCurrentStep('formStep2');
          setFormStep(2);
          setShowForm(true);
        }
        break;

      case 'feedback':
        // Go back to result
        setCurrentStep('result');
        break;

      case 'thankYou':
        // Go back to feedback
        setCurrentStep('feedback');
        break;

      default:
        // Fallback to department selection
        handleBackToOffices();
        break;
    }
  };

  // Back Button Component
  const BackButton = () => (
    <button
      onClick={handleBackNavigation}
      className="fixed bottom-6 left-6 w-20 h-20 bg-[#FFE251] text-black border-2 border-white rounded-full shadow-lg transition-all duration-200 flex items-center justify-center z-50 focus:outline-none focus:ring-4 focus:ring-blue-200"
      aria-label="Go back one step"
    >
      BACK
    </button>
  );



  // ID Verification Step
  if (currentStep === 'idVerification') {
    return (
      <>
        <QueueLayout>
          {/* Custom header hiding for form state */}
          <style>{`
            .kiosk-container header { display: none !important; }
          `}</style>

          <div className="h-full flex flex-col justify-center">
            {/* Form Container - Centered horizontally with positioned buttons */}
            <div className="flex items-center justify-center w-full px-8 relative overflow-visible">
              {/* Form Section - Perfectly centered */}
              <div className="bg-white rounded-lg shadow-xl drop-shadow-lg p-8 w-[500px]">
                {/* Header */}
                <h2 className="text-4xl font-bold text-gray-800 mb-4 text-center">
                  Enter a valid ID number
                </h2>

                {/* Subheader */}
                <p className="text-xl text-gray-600 mb-8 text-center">
                  Please present your ID at the office for verification
                </p>

                <div className="space-y-4">
                  {/* ID Number Field */}
                  <div>
                    <label htmlFor="idNumber" className="block text-xl font-semibold text-gray-700 mb-2">
                      ID NUMBER <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="idNumber"
                      type="text"
                      value={idNumber}
                      onFocus={() => handleFieldFocus('idNumber')}
                      onChange={(e) => handlePhysicalInputChange('idNumber', e.target.value)}
                      // TEMPORARY: readOnly removed for testing - restore for production
                      className={`w-full px-3 py-3 border-2 rounded-lg text-xl focus:outline-none ${
                        activeField === 'idNumber'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-300 bg-gray-50'
                      }`}
                      placeholder="Enter your ID number"
                    />
                  </div>
                </div>
              </div>

              {/* Navigation buttons are now handled within the HolographicKeyboard overlay */}
            </div>
          </div>

          {/* Back Button */}
          <BackButton />
        </QueueLayout>

        {/* Holographic Keyboard Overlay */}
        <HolographicKeyboard
          onKeyPress={handleKeyPress}
          onBackspace={handleBackspace}
          onSpace={handleSpace}
          onEnter={handleEnter}
          onHide={hideKeyboard}
          isVisible={showKeyboard}
          activeInputValue={idNumber}
          activeInputLabel="ID NUMBER *"
          activeInputPlaceholder="Enter your ID number"
          // Navigation buttons for ID verification step
          showNavigationButtons={true}
          navigationButtons={[
            {
              label: 'NEXT',
              onClick: handleIdVerificationNext,
              disabled: !idNumber.trim(),
              variant: 'next'
            },
            {
              label: 'PREVIOUS',
              onClick: handleIdVerificationPrevious,
              disabled: false,
              variant: 'previous'
            }
          ]}
        />
      </>
    );
  }

  // Form Step 1: Personal Information
  if (currentStep === 'formStep1' && showForm) {

    return (
      <>
        <QueueLayout>
          {/* Custom header hiding for form state */}
          <style>{`
            .kiosk-container header { display: none !important; }
          `}</style>

          <div className="h-full flex flex-col justify-center">
            {/* Form Container - Centered horizontally with positioned buttons */}
            <div className="flex items-center justify-center w-full px-8 relative overflow-visible">
              {/* Form Section - Perfectly centered */}
              <div className="bg-white rounded-lg shadow-xl drop-shadow-lg p-6 w-[500px]">
                <div className="space-y-4">
                  {/* Name Field */}
                  <div>
                    <label htmlFor="name" className="block text-xl font-semibold text-gray-700 mb-2">
                      NAME <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="name"
                      type="text"
                      value={formData.name}
                      onFocus={() => handleFieldFocus('name')}
                      onChange={(e) => handlePhysicalInputChange('name', e.target.value)}
                      // TEMPORARY: readOnly removed for testing - restore for production
                      className={`w-full px-3 py-3 border-2 rounded-lg text-xl focus:outline-none ${
                        activeField === 'name'
                          ? 'border-blue-500 bg-blue-50'
                          : formErrors.name
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-300 bg-gray-50'
                      }`}
                      placeholder="Enter your full name"
                    />
                    {formErrors.name && (
                      <p className="mt-1 text-sm text-red-600 font-medium">
                        {formErrors.name}
                      </p>
                    )}
                  </div>

                  {/* Contact Number Field */}
                  <div>
                    <label htmlFor="contactNumber" className="block text-xl font-semibold text-gray-700 mb-2">
                      CONTACT NUMBER <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="contactNumber"
                      type="text"
                      value={formData.contactNumber}
                      onFocus={() => handleFieldFocus('contactNumber')}
                      onChange={(e) => handlePhysicalInputChange('contactNumber', e.target.value)}
                      // TEMPORARY: readOnly removed for testing - restore for production
                      className={`w-full px-3 py-3 border-2 rounded-lg text-xl focus:outline-none ${
                        activeField === 'contactNumber'
                          ? 'border-blue-500 bg-blue-50'
                          : formErrors.contactNumber
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-300 bg-gray-50'
                      }`}
                      placeholder="e.g., +639123456789 or 09123456789"
                    />
                    {formErrors.contactNumber && (
                      <p className="mt-1 text-sm text-red-600 font-medium">
                        {formErrors.contactNumber}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Navigation buttons are now handled within the HolographicKeyboard overlay */}
            </div>
          </div>

          {/* Back Button */}
          <BackButton />
        </QueueLayout>

        {/* Holographic Keyboard Overlay */}
        <HolographicKeyboard
          onKeyPress={handleKeyPress}
          onBackspace={handleBackspace}
          onSpace={handleSpace}
          onHide={hideKeyboard}
          isVisible={showKeyboard}
          // Multi-field display for visitation form step 1
          showAllFields={true}
          allFieldsData={[
            {
              name: 'name',
              label: 'NAME *',
              value: formData.name,
              placeholder: 'Enter your full name'
            },
            {
              name: 'contactNumber',
              label: 'CONTACT NUMBER *',
              value: formData.contactNumber,
              placeholder: 'Enter your contact number'
            }
          ]}
          activeFieldName={activeField}
          onFieldFocus={handleFieldFocus}
          // Validation errors for overlay display
          formErrors={formErrors}
          // Navigation buttons for form step 1
          showNavigationButtons={true}
          navigationButtons={[
            {
              label: 'NEXT',
              onClick: handleFormStep1Next,
              disabled: !isFormStep1Valid,
              variant: 'next'
            },
            {
              label: 'PREVIOUS',
              onClick: handleFormStep1Previous,
              disabled: false,
              variant: 'previous'
            }
          ]}
        />
      </>
    );
  }

  // Form Step 2: Additional Information
  if (currentStep === 'formStep2' && showForm) {

    return (
      <>
        <QueueLayout>
          {/* Custom header hiding for form state */}
          <style>{`
            .kiosk-container header { display: none !important; }
          `}</style>

          <div className="h-full flex flex-col justify-center">
            {/* Form Container - Centered horizontally with positioned buttons */}
            <div className="flex items-center justify-center w-full px-8 relative overflow-visible">
              {/* Form Section - Perfectly centered */}
              <div className="bg-white rounded-lg shadow-xl drop-shadow-lg p-6 w-[500px]">
                <div className="space-y-4">
                  {/* Email Field */}
                  <div className="relative">
                    <div className="flex justify-between items-center mb-2">
                      <label htmlFor="email" className="block text-xl font-semibold text-gray-700">
                        EMAIL <span className="text-red-500">*</span>
                      </label>
                    </div>
                    <input
                      id="email"
                      type="email"
                      value={formData.email}
                      onFocus={() => handleFieldFocus('email')}
                      onChange={(e) => handlePhysicalInputChange('email', e.target.value)}
                      // TEMPORARY: readOnly removed for testing - restore for production
                      className={`w-full px-3 py-3 border-2 rounded-lg text-xl focus:outline-none ${
                        activeField === 'email'
                          ? 'border-blue-500 bg-blue-50'
                          : formErrors.email
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-300 bg-gray-50'
                      }`}
                      placeholder="e.g., user@example.com"
                    />
                    {formErrors.email && (
                      <p className="mt-1 text-sm text-red-600 font-medium">
                        {formErrors.email}
                      </p>
                    )}
                  </div>

                  {/* Address Field */}
                  <div className="relative">
                    <div className="flex justify-between items-center mb-2">
                      <label htmlFor="address" className="block text-xl font-semibold text-gray-700">
                        ADDRESS
                      </label>
                      <span className="text-sm text-gray-500 font-medium">Optional</span>
                    </div>
                    <input
                      id="address"
                      type="text"
                      value={formData.address}
                      onFocus={() => handleFieldFocus('address')}
                      onChange={(e) => handlePhysicalInputChange('address', e.target.value)}
                      // TEMPORARY: readOnly removed for testing - restore for production
                      className={`w-full px-3 py-3 border-2 rounded-lg text-xl focus:outline-none ${
                        activeField === 'address'
                          ? 'border-blue-500 bg-blue-50'
                          : formErrors.address
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-300 bg-gray-50'
                      }`}
                      placeholder="Enter your address (optional)"
                    />
                    {formErrors.address && (
                      <p className="mt-1 text-sm text-red-600 font-medium">
                        {formErrors.address}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Navigation buttons are now handled within the HolographicKeyboard overlay */}
            </div>
          </div>

          {/* Back Button */}
          <BackButton />
        </QueueLayout>

        {/* Holographic Keyboard Overlay */}
        <HolographicKeyboard
          onKeyPress={handleKeyPress}
          onBackspace={handleBackspace}
          onSpace={handleSpace}
          onHide={hideKeyboard}
          isVisible={showKeyboard}
          // Multi-field display for visitation form step 2
          showAllFields={true}
          allFieldsData={[
            {
              name: 'email',
              label: 'EMAIL *',
              value: formData.email,
              placeholder: 'Enter your email address'
            },
            {
              name: 'address',
              label: 'ADDRESS',
              value: formData.address,
              placeholder: 'Enter your address'
            }
          ]}
          activeFieldName={activeField}
          onFieldFocus={handleFieldFocus}
          // Validation errors for overlay display
          formErrors={formErrors}
          // Navigation buttons for form step 2
          showNavigationButtons={true}
          navigationButtons={[
            {
              label: 'NEXT',
              onClick: handleFormStep2Next,
              disabled: !isFormStep2Valid,
              variant: 'next'
            },
            {
              label: 'PREVIOUS',
              onClick: handleFormStep2Previous,
              disabled: false,
              variant: 'previous'
            }
          ]}
        />

        {/* Confirmation Modal */}
        <ConfirmationModal
          isOpen={showConfirmationModal}
          onYes={handleConfirmationYes}
          onNo={handleConfirmationNo}
        />
      </>
    );
  }

  // Queue Result Layout
  if (currentStep === 'result') {
    // Use actual queue data from submission
    const queueNumber = queueResult?.queueNumber || 1;
    const windowName = queueResult?.windowName || 'Window 1'; // Use actual window name from backend

    // Format current date for validity notice
    const formatCurrentDate = () => {
      const today = new Date();
      const options = {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      };
      return today.toLocaleDateString('en-US', options);
    };

    return (
      <QueueLayout>
        <div className="h-full flex flex-col">
          {/* Main Content Area - 2 columns layout with equal widths */}
          <div className="flex-grow grid grid-cols-2 gap-8 py-10 px-20">
            {/* First Div - QR Code Section */}
            <div className="bg-white rounded-3xl shadow-xl drop-shadow-lg p-8 flex flex-col items-center justify-center">
              {/* Top Text */}
              <h2 className="text-4xl font-bold text-gray-800 mb-8 text-center">
                Scan the QR Code for your Queue Number
              </h2>

              {/* QR Code Image - Centered */}
              <div className="flex-grow flex items-center justify-center mb-8">
                <div className="w-96 h-96 bg-white border-2 border-gray-300 rounded-lg flex items-center justify-center">
                  {/* QR Code Image */}
                  {qrCodeDataUrl ? (
                    <img
                      src={qrCodeDataUrl}
                      alt="QR Code for Queue Number"
                      className="w-full h-full object-contain rounded-lg"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full text-gray-500">
                      <div className="text-center">
                        <div className="text-4xl mb-4">📱</div>
                        <div className="text-lg">Generating QR Code...</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Second Div - Queue Information */}
            <div className="bg-white rounded-3xl shadow-xl drop-shadow-lg p-6 flex flex-col items-center justify-evenly h-full">
              {/* Large Queue Number with Circular Border */}
              <div className="flex items-center justify-center mb-6">
                <div className="w-32 h-32 border-4 border-[#1F3463] rounded-full flex items-center justify-center">
                  <span className="text-5xl font-bold text-[#1F3463]">
                    {queueNumber.toString().padStart(2, '0')}
                  </span>
                </div>
              </div>

              {/* Queue Number Label */}
              <h3 className="text-3xl font-bold text-center text-gray-800 mb-4">
                Queue Number
              </h3>

              {/* Location Text */}
              <div className="mb-6 text-center">
                <span className="text-xl text-gray-700">Location:<br /></span>
                <span className="text-4xl text-gray-700">
                  {(() => {
                    if (!selectedDepartment) return 'Location not set';
                    const departmentKey = selectedDepartment.name === "Registrar's Office" ? 'registrar' : 'admissions';
                    return departmentLocations[departmentKey] || 'Location not set';
                  })()}
                </span>
              </div>


              {/* Instruction Text */}
              <div className="mb-6 text-center">
                <span className="text-xl text-gray-700">Please Proceed to <br /></span>
                <span className="text-4xl text-gray-700">{windowName}</span>
              </div>

              {/* Validity Notice */}
              <div className="mb-4 text-center">
                <p className="text-xl font-semibold text-[#1F3463]">
                  This ticket is only valid on {formatCurrentDate()}
                </p>
              </div>

              {/* Print Button */}
              <button
                onClick={handlePrintClick}
                disabled={isPrinting}
                className={`px-20 py-4 rounded-full font-bold text-xl transition-all duration-150 shadow-lg ${
                  isPrinting
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-[#FFE251] text-black active:bg-[#1A2E56] active:shadow-md active:scale-95'
                }`}
              >
                {isPrinting ? 'PRINTING...' : 'PRINT'}
              </button>
            </div>
          </div>
        </div>

        {/* Done Button (replaces Back Button) - Only navigates, does not print */}
        <button
          onClick={() => setCurrentStep('feedback')}
          className="fixed bottom-6 left-6 w-20 h-20 bg-[#FFE251] text-black border-2 border-white rounded-full shadow-lg active:bg-[#1A2E56] transition-all duration-150 flex items-center justify-center z-50 focus:outline-none focus:ring-4 focus:ring-blue-200 active:scale-95"
          aria-label="Done - Go to feedback"
        >
          <span className="text-sm font-bold">DONE</span>
        </button>
      </QueueLayout>
    );
  }

  // Feedback Step - Star Rating
  if (currentStep === 'feedback') {
    return (
      <QueueLayout>
        <div className="h-full flex flex-col items-center justify-center">
          {/* Star Rating Container - White rounded container */}
          <div className="bg-white rounded-lg shadow-xl drop-shadow-lg p-12 max-w-2xl mx-auto text-center mb-8">
            {/* Main Heading */}
            <h2 className="text-5xl font-bold text-gray-800 mb-4">
              How was your experience today?
            </h2>

            {/* Subheading */}
            <p className="text-2xl text-gray-600 mb-12">
              Please let us know how we did by leaving a star rating
            </p>

            {/* Star Rating Container */}
            <div className="mb-8">
              {/* Star Rating */}
              <div className="flex justify-center gap-4 mb-8">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => handleStarClick(star)}
                    className="text-6xl transition-all duration-150 active:scale-95 focus:outline-none focus:ring-4 focus:ring-yellow-200 rounded-lg p-2"
                    aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                  >
                    {star <= starRating ? (
                      <span className="text-yellow-400">★</span>
                    ) : (
                      <span className="text-gray-300">☆</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Rating Labels */}
              <div className="flex justify-between text-xl text-gray-500 max-w-md mx-auto">
                <span>Poor</span>
                <span>Excellent</span>
              </div>
            </div>
          </div>

          {/* Submit Button - Positioned outside and below the star rating container */}
          <div className="flex justify-center">
            <button
              onClick={handleSubmitRating}
              disabled={starRating === 0}
              className={`px-8 py-4 rounded-full font-bold text-xl transition-all duration-150 shadow-lg ${
                starRating > 0
                  ? 'bg-[#FFE251] text-[#1A2E56] active:bg-[#FFE251] active:shadow-md active:scale-95'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              SUBMIT
            </button>
          </div>
        </div>
      </QueueLayout>
    );
  }

  // Thank You Step
  if (currentStep === 'thankYou') {
    return (
      <KioskLayout>
        <div className="h-full flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl drop-shadow-lg p-12 max-w-2xl mx-auto text-center">
            {/* Sparkle Icon - Center-aligned and reduced size */}
            <div className="flex justify-center mb-6">
              <HiSparkles className="text-6xl text-[#FFE251]" />
            </div>

            {/* Thank You Message */}
            <h2 className="text-4xl font-bold text-[#1F3463] mb-4">
              Thank you!
            </h2>

            {/* Subtext */}
            <p className="text-4xl text-[#1F3463]">
              Your feedback is much appreciated!
            </p>
          </div>
        </div>
      </KioskLayout>
    );
  }

  // Office Selection: Use KioskLayout with navigation
  if (currentStep === 'department') {
    return (
      <KioskLayout>
        <div className="h-full flex flex-col">
          {/* Office Selection Grid */}
          <div className="flex-grow flex items-center justify-center h-full">
            {/* Centered Header-Grid Unit with Fixed Positioning */}
            <div className="flex flex-col items-center w-full px-20">
              {/* Fixed Header - Absolute positioning to prevent movement */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 -mt-32">
                <h2 className="text-5xl font-semibold text-center drop-shadow-lg whitespace-nowrap mb-2" style={{ color: '#1F3463' }}>
                  SELECT OFFICE
                </h2>
                {/* Subheader */}
                <p className="text-3xl font-bold text-center drop-shadow-lg mb-16" style={{ color: '#1F3463' }}>
                  CUT OFF TIME: 5:00 PM
                </p>
              </div>

              {/* Office Grid Container - Fixed positioning below header */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 mt-14">
                <div className="grid grid-cols-2 gap-x-32 gap-y-8 max-w-4xl mx-auto">
                  {offices.filter(office => office && office.key).map((office) => {
                    const status = officeStatus[office.key] || { isEnabled: false, loading: false };
                    const isDisabled = !status.isEnabled;
                    const isLoading = status.loading;

                    return (
                      <button
                        key={office.key}
                        onClick={() => !isDisabled && handleOfficeSelect(office.key)}
                        disabled={isDisabled || isLoading}
                        className={`w-80 text-white rounded-3xl shadow-lg drop-shadow-md p-6 transition-all duration-200 border-2 border-transparent focus:outline-none focus:ring-4 focus:ring-blue-200 relative ${
                          isDisabled
                            ? 'opacity-90 cursor-not-allowed bg-gray-500'
                            : isLoading
                            ? 'opacity-75 cursor-wait'
                            : 'active:shadow-md active:scale-95 hover:opacity-90'
                        }`}
                        style={{
                          backgroundColor: isDisabled ? '#6B7280' : '#1F3463'
                        }}
                      >
                        <div className="text-center flex flex-col items-center">
                          {/* Office Image */}
                          <div className="mb-4">
                            <img
                              src={`/queue/${office.key}.png`}
                              alt={`${office.name} Icon`}
                              className={`w-34 h-34 object-contain rounded-xl ${isDisabled ? 'grayscale' : ''}`}
                            />
                          </div>
                          {/* Office Name */}
                          <h3 className="text-2xl font-semibold text-white">
                            {office.name}
                          </h3>
                          {/* Status Badge */}
                          {isLoading ? (
                            <div className="mt-2 px-3 py-1 bg-yellow-500 text-white text-sm rounded-full">
                              Checking...
                            </div>
                          ) : isDisabled ? (
                            <div className="mt-2 px-3 py-1 bg-red-500 text-white text-sm rounded-full">
                              Closed
                            </div>
                          ) : (
                            <div className="mt-2 px-3 py-1 bg-green-500 text-white text-sm rounded-full">
                              Open
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </KioskLayout>
    );
  }

  // Privacy Step: Show Data Privacy Modal
  if (currentStep === 'privacy') {
    return (
      <>
        <KioskLayout>
          <div className="h-full flex flex-col">
            {/* Office Selection Grid - Keep visible but disabled */}
            <div className="flex-grow flex items-center justify-center h-full">
              {/* Centered Header-Grid Unit */}
              <div className="flex flex-col items-center w-full">
                {/* Fixed Header */}
                <div className="flex-shrink-0 pb-2">
                  <h2 className="text-5xl font-semibold text-center drop-shadow-lg" style={{ color: '#1F3463' }}>
                    SELECT OFFICE
                  </h2>
                </div>

                {/* Centered Grid Container */}
                <div className="pt-4">
                  {/* 2 Office Grid - Disabled state */}
                  <div className="grid grid-cols-2 gap-x-32 gap-y-8 max-w-4xl mx-auto">
                  {offices.filter(office => office && office.key).map((office) => (
                    <button
                      key={office.key}
                      disabled
                      className="w-80 text-white rounded-3xl shadow-lg drop-shadow-md p-6 opacity-60 cursor-not-allowed border-2 border-transparent"
                      style={{ backgroundColor: '#1F3463' }}
                    >
                      <div className="text-center flex flex-col items-center">
                        {/* Office Image */}
                        <div className="mb-4 px-4">
                          <img
                            src={`/queue/${office.key}.png`}
                            alt={`${office.name} Icon`}
                            className="w-24 h-24 object-contain rounded-xl"
                          />
                        </div>
                        {/* Office Name */}
                        <h3 className="text-2xl font-semibold text-white">
                          {office.name}
                        </h3>
                      </div>
                    </button>
                  ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </KioskLayout>

        {/* Data Privacy Modal - Outside KioskLayout to avoid overflow issues */}
        <DataPrivacyModal
          isOpen={showPrivacyModal}
          onNext={handlePrivacyNext}
          onPrevious={handlePrivacyPrevious}
          consent={privacyConsent}
          setConsent={setPrivacyConsent}
        />
      </>
    );
  }

  // Service Selection Step
  if (currentStep === 'service') {
    return (
      <QueueLayout>
        <div className="h-full flex flex-col">
          {/* Service Selection Grid */}
          <div className="flex-grow flex items-center justify-center h-full">
            {/* Centered Header-Grid Unit with Flexible Positioning */}
            <div className="flex flex-col items-center justify-center w-full px-20 h-full">
              {/* Header - Positioned above grid with proper spacing */}
              <div className="mb-8">
                <h2 className="text-5xl font-semibold text-center drop-shadow-lg whitespace-nowrap" style={{ color: '#1F3463' }}>
                  WHAT WOULD YOU LIKE TO DO?
                </h2>
              </div>

              {/* Responsive Grid Container - Natural flow positioning */}
              <div className="flex-shrink-0">
                <ResponsiveGrid
                  items={serviceOptions}
                  onItemClick={(service) => handleServiceSelect(service)}
                  renderItem={(service) => (
                    <div className="text-center">
                      <h3 className="text-2xl font-semibold text-white">
                        {service}
                      </h3>
                    </div>
                  )}
                  showPagination={serviceOptions.length > 6}
                  isDirectoryPage={true}
                />
              </div>
            </div>
          </div>
        </div>

        <BackButton />
      </QueueLayout>
    );
  }

  // Student Status Check Step (for Enroll service)
  if (currentStep === 'studentStatus') {
    const studentStatusOptions = [
      { key: 'yes', label: 'YES' },
      { key: 'no', label: 'NO' }
    ];

    return (
      <>
        <QueueLayout>
          <div className="h-full flex flex-col items-center justify-center">
            {/* Header */}
            <div className="mb-12">
              <h2 className="text-5xl font-semibold text-center drop-shadow-lg whitespace-nowrap mb-4" style={{ color: '#1F3463' }}>
                ARE YOU AN INCOMING NEW STUDENT?
              </h2>
              {/* Subheader */}
              <p className="text-3xl font-light text-center drop-shadow-lg" style={{ color: '#1F3463' }}>
                *A MINOR OF AGE ISN'T ALLOWED TO PROCESS ENROLLMENT
              </p>
            </div>

            {/* Responsive Grid Container */}
            <div className="w-full flex justify-center">
              <ResponsiveGrid
                items={studentStatusOptions}
                onItemClick={(option) => handleStudentStatusSelect(option.key)}
                renderItem={(option) => (
                  <div className="text-center">
                    <h3 className="text-2xl font-semibold text-white">
                      {option.label}
                    </h3>
                  </div>
                )}
                showPagination={studentStatusOptions.length > 6}
              />
            </div>
          </div>

          <BackButton />
        </QueueLayout>

        {/* Office Mismatch Modal */}
        <OfficeMismatchModal
          isOpen={showOfficeMismatchModal}
          onConfirm={handleOfficeMismatchConfirm}
          onClose={handleOfficeMismatchClose}
          currentOffice={selectedDepartment?.name === "Registrar's Office" ? "Registrar" : "Admissions"}
          suggestedOffice={suggestedOffice}
        />
      </>
    );
  }

  // Role Selection Step
  if (currentStep === 'role') {
    console.log('🎭 ROLE STEP - Rendering with roleOptions:', roleOptions);
    return (
      <QueueLayout>
        <div className="h-full flex flex-col items-center justify-center">
          {/* Header */}
          <div className="mb-12">
            <h2 className="text-5xl font-semibold text-center drop-shadow-lg whitespace-nowrap" style={{ color: '#1F3463' }}>
              SELECT ROLE
            </h2>
          </div>

          {/* Responsive Grid Container */}
          <div className="w-full flex justify-center">
            <ResponsiveGrid
              items={roleOptions}
              onItemClick={(role) => handleRoleSelect(role)}
              renderItem={(role) => (
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-white">
                    {role}
                  </h3>
                </div>
              )}
              showPagination={roleOptions.length > 6}
            />
          </div>
        </div>

        <BackButton />
      </QueueLayout>
    );
  }

  // Priority Status Step
  if (currentStep === 'priority') {
    return (
      <QueueLayout>
        <div className="h-full flex flex-col items-center justify-center">
          {/* Header */}
          <div className="mb-12">
            <h2 className="text-5xl font-semibold text-center drop-shadow-lg whitespace-nowrap mb-4" style={{ color: '#1F3463' }}>
              DO YOU BELONG TO THE FOLLOWING?
            </h2>
            {/* Subheader with bulleted format */}
            <div className="text-3xl font-semibold text-center drop-shadow-lg" style={{ color: '#1F3463' }}>
              <div className="mb-2">• PERSON WITH DISABILITIES (PWD)</div>
              <div className="mb-2">• SENIOR CITIZEN</div>
            </div>
          </div>

          {/* Responsive Grid Container */}
          <div className="w-full flex justify-center">
            <ResponsiveGrid
              items={priorityOptions}
              onItemClick={(option) => handlePrioritySelect(option.key)}
              renderItem={(option) => (
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-white">
                    {option.label}
                  </h3>
                </div>
              )}
              showPagination={priorityOptions.length > 6}
            />
          </div>
        </div>

        <BackButton />
      </QueueLayout>
    );
  }

  // If we reach here, we should be in the form step or something went wrong
  // Return to department selection as fallback
  return (
    <>
      <KioskLayout>
        <div className="h-full flex flex-col items-center justify-center">
          <h2 className="text-2xl font-semibold text-gray-600 mb-4">
            Something went wrong. Please start over.
          </h2>
          <button
            onClick={handleBackToOffices}
            className="px-6 py-3 bg-[#1F3463] text-white rounded-lg active:bg-[#1A2E56] active:scale-95 transition-all duration-150"
          >
            Back to Department Selection
          </button>
        </div>
      </KioskLayout>

      {/* Toast Container for Queue page notifications */}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
    </>
  );
};

export default Queue;
