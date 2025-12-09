import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import KioskLayout from '../layouts/KioskLayout';
import QueueLayout from '../layouts/QueueLayout';
import { ResponsiveGrid } from '../ui';
import { HiSparkles } from "react-icons/hi2";
import HolographicKeyboard from '../ui/HolographicKeyboard';
import PrintingOverlay from '../ui/PrintingOverlay';
import { useSocket } from '../../contexts/SocketContext';
import { useOptimizedFetch } from '../../hooks/useOptimizedFetch';
import { useToast, ToastContainer } from '../ui/Toast';
import QRCode from 'qrcode';
import API_CONFIG from '../../config/api';
import {
  DataPrivacyModal,
  ConfirmationModal,
  ServiceUnavailableModal,
  OfficeMismatchModal,
  PrintErrorModal,
  TransactionNoErrorModal
} from './queue/QueueModals';
import RoleSelection from './queue/RoleSelection';
import PrioritySelection from './queue/PrioritySelection';

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
  const [showServiceUnavailableModal, setShowServiceUnavailableModal] = useState(false);
  const [serviceUnavailableInfo, setServiceUnavailableInfo] = useState({ officeName: '', serviceName: '' });
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
  const [printerAvailable, setPrinterAvailable] = useState(true); // Track printer availability
  const [printerChecking, setPrinterChecking] = useState(false); // Track if checking printer status
  const [printAttempts, setPrintAttempts] = useState(0); // Track number of print attempts
  const [showPrintErrorModal, setShowPrintErrorModal] = useState(false); // Show print error modal
  const [printErrorMessage, setPrintErrorMessage] = useState(''); // Print error message
  const [showTransactionNoErrorModal, setShowTransactionNoErrorModal] = useState(false); // Show transaction no error modal
  const [transactionNoErrorMessage, setTransactionNoErrorMessage] = useState(''); // Transaction no error message
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

  // Document Request form state
  const [documentRequestForm, setDocumentRequestForm] = useState({
    name: '',
    lastSYAttended: '',
    programGradeStrand: '',
    contactNumber: '',
    emailAddress: '',
    request: []
  });

  const [documentRequestErrors, setDocumentRequestErrors] = useState({});
  const [showDocumentRequestThankYou, setShowDocumentRequestThankYou] = useState(false);
  const [documentRequestFormStep, setDocumentRequestFormStep] = useState(1); // 1: Basic Info, 2: Contact Info, 3: Request Selection

  // Document Claim state
  const [transactionNo, setTransactionNo] = useState('');
  const [transactionNoError, setTransactionNoError] = useState('');

  // Animation variants for staggered effects
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.1
      }
    }
  };

  const headerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.5,
        delay: 0.1
      }
    }
  };

  const gridItemVariants = {
    hidden: { opacity: 0, scale: 0.9, y: 30 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15,
        duration: 0.6
      }
    }
  };

  const formVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15,
        duration: 0.6
      }
    }
  };

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

    const trimmedEmail = email.trim();

    // Basic email format validation
    const emailRegex = /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(trimmedEmail)) {
      return 'Enter a valid email address';
    }

    // Extract domain part after @
    const domainPart = trimmedEmail.split('@')[1];
    if (!domainPart) {
      return 'Enter a valid email address';
    }

    // Split by dots to check TLD
    const domainParts = domainPart.split('.');
    if (domainParts.length < 2) {
      return 'Enter a valid email address';
    }

    const tld = domainParts[domainParts.length - 1];
    // Require TLD to be at least 3 characters (rejects .co, .uk as standalone, but allows .co.uk, .com, .org)
    if (tld.length < 3 && domainParts.length === 2) {
      return 'Enter a valid email address';
    }

    // Blacklist: Reject known example/test/decoy domains
    const blacklistedDomains = [
      'example.com',
      'example.org',
      'example.net',
      'example.edu',
      'sample.com',
      'sample.org',
      'test.com',
      'test.org',
      'test.net',
      'decoy.com',
      'decoy.org',
      'fake.com',
      'fake.org',
      'dummy.com',
      'dummy.org',
      'placeholder.com',
      'placeholder.org',
      'demo.com',
      'demo.org',
      'trial.com',
      'trial.org'
    ];

    const lowerDomain = domainPart.toLowerCase();
    if (blacklistedDomains.some(blocked => lowerDomain === blocked || lowerDomain.endsWith('.' + blocked))) {
      return 'Please use a real email address (e.g., @gmail.com, @laverdad.edu.ph)';
    }

    // Whitelist: Accept known real email providers
    const realEmailProviders = [
      'gmail.com',
      'yahoo.com',
      'yahoo.com.ph',
      'outlook.com',
      'hotmail.com',
      'hotmail.com.ph',
      'icloud.com',
      'protonmail.com',
      'proton.me',
      'mail.com',
      'aol.com',
      'zoho.com',
      'yandex.com',
      'gmx.com',
      'live.com',
      'msn.com'
    ];

    // Check if domain is a real email provider
    const isRealProvider = realEmailProviders.some(provider =>
      lowerDomain === provider || lowerDomain.endsWith('.' + provider)
    );

    // Check if domain is educational (.edu or .edu.ph)
    const isEducational = lowerDomain.includes('.edu') || lowerDomain.includes('.edu.ph');

    // Accept if it's a real provider or educational domain
    if (isRealProvider || isEducational) {
      return '';
    }

    // For other domains, check if they look like real business domains
    // Reject if it contains obvious test/example keywords
    const testKeywords = ['example', 'sample', 'test', 'decoy', 'fake', 'dummy', 'placeholder', 'demo', 'trial'];
    const hasTestKeyword = testKeywords.some(keyword => lowerDomain.includes(keyword));

    if (hasTestKeyword) {
      return 'Please use a real email address (e.g., @gmail.com, @laverdad.edu.ph)';
    }

    // For other domains, accept if they have a proper structure (at least 2 parts before TLD)
    // This allows real business domains while being somewhat restrictive
    if (domainParts.length >= 2) {
      // Accept domains that look legitimate (have proper structure)
      return '';
    }

    return 'Please use a real email address (e.g., @gmail.com, @laverdad.edu.ph)';
  };

  const validateAddress = (address) => {
    // Address is optional, so only validate if provided
    if (address && address.length > 500) {
      return 'Address must be less than 500 characters';
    }
    return '';
  };

  const validateProgramGradeStrand = (value) => {
    if (!value.trim()) {
      return 'Program/Grade/Strand is required';
    }
    if (value.trim().length > 200) {
      return 'Program/Grade/Strand must be 200 characters or less';
    }
    return '';
  };

  const validateTransactionNoRealTime = (value) => {
    const trimmed = value.trim().toUpperCase();
    if (!trimmed) {
      return 'Transaction number is required';
    }

    // Must start with TR
    if (!trimmed.startsWith('TR')) {
      if (trimmed.length > 0 && trimmed[0] !== 'T') {
        return 'Must start with TR';
      }
      return ''; // Still typing, no error yet
    }

    // Check if dash is present
    if (!trimmed.includes('-')) {
      // Before dash: TR + up to 6 digits
      const beforeDash = trimmed;
      if (beforeDash.length > 2) {
        if (!/^TR\d+$/.test(beforeDash)) {
          return 'Invalid format. Expected: TR######-###';
        }
        if (beforeDash.length > 8) {
          return 'Too many digits. Expected: TR######-###';
        }
      }
      return ''; // Valid partial input before dash
    }

    // After dash: validate both parts
    const parts = trimmed.split('-');
    if (parts.length !== 2) {
      return 'Invalid format. Expected: TR######-###';
    }

    const firstPart = parts[0];
    const secondPart = parts[1];

    // Validate first part: TR + exactly 6 digits
    if (!/^TR\d{6}$/.test(firstPart)) {
      if (firstPart.length < 8) {
        return ''; // Still typing digits in first part
      }
      return 'First part must be TR followed by 6 digits. Expected: TR######-###';
    }

    // Validate second part: exactly 3 digits
    if (secondPart.length === 0) {
      return ''; // Waiting for second part
    }
    if (!/^\d+$/.test(secondPart)) {
      return 'Second part must be digits only. Expected: TR######-###';
    }
    if (secondPart.length > 3) {
      return 'Second part must be exactly 3 digits. Expected: TR######-###';
    }
    if (secondPart.length < 3) {
      return ''; // Still typing second part
    }

    // Complete format validation
    if (/^TR\d{6}-\d{3}$/.test(trimmed)) {
      return ''; // Valid complete format
    }

    return ''; // Partial input is valid
  };

  // Service options for the queue process - now dynamic
  const [serviceOptions, setServiceOptions] = useState([]);

  // TEMPORARY TESTING FEATURE: Physical keyboard input handlers
  // TODO: Remove before production deployment - for development/testing only
  const handlePhysicalInputChange = (fieldName, value) => {
    if (fieldName === 'idNumber') {
      setIdNumber(value);
    } else if (fieldName === 'documentRequestName') {
      handleDocumentRequestFieldChange('name', value);
    } else if (fieldName === 'documentRequestProgram') {
      handleDocumentRequestFieldChange('programGradeStrand', value);
    } else if (fieldName === 'documentRequestContact') {
      handleDocumentRequestFieldChange('contactNumber', value);
    } else if (fieldName === 'documentRequestEmail') {
      handleDocumentRequestFieldChange('emailAddress', value);
    } else if (fieldName === 'transactionNo') {
      const upperValue = value.toUpperCase();
      setTransactionNo(upperValue);
      if (transactionNoError) {
        setTransactionNoError('');
      }
    } else {
      setFormData(prev => {
        const updatedData = { ...prev, [fieldName]: value };

        // Real-time validation after value change
        let error = '';
        if (fieldName === 'name') {
          error = validateName(value);
        } else if (fieldName === 'contactNumber') {
          error = validateContactNumber(value);
        } else if (fieldName === 'email') {
          error = validateEmail(value);
        } else if (fieldName === 'address') {
          error = validateAddress(value);
        }

        setFormErrors(prevErrors => ({
          ...prevErrors,
          [fieldName]: error
        }));

        return updatedData;
      });
    }
  };

  // Keyboard handling functions (for virtual keyboard)
  const handleKeyPress = (key) => {
    if (activeField === 'idNumber') {
      setIdNumber(prev => prev + key);
    } else if (activeField === 'documentRequestName') {
      handleDocumentRequestFieldChange('name', documentRequestForm.name + key);
    } else if (activeField === 'documentRequestProgram') {
      handleDocumentRequestFieldChange('programGradeStrand', documentRequestForm.programGradeStrand + key);
    } else if (activeField === 'documentRequestContact') {
      handleDocumentRequestFieldChange('contactNumber', documentRequestForm.contactNumber + key);
    } else if (activeField === 'documentRequestEmail') {
      handleDocumentRequestFieldChange('emailAddress', documentRequestForm.emailAddress + key);
    } else if (activeField === 'transactionNo') {
      const newValue = (transactionNo + key).toUpperCase();
      setTransactionNo(newValue);
      // Real-time validation
      const error = validateTransactionNoRealTime(newValue);
      setTransactionNoError(error);
    } else {
      setFormData(prev => {
        const newValue = prev[activeField] + key;
        const updatedData = { ...prev, [activeField]: newValue };

        // Real-time validation after value change
        let error = '';
        if (activeField === 'name') {
          error = validateName(newValue);
        } else if (activeField === 'contactNumber') {
          error = validateContactNumber(newValue);
        } else if (activeField === 'email') {
          error = validateEmail(newValue);
        } else if (activeField === 'address') {
          error = validateAddress(newValue);
        }

        setFormErrors(prevErrors => ({
          ...prevErrors,
          [activeField]: error
        }));

        return updatedData;
      });
    }
  };

  const handleBackspace = () => {
    if (activeField === 'idNumber') {
      setIdNumber(prev => prev.slice(0, -1));
    } else if (activeField === 'documentRequestName') {
      handleDocumentRequestFieldChange('name', documentRequestForm.name.slice(0, -1));
    } else if (activeField === 'documentRequestProgram') {
      handleDocumentRequestFieldChange('programGradeStrand', documentRequestForm.programGradeStrand.slice(0, -1));
    } else if (activeField === 'documentRequestContact') {
      handleDocumentRequestFieldChange('contactNumber', documentRequestForm.contactNumber.slice(0, -1));
    } else if (activeField === 'documentRequestEmail') {
      handleDocumentRequestFieldChange('emailAddress', documentRequestForm.emailAddress.slice(0, -1));
    } else if (activeField === 'transactionNo') {
      const newValue = transactionNo.slice(0, -1);
      setTransactionNo(newValue);
      // Real-time validation after deletion
      const error = validateTransactionNoRealTime(newValue);
      setTransactionNoError(error);
    } else {
      setFormData(prev => {
        const newValue = prev[activeField].slice(0, -1);
        const updatedData = { ...prev, [activeField]: newValue };

        // Real-time validation after deletion
        let error = '';
        if (activeField === 'name') {
          error = validateName(newValue);
        } else if (activeField === 'contactNumber') {
          error = validateContactNumber(newValue);
        } else if (activeField === 'email') {
          error = validateEmail(newValue);
        } else if (activeField === 'address') {
          error = validateAddress(newValue);
        }

        setFormErrors(prevErrors => ({
          ...prevErrors,
          [activeField]: error
        }));

        return updatedData;
      });
    }
  };

  const handleSpace = () => {
    if (activeField === 'idNumber') {
      setIdNumber(prev => prev + ' ');
    } else if (activeField === 'documentRequestName') {
      handleDocumentRequestFieldChange('name', documentRequestForm.name + ' ');
    } else if (activeField === 'documentRequestProgram') {
      handleDocumentRequestFieldChange('programGradeStrand', documentRequestForm.programGradeStrand + ' ');
    } else if (activeField === 'documentRequestContact') {
      handleDocumentRequestFieldChange('contactNumber', documentRequestForm.contactNumber + ' ');
    } else if (activeField === 'documentRequestEmail') {
      handleDocumentRequestFieldChange('emailAddress', documentRequestForm.emailAddress + ' ');
    } else if (activeField === 'transactionNo') {
      // Transaction numbers don't have spaces, but handle it gracefully
      setTransactionNo(prev => prev);
    } else {
      setFormData(prev => {
        const newValue = prev[activeField] + ' ';
        const updatedData = { ...prev, [activeField]: newValue };

        // Real-time validation after space addition
        let error = '';
        if (activeField === 'name') {
          error = validateName(newValue);
        } else if (activeField === 'contactNumber') {
          error = validateContactNumber(newValue);
        } else if (activeField === 'email') {
          error = validateEmail(newValue);
        } else if (activeField === 'address') {
          error = validateAddress(newValue);
        }

        setFormErrors(prevErrors => ({
          ...prevErrors,
          [activeField]: error
        }));

        return updatedData;
      });
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

      const response = await fetch(`${API_CONFIG.getKioskUrl()}/api/public/office-status/${department}`);
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
      const response = await fetch(`${API_CONFIG.getKioskUrl()}/api/public/services/${department}`);
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
      const response = await fetch(`${API_CONFIG.getKioskUrl()}/api/public/location/${department}`);
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

  // Check printer availability when reaching result step
  useEffect(() => {
    if (currentStep === 'result') {
      // Reset print attempts when entering result step
      setPrintAttempts(0);
      // Check printer availability
      checkPrinterAvailability();
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
    // Special handling for Document Request and Document Claim services
    if (service === 'Document Request') {
      console.log('➡️ Going to documentRequestForm step');
      setCurrentStep('documentRequestForm');
      // Reset form and step
      setDocumentRequestForm({
        name: '',
        lastSYAttended: '',
        programGradeStrand: '',
        contactNumber: '',
        emailAddress: '',
        request: []
      });
      setDocumentRequestErrors({});
      setDocumentRequestFormStep(1);
      setShowKeyboard(true);
      setActiveField('documentRequestName');
    } else if (service === 'Document Claim') {
      console.log('➡️ Going to documentClaim step');
      setCurrentStep('documentClaim');
      setTransactionNo('');
      setTransactionNoError('');
      setShowKeyboard(true);
      setActiveField('transactionNo');
    } else if (service === 'Enroll') {
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

  // Check printer availability
  const checkPrinterAvailability = async () => {
    try {
      setPrinterChecking(true);
      console.log('🔍 Checking printer availability...');

      // Try to reach the local backend
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

      const response = await fetch(`${API_CONFIG.getPrintUrl()}/api/printer/check-availability`, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error('Printer check failed');
      }

      const result = await response.json();

      if (result.available && result.ready) {
        console.log('✅ Printer is available and ready');
        setPrinterAvailable(true);
        return true;
      } else {
        console.log('⚠️ Printer not ready:', result.message);
        setPrinterAvailable(false);
        return false;
      }

    } catch (error) {
      console.log('❌ Printer availability check failed:', error.message);
      // If we can't reach the backend or printer is not available
      setPrinterAvailable(false);
      return false;
    } finally {
      setPrinterChecking(false);
    }
  };

  // Print button handler - prints receipt with retry logic
  const handlePrintClick = async () => {
    // Prevent multiple clicks while printing
    if (isPrinting) {
      console.log('⚠️ Print already in progress, ignoring click');
      return;
    }

    // Check if we've exceeded max attempts
    if (printAttempts >= 3) {
      console.log('⚠️ Max print attempts reached');
      setPrintErrorMessage('Printing failed 3/3 times. Please scan the QR code for now. We apologize for the inconvenience.');
      setShowPrintErrorModal(true);
      return;
    }

    try {
      setIsPrinting(true); // Disable button
      setPrintAttempts(prev => prev + 1); // Increment attempt counter

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

      console.log(`🖨️  Sending print request (Attempt ${printAttempts + 1}/3):`, receiptData);

      // Call backend print API (always use local backend for printing)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`${API_CONFIG.getPrintUrl()}/api/printer/print-receipt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(receiptData),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const result = await response.json();

      if (result.success) {
        console.log('✅ Print successful:', result);
        showSuccess('Receipt printed successfully!');
        // Reset attempts on success
        setPrintAttempts(0);

        // Proceed to feedback step after successful print
        setTimeout(() => {
          setCurrentStep('feedback');
          setIsPrinting(false);
        }, 1500);
      } else {
        console.error('❌ Print failed:', result.message);

        // This is a temporary/recoverable error - show modal and allow retry
        if (printAttempts + 1 >= 3) {
          setPrintErrorMessage('Printing failed 3/3 times. Please scan the QR code for now. We apologize for the inconvenience.');
        } else {
          setPrintErrorMessage('Printing failed. Please try again.');
        }
        setShowPrintErrorModal(true);
        setIsPrinting(false);
      }

    } catch (error) {
      console.error('❌ Print error:', error);

      // Check if it's a network/connection error (printer/backend unavailable)
      if (error.name === 'AbortError' || error.message.includes('fetch')) {
        // This is a hardware/connectivity issue - mark printer as unavailable
        setPrinterAvailable(false);
        setIsPrinting(false);
      } else {
        // This is a temporary error - show modal and allow retry
        if (printAttempts + 1 >= 3) {
          setPrintErrorMessage('Printing failed 3/3 times. Please scan the QR code for now. We apologize for the inconvenience.');
        } else {
          setPrintErrorMessage('Printing failed. Please try again.');
        }
        setShowPrintErrorModal(true);
        setIsPrinting(false);
      }
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
        const response = await fetch(`${API_CONFIG.getKioskUrl()}/api/public/queue/${queueResult.queueId}/rating`, {
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

  // Document Request handlers
  const handleDocumentRequestFieldChange = (field, value) => {
    setDocumentRequestForm(prev => ({
      ...prev,
      [field]: value
    }));

    // Real-time validation after value change
    let error = '';
    if (field === 'name') {
      error = validateName(value);
    } else if (field === 'programGradeStrand') {
      error = validateProgramGradeStrand(value);
    } else if (field === 'contactNumber') {
      error = validateContactNumber(value);
    } else if (field === 'emailAddress') {
      error = validateEmail(value);
    }

    // Update errors state
    setDocumentRequestErrors(prev => ({
      ...prev,
      [field]: error
    }));
  };

  const handleDocumentRequestCheckboxChange = (requestType) => {
    setDocumentRequestForm(prev => {
      const currentRequests = prev.request || [];
      const isSelected = currentRequests.includes(requestType);
      return {
        ...prev,
        request: isSelected
          ? currentRequests.filter(r => r !== requestType)
          : [...currentRequests, requestType]
      };
    });
  };

  // Step-specific validation functions
  const validateDocumentRequestStep1 = () => {
    const errors = {};

    if (!documentRequestForm.name.trim()) {
      errors.name = 'Name is required';
    }

    if (!documentRequestForm.lastSYAttended) {
      errors.lastSYAttended = 'Last S.Y. Attended is required';
    }

    if (!documentRequestForm.programGradeStrand.trim()) {
      errors.programGradeStrand = 'Program/Grade/Strand is required';
    }

    setDocumentRequestErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateDocumentRequestStep2 = () => {
    const errors = {};

    if (!documentRequestForm.contactNumber.trim()) {
      errors.contactNumber = 'Contact number is required';
    } else if (!/^(\+63|0)[0-9]{10}$/.test(documentRequestForm.contactNumber.trim())) {
      errors.contactNumber = 'Contact number must be a valid Philippine phone number';
    }

    if (!documentRequestForm.emailAddress.trim()) {
      errors.emailAddress = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(documentRequestForm.emailAddress.trim())) {
      errors.emailAddress = 'Email must be valid';
    }

    setDocumentRequestErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateDocumentRequestStep3 = () => {
    const errors = {};

    if (!documentRequestForm.request || documentRequestForm.request.length === 0) {
      errors.request = 'At least one request type must be selected';
    }

    setDocumentRequestErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateDocumentRequestForm = () => {
    // Validate all steps
    const step1Valid = validateDocumentRequestStep1();
    const step2Valid = validateDocumentRequestStep2();
    const step3Valid = validateDocumentRequestStep3();
    return step1Valid && step2Valid && step3Valid;
  };

  // Step navigation handlers
  const handleDocumentRequestStep1Next = () => {
    if (validateDocumentRequestStep1()) {
      setDocumentRequestFormStep(2);
      setActiveField('documentRequestContact');
      setShowKeyboard(true);
    }
  };

  const handleDocumentRequestStep2Next = () => {
    if (validateDocumentRequestStep2()) {
      setDocumentRequestFormStep(3);
      setShowKeyboard(false); // Step 3 doesn't need keyboard
    }
  };

  const handleDocumentRequestStep2Previous = () => {
    setDocumentRequestFormStep(1);
    setActiveField('documentRequestName');
    setShowKeyboard(true);
  };

  const handleDocumentRequestStep3Previous = () => {
    setDocumentRequestFormStep(2);
    setActiveField('documentRequestContact');
    setShowKeyboard(true);
  };

  const handleDocumentRequestStep3Next = () => {
    if (validateDocumentRequestStep3()) {
      setShowConfirmationModal(true);
    }
  };

  const handleDocumentRequestSubmit = async () => {
    // This is now only called from step 3
    if (!validateDocumentRequestStep3()) {
      return;
    }

    setShowConfirmationModal(true);
  };

  const handleDocumentRequestConfirm = async () => {
    setShowConfirmationModal(false);

    try {
      const response = await fetch(`${API_CONFIG.getKioskUrl()}/api/public/document-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: documentRequestForm.name.trim(),
          lastSYAttended: documentRequestForm.lastSYAttended,
          programGradeStrand: documentRequestForm.programGradeStrand.trim(),
          contactNumber: documentRequestForm.contactNumber.trim(),
          emailAddress: documentRequestForm.emailAddress.trim().toLowerCase(),
          request: documentRequestForm.request
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setShowDocumentRequestThankYou(true);
      } else {
        showError('Submission Failed', result.error || 'Failed to submit document request');
      }
    } catch (error) {
      console.error('Error submitting document request:', error);
      showError('Network Error', 'Please check your connection and try again.');
    }
  };

  const handleDocumentRequestThankYouClose = () => {
    setShowDocumentRequestThankYou(false);
    // Proceed to ratings step
    setCurrentStep('feedback');
  };

  // Document Claim handlers
  const validateTransactionNo = () => {
    const trimmed = transactionNo.trim().toUpperCase();
    if (!trimmed) {
      setTransactionNoError('Transaction number is required');
      return false;
    }
    if (!/^TR\d{6}-\d{3}$/.test(trimmed)) {
      setTransactionNoError('Invalid format. Expected: TR######-###');
      return false;
    }
    setTransactionNoError('');
    return true;
  };

  const handleDocumentClaimSubmit = async () => {
    if (!validateTransactionNo()) {
      return;
    }

    try {
      // Validate transaction number exists and is approved
      const response = await fetch(`${API_CONFIG.getKioskUrl()}/api/public/queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          office: 'registrar',
          service: 'Document Claim',
          role: 'Visitor', // Default role for Document Claim
          transactionNo: transactionNo.trim().toUpperCase()
        })
      });

      let result;
      try {
        result = await response.json();
      } catch (jsonError) {
        // If response is not JSON, create a result object with error
        result = {
          success: false,
          error: response.statusText || 'An error occurred'
        };
      }

      if (response.ok && result.success) {
        // Store queue data
        setQueueResult({
          queueId: result.data.queueId,
          queueNumber: result.data.queueNumber,
          office: result.data.office,
          service: result.data.service,
          qrCodeUrl: result.data.qrCodeUrl,
          estimatedWaitTime: result.data.estimatedWaitTime,
          windowName: result.data.windowName
        });

        // Generate QR code
        if (result.data.qrCodeUrl) {
          await generateQRCode(result.data.qrCodeUrl);
        }

        // Move to result step
        setCurrentStep('result');
      } else {
        // Show error modal instead of toast
        const errorMessage = result?.error || result?.message || 'Invalid transaction number or request not approved';
        console.log('❌ [FRONTEND] Document Claim Error:', {
          status: response.status,
          statusText: response.statusText,
          result,
          errorMessage
        });
        setTransactionNoErrorMessage(errorMessage);
        setShowTransactionNoErrorModal(true);
        console.log('✅ [FRONTEND] Modal state set:', {
          showTransactionNoErrorModal: true,
          transactionNoErrorMessage: errorMessage
        });
      }
    } catch (error) {
      console.error('Error validating transaction number:', error);
      // Show error modal instead of toast
      setTransactionNoErrorMessage('Please check your connection and try again.');
      setShowTransactionNoErrorModal(true);
    }
  };

  // Special handler for Enroll service submission with explicit values
  // Accepts optional officeKey parameter to override selectedDepartment (for office switching)
  const handleEnrollSubmission = async (officeKey = null) => {
    try {
      console.log('🎓 [FRONTEND] Starting handleEnrollSubmission');
      console.log('🎓 [FRONTEND] Office key parameter:', officeKey);

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

      // Determine office: use parameter if provided, otherwise use selectedDepartment
      let office;
      if (officeKey) {
        office = officeKey; // Use the explicitly passed office key
        console.log('🔄 [FRONTEND] Using explicit office key:', office);
      } else {
        office = selectedDepartment.name === "Registrar's Office" ? 'registrar' : 'admissions';
        console.log('🔄 [FRONTEND] Using selectedDepartment office:', office);
      }

      // Prepare submission data with explicit values for Enroll service
      const submissionData = {
        office: office,
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

      // Submit to backend API (use local backend for kiosk operations)
      const apiUrl = `${API_CONFIG.getKioskUrl()}/api/public/queue`;
      console.log('🌐 [FRONTEND] Making API request to:', apiUrl);
      const response = await fetch(apiUrl, {
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
          transactionNo: result.data.transactionNo, // Store transaction number
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

      // Submit to backend API (use local backend for kiosk operations)
      const apiUrl = `${API_CONFIG.getKioskUrl()}/api/public/queue`;
      console.log('🌐 [FRONTEND] Making API request to:', apiUrl);
      const response = await fetch(apiUrl, {
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
      console.log('🔄 [FRONTEND] Checking if Enroll service is available in', suggestedOffice.name);

      // First, check if the target office is open
      const isOfficeOpen = await checkOfficeStatus(suggestedOffice.key);

      if (!isOfficeOpen) {
        console.log('❌ [FRONTEND] Target office is closed');
        setShowOfficeMismatchModal(false);
        setSuggestedOffice(null);
        setServiceUnavailableInfo({
          officeName: suggestedOffice.name,
          serviceName: 'Enroll'
        });
        setShowServiceUnavailableModal(true);
        return;
      }

      // Check if Enroll service is available in the target office
      try {
        const response = await fetch(`${API_CONFIG.getKioskUrl()}/api/public/services/${suggestedOffice.key}`);
        const data = await response.json();

        console.log('📋 [FRONTEND] Services in target office:', data);

        if (!data.isEnabled) {
          console.log('❌ [FRONTEND] Target office is not enabled');
          setShowOfficeMismatchModal(false);
          setSuggestedOffice(null);
          setServiceUnavailableInfo({
            officeName: suggestedOffice.name,
            serviceName: 'Enroll'
          });
          setShowServiceUnavailableModal(true);
          return;
        }

        const enrollServiceAvailable = data.services?.some(service => service.name === 'Enroll');

        if (!enrollServiceAvailable) {
          console.log('❌ [FRONTEND] Enroll service not available in target office');
          setShowOfficeMismatchModal(false);
          setSuggestedOffice(null);
          setServiceUnavailableInfo({
            officeName: suggestedOffice.name,
            serviceName: 'Enroll'
          });
          setShowServiceUnavailableModal(true);
          return;
        }

        console.log('✅ [FRONTEND] Enroll service is available in target office');

        // Switch to the suggested office and proceed directly to result
        setSelectedDepartment(departmentData[suggestedOffice.key]);
        setShowOfficeMismatchModal(false);

        // For Enroll service, set required fields and submit to backend
        console.log('🔄 [FRONTEND] Office mismatch resolved - setting Enroll service defaults and submitting');
        setSelectedRole('Student'); // Enroll is always for students
        setPriorityStatus('no'); // Default priority status

        // Submit to backend to ensure queue entry is recorded in database
        console.log('🚀 [FRONTEND] Submitting Enroll service after office switch...');
        console.log('🚀 [FRONTEND] Target office key:', suggestedOffice.key);

        // Submit immediately with explicit office key to avoid state timing issues
        // Pass the suggestedOffice.key directly to ensure correct office is used
        handleEnrollSubmission(suggestedOffice.key);

        // Clear suggestedOffice after submission
        setSuggestedOffice(null);
      } catch (error) {
        console.error('❌ [FRONTEND] Error checking service availability:', error);
        setShowOfficeMismatchModal(false);
        setSuggestedOffice(null);
        setServiceUnavailableInfo({
          officeName: suggestedOffice.name,
          serviceName: 'Enroll'
        });
        setShowServiceUnavailableModal(true);
      }
    }
  };

  const handleOfficeMismatchClose = () => {
    setShowOfficeMismatchModal(false);
    setSuggestedOffice(null);
  };

  const handleServiceUnavailableClose = () => {
    setShowServiceUnavailableModal(false);
    setServiceUnavailableInfo({ officeName: '', serviceName: '' });
    // Reset to service selection step
    setCurrentStep('service');
    setStudentStatus(null);
  };

  // Check if form steps are valid - must have no validation errors
  const isFormStep1Valid =
    formData.name.trim() &&
    formData.contactNumber.trim() &&
    !formErrors.name &&
    !formErrors.contactNumber;

  // Document Request form step validation (computed values to avoid setting errors on every render)
  const isDocumentRequestStep1Valid =
    documentRequestForm.name.trim() &&
    documentRequestForm.lastSYAttended &&
    documentRequestForm.programGradeStrand.trim() &&
    !documentRequestErrors.name &&
    !documentRequestErrors.lastSYAttended &&
    !documentRequestErrors.programGradeStrand;

  const isDocumentRequestStep2Valid =
    documentRequestForm.contactNumber.trim() &&
    documentRequestForm.emailAddress.trim() &&
    !documentRequestErrors.contactNumber &&
    !documentRequestErrors.emailAddress &&
    /^(\+63|0)[0-9]{10}$/.test(documentRequestForm.contactNumber.trim()) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(documentRequestForm.emailAddress.trim());

  const isDocumentRequestStep3Valid =
    documentRequestForm.request && documentRequestForm.request.length > 0;

  const isFormStep2Valid =
    formData.email.trim() &&
    !formErrors.email &&
    !formErrors.address; // Address is optional, but if provided must be valid



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

      case 'documentRequestForm':
        // Go back based on current step
        if (documentRequestFormStep === 1) {
          // Step 1: Go back to service selection
          setCurrentStep('service');
          setDocumentRequestForm({
            name: '',
            lastSYAttended: '',
            programGradeStrand: '',
            contactNumber: '',
            emailAddress: '',
            request: []
          });
          setDocumentRequestErrors({});
          setDocumentRequestFormStep(1);
        } else if (documentRequestFormStep === 2) {
          // Step 2: Go back to step 1
          handleDocumentRequestStep2Previous();
        } else if (documentRequestFormStep === 3) {
          // Step 3: Go back to step 2
          handleDocumentRequestStep3Previous();
        }
        break;

      case 'documentClaim':
        // Go back to service selection
        setCurrentStep('service');
        setTransactionNo('');
        setTransactionNoError('');
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
            <div className="flex items-center justify-center w-full px-8">
              <div className="flex items-center gap-3 relative">
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
                        ID NUMBER <span className="text-gray-700">(REQUIRED)</span>
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

                {/* Navigation buttons positioned next to form container */}
                <div className="flex flex-col space-y-3">
                <button
                  onClick={handleIdVerificationNext}
                  disabled={!idNumber.trim()}
                  className={`w-20 h-20 rounded-full border-2 border-white font-bold text-xs transition-all duration-150 shadow-lg ${
                    !idNumber.trim()
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-[#FFE251] text-[#1F3463] active:bg-[#FFD700] active:shadow-md active:scale-95'
                  }`}
                >
                  NEXT
                </button>
                <button
                  onClick={handleIdVerificationPrevious}
                  className="w-20 h-20 rounded-full border-2 border-white bg-[#1F3463] text-white font-bold text-xs active:bg-[#1A2E56] active:shadow-md active:scale-95 transition-all duration-150 shadow-lg"
                >
                  PREVIOUS
                </button>
              </div>
              </div>
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
          activeInputLabel="ID NUMBER (REQUIRED)"
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
            <div className="flex items-center justify-center w-full px-8">
              <div className="flex items-center gap-3 relative">
                {/* Form Section - Perfectly centered */}
                <div className="bg-white rounded-lg shadow-xl drop-shadow-lg p-6 w-[500px]">
                  <div className="space-y-4">
                    {/* Name Field */}
                    <div>
                      <label htmlFor="name" className="block text-xl font-semibold text-gray-700 mb-2">
                        NAME <span className="text-gray-700">(REQUIRED)</span>
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
                        CONTACT NUMBER <span className="text-gray-700">(REQUIRED)</span>
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

                {/* Navigation buttons positioned next to form container */}
                <div className="flex flex-col space-y-3">
                <button
                  onClick={handleFormStep1Next}
                  disabled={!isFormStep1Valid}
                  className={`w-20 h-20 rounded-full border-2 border-white font-bold text-xs transition-all duration-150 shadow-lg ${
                    !isFormStep1Valid
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-[#FFE251] text-[#1F3463] active:bg-[#FFD700] active:shadow-md active:scale-95'
                  }`}
                >
                  NEXT
                </button>
                <button
                  onClick={handleFormStep1Previous}
                  className="w-20 h-20 rounded-full border-2 border-white bg-[#1F3463] text-white font-bold text-xs active:bg-[#1A2E56] active:shadow-md active:scale-95 transition-all duration-150 shadow-lg"
                >
                  PREVIOUS
                </button>
              </div>
              </div>
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
              label: 'NAME (REQUIRED)',
              value: formData.name,
              placeholder: 'Enter your full name'
            },
            {
              name: 'contactNumber',
              label: 'CONTACT NUMBER (REQUIRED)',
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
            <div className="flex items-center justify-center w-full px-8">
              <div className="flex items-center gap-3 relative">
                {/* Form Section - Perfectly centered */}
                <div className="bg-white rounded-lg shadow-xl drop-shadow-lg p-6 w-[500px]">
                  <div className="space-y-4">
                    {/* Email Field */}
                    <div className="relative">
                      <div className="flex justify-between items-center mb-2">
                        <label htmlFor="email" className="block text-xl font-semibold text-gray-700">
                          EMAIL <span className="text-gray-700">(REQUIRED)</span>
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
                          ADDRESS <span className="text-gray-500">(OPTIONAL)</span>
                        </label>
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

                {/* Navigation buttons positioned next to form container */}
                <div className="flex flex-col space-y-3">
                <button
                  onClick={handleFormStep2Next}
                  disabled={!isFormStep2Valid}
                  className={`w-20 h-20 rounded-full border-2 border-white font-bold text-xs transition-all duration-150 shadow-lg ${
                    !isFormStep2Valid
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-[#FFE251] text-[#1F3463] active:bg-[#FFD700] active:shadow-md active:scale-95'
                  }`}
                >
                  NEXT
                </button>
                <button
                  onClick={handleFormStep2Previous}
                  className="w-20 h-20 rounded-full border-2 border-white bg-[#1F3463] text-white font-bold text-xs active:bg-[#1A2E56] active:shadow-md active:scale-95 transition-all duration-150 shadow-lg"
                >
                  PREVIOUS
                </button>
              </div>
              </div>
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
              label: 'EMAIL (REQUIRED)',
              value: formData.email,
              placeholder: 'Enter your email address'
            },
            {
              name: 'address',
              label: 'ADDRESS (OPTIONAL)',
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
      <QueueLayout noScroll={true}>
        <div className="h-full flex items-center justify-center overflow-hidden px-8 py-8">
          {/* Main Content Area - 2 columns layout with equal widths */}
          <div className="flex gap-6 items-center justify-center">
            {/* First Div - QR Code Section */}
            <div className="bg-white rounded-3xl shadow-xl drop-shadow-lg p-2 flex flex-col items-center justify-center min-h-0 overflow-hidden w-[500px] h-[500px]">
              {/* Top Text */}
              <h2 className="text-2xl font-bold text-gray-800 mb-3 text-center flex-shrink-0">
                Scan the QR Code for your Queue Number
              </h2>

              {/* QR Code Image - Centered */}
              <div className="flex-1 flex items-center justify-center min-h-0 w-full max-h-full overflow-hidden">
                <div className="w-full max-w-[380px] aspect-square bg-white border-2 border-gray-300 rounded-lg flex items-center justify-center">
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
                        <div className="text-3xl mb-2">📱</div>
                        <div className="text-sm">Generating QR Code...</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Second Div - Queue Information */}
            <div className="bg-white rounded-3xl shadow-xl drop-shadow-lg p-4 flex flex-col items-center justify-center min-h-0 overflow-hidden w-[500px] h-[500px]">
              {/* Spacer for top balance */}
              <div className="flex-shrink-0 h-4"></div>

              {/* Large Queue Number with Circular Border */}
              <div className="flex items-center justify-center mb-2 flex-shrink-0">
                <div className="w-32 h-32 border-4 border-[#1F3463] rounded-full flex items-center justify-center">
                  <span className="text-4xl font-bold text-[#1F3463] leading-none">
                    {queueNumber.toString().padStart(2, '0')}
                  </span>
                </div>
              </div>

              {/* Queue Number Label */}
              <h3 className="text-2xl font-bold text-center text-gray-800 mb-1.5 flex-shrink-0 px-4">
                Queue Number
              </h3>

              {/* Transaction Number */}
              {queueResult?.transactionNo && (
                <div className="mb-1.5 text-center flex-shrink-0 px-4">
                  <span className="text-base text-gray-700">Transaction No:<br /></span>
                  <span className="text-lg font-semibold text-gray-800 break-all">
                    {queueResult.transactionNo}
                  </span>
                </div>
              )}

              {/* Location Text */}
              <div className="mb-1.5 text-center flex-shrink-0 px-4">
                <span className="text-base text-gray-700">Location:<br /></span>
                <span className="text-xl font-semibold text-gray-700 break-words">
                  {(() => {
                    if (!selectedDepartment) return 'Location not set';
                    const departmentKey = selectedDepartment.name === "Registrar's Office" ? 'registrar' : 'admissions';
                    return departmentLocations[departmentKey] || 'Location not set';
                  })()}
                </span>
              </div>

              {/* Instruction Text */}
              <div className="mb-1.5 text-center flex-shrink-0 px-4">
                <span className="text-base text-gray-700">Please Proceed to <br /></span>
                <span className="text-xl font-semibold text-gray-700 break-words">{windowName}</span>
              </div>

              {/* Validity Notice */}
              <div className="mb-2 text-center flex-shrink-0 px-4">
                <p className="text-xs font-semibold text-[#1F3463] break-words">
                  This ticket is only valid on {formatCurrentDate()}
                </p>
              </div>

              {/* Print Button - Dynamic based on printer availability */}
              <button
                onClick={handlePrintClick}
                disabled={isPrinting || !printerAvailable || printerChecking || printAttempts >= 3}
                className={`px-12 py-2 rounded-full font-bold text-base transition-all duration-150 shadow-lg flex-shrink-0 mb-1 ${
                  isPrinting
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : !printerAvailable || printAttempts >= 3
                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                    : printerChecking
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-[#FFE251] text-black active:bg-[#1A2E56] active:shadow-md active:scale-95'
                }`}
              >
                {isPrinting
                  ? 'PRINTING...'
                  : printerChecking
                  ? 'CHECKING...'
                  : !printerAvailable || printAttempts >= 3
                  ? 'UNAVAILABLE'
                  : 'PRINT'}
              </button>

              {/* Printer Status Message */}
              {!printerAvailable && !printerChecking && (
                <p className="text-xs text-red-600 text-center px-4">
                  Printer offline. Please use QR code.
                </p>
              )}
              {printAttempts >= 3 && (
                <p className="text-xs text-red-600 text-center px-4">
                  Max attempts reached. Please use QR code.
                </p>
              )}

              {/* Spacer for bottom balance */}
              <div className="flex-shrink-0 h-4"></div>
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
        <motion.div
          className="h-full flex flex-col"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Office Selection Grid */}
          <div className="flex-grow flex items-center justify-center h-full">
            {/* Centered Header-Grid Unit with Fixed Positioning */}
            <div className="flex flex-col items-center w-full px-20">
              {/* Fixed Header - Absolute positioning to prevent movement */}
              <motion.div
                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 -mt-32"
                variants={headerVariants}
              >
                <h2 className="text-5xl font-semibold text-center drop-shadow-lg whitespace-nowrap mb-2" style={{ color: '#1F3463' }}>
                  SELECT OFFICE
                </h2>
                {/* Subheader */}
                <p className="text-3xl font-bold text-center drop-shadow-lg mb-16" style={{ color: '#1F3463' }}>
                  CUT OFF TIME: 5:00 PM
                </p>
              </motion.div>

              {/* Office Grid Container - Fixed positioning below header */}
              <motion.div
                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 mt-14"
                variants={containerVariants}
              >
                <div className="grid grid-cols-2 gap-x-32 gap-y-8 max-w-4xl mx-auto">
                  {offices.filter(office => office && office.key).map((office, index) => {
                    const status = officeStatus[office.key] || { isEnabled: false, loading: false };
                    const isDisabled = !status.isEnabled;
                    const isLoading = status.loading;

                    return (
                      <motion.button
                        key={office.key}
                        onClick={() => !isDisabled && handleOfficeSelect(office.key)}
                        disabled={isDisabled || isLoading}
                        variants={gridItemVariants}
                        custom={index}
                        className={`w-64 text-white rounded-3xl shadow-lg drop-shadow-md p-5 transition-all duration-200 border-2 border-transparent focus:outline-none focus:ring-3 focus:ring-blue-200 relative ${
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
                          <div className="mb-3">
                            <img
                              src={`/queue/${office.key}.png`}
                              alt={`${office.name} Icon`}
                              className={`w-27 h-27 object-contain rounded-xl ${isDisabled ? 'grayscale' : ''}`}
                            />
                          </div>
                          {/* Office Name */}
                          <h3 className="text-lg font-semibold text-white">
                            {office.name}
                          </h3>
                          {/* Status Badge */}
                          {isLoading ? (
                            <div className="mt-1.5 px-2.5 py-0.5 bg-yellow-500 text-white text-xs rounded-full">
                              Checking...
                            </div>
                          ) : isDisabled ? (
                            <div className="mt-1.5 px-2.5 py-0.5 bg-red-500 text-white text-xs rounded-full">
                              Closed
                            </div>
                          ) : (
                            <div className="mt-1.5 px-2.5 py-0.5 bg-green-500 text-white text-xs rounded-full">
                              Open
                            </div>
                          )}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
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
                <div className="flex-shrink-0 pb-1.5">
                  <h2 className="text-4xl font-semibold text-center drop-shadow-lg" style={{ color: '#1F3463' }}>
                    SELECT OFFICE
                  </h2>
                </div>

                {/* Centered Grid Container */}
                <div className="pt-3">
                  {/* 2 Office Grid - Disabled state */}
                  <div className="grid grid-cols-2 gap-x-26 gap-y-6 max-w-4xl mx-auto">
                  {offices.filter(office => office && office.key).map((office) => (
                    <button
                      key={office.key}
                      disabled
                      className="w-64 text-white rounded-3xl shadow-lg drop-shadow-md p-5 opacity-60 cursor-not-allowed border-2 border-transparent"
                      style={{ backgroundColor: '#1F3463' }}
                    >
                      <div className="text-center flex flex-col items-center">
                        {/* Office Image */}
                        <div className="mb-3 px-3">
                          <img
                            src={`/queue/${office.key}.png`}
                            alt={`${office.name} Icon`}
                            className="w-20 h-20 object-contain rounded-xl"
                          />
                        </div>
                        {/* Office Name */}
                        <h3 className="text-lg font-semibold text-white">
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
            <div className="flex flex-col items-center justify-center w-full px-16 h-full">
              {/* Header - Positioned above grid with proper spacing */}
              <div className="mb-6">
                <h2 className="text-4xl font-semibold text-center drop-shadow-lg whitespace-nowrap" style={{ color: '#1F3463' }}>
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
                      <h3 className="text-lg font-semibold text-white">
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
            <div className="mb-10">
              <h2 className="text-4xl font-semibold text-center drop-shadow-lg whitespace-nowrap mb-3" style={{ color: '#1F3463' }}>
                ARE YOU AN INCOMING NEW STUDENT?
              </h2>
              {/* Subheader */}
              <p className="text-2xl font-light text-center drop-shadow-lg" style={{ color: '#1F3463' }}>
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
                    <h3 className="text-lg font-semibold text-white">
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

        {/* Service Unavailable Modal */}
        <ServiceUnavailableModal
          isOpen={showServiceUnavailableModal}
          onClose={handleServiceUnavailableClose}
          officeName={serviceUnavailableInfo.officeName}
          serviceName={serviceUnavailableInfo.serviceName}
        />
      </>
    );
  }

  // Document Request Form Step
  if (currentStep === 'documentRequestForm') {
    // Generate year options from 2025-2026 backwards
    const currentYear = new Date().getFullYear();
    const yearOptions = [];
    for (let year = currentYear + 1; year >= 2000; year--) {
      yearOptions.push(`${year}-${year + 1}`);
    }

    const requestTypes = [
      'Certificate of Enrollment',
      'Form 137',
      'Transcript of Records',
      'Good Moral Certificate',
      'Certified True Copy of Documents',
      'Education Service Contracting Certificate (ESC)'
    ];

    // Step 1: Name, Last S.Y. Attended, Program/Grade/Strand
    if (documentRequestFormStep === 1) {
      return (
        <>
          <QueueLayout>
            <style>{`
              .kiosk-container header { display: none !important; }
            `}</style>

            <div className="h-full flex flex-col justify-center overflow-y-auto">
              <div className="flex items-center justify-center w-full px-8 py-8">
                <div className="flex items-center gap-3 relative">
                  <div className="bg-white rounded-lg shadow-xl drop-shadow-lg p-6 w-[600px] max-h-[90vh] overflow-y-auto">
                    <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">
                      Document Request Form
                    </h2>

                    <div className="space-y-4">
                      {/* Name */}
                      <div>
                        <label className="block text-lg font-semibold text-gray-700 mb-2">
                          Name <span className="text-gray-700">(REQUIRED)</span>
                        </label>
                        <input
                          type="text"
                          value={documentRequestForm.name}
                          onFocus={() => {
                            setActiveField('documentRequestName');
                            setShowKeyboard(true);
                          }}
                          onChange={(e) => handleDocumentRequestFieldChange('name', e.target.value)}
                          className={`w-full px-3 py-2 border-2 rounded-lg text-lg focus:outline-none ${
                            activeField === 'documentRequestName'
                              ? 'border-blue-500 bg-blue-50'
                              : documentRequestErrors.name
                              ? 'border-red-500 bg-red-50'
                              : 'border-gray-300 bg-gray-50'
                          }`}
                          placeholder="Enter your full name"
                        />
                        {documentRequestErrors.name && (
                          <p className="text-red-600 text-sm mt-1">{documentRequestErrors.name}</p>
                        )}
                      </div>

                      {/* Program/Grade/Strand */}
                      <div>
                        <label className="block text-lg font-semibold text-gray-700 mb-2">
                          Program/Grade/Strand <span className="text-gray-700">(REQUIRED)</span>
                        </label>
                        <input
                          type="text"
                          value={documentRequestForm.programGradeStrand}
                          onFocus={() => {
                            setActiveField('documentRequestProgram');
                            setShowKeyboard(true);
                          }}
                          onChange={(e) => handleDocumentRequestFieldChange('programGradeStrand', e.target.value)}
                          className={`w-full px-3 py-2 border-2 rounded-lg text-lg focus:outline-none ${
                            activeField === 'documentRequestProgram'
                              ? 'border-blue-500 bg-blue-50'
                              : documentRequestErrors.programGradeStrand
                              ? 'border-red-500 bg-red-50'
                              : 'border-gray-300 bg-gray-50'
                          }`}
                          placeholder="Enter program, grade, or strand"
                        />
                        {documentRequestErrors.programGradeStrand && (
                          <p className="text-red-600 text-sm mt-1">{documentRequestErrors.programGradeStrand}</p>
                        )}
                      </div>

                      {/* Last S.Y. Attended */}
                      <div>
                        <label className="block text-lg font-semibold text-gray-700 mb-2">
                          Last S.Y. Attended <span className="text-gray-700">(REQUIRED)</span>
                        </label>
                        <select
                          value={documentRequestForm.lastSYAttended}
                          onChange={(e) => handleDocumentRequestFieldChange('lastSYAttended', e.target.value)}
                          className={`w-full px-3 py-2 border-2 rounded-lg text-lg focus:outline-none ${
                            documentRequestErrors.lastSYAttended
                              ? 'border-red-500 bg-red-50'
                              : 'border-gray-300 bg-gray-50'
                          }`}
                        >
                          <option value="">Select School Year</option>
                          {yearOptions.map(year => (
                            <option key={year} value={year}>{year}</option>
                          ))}
                        </select>
                        {documentRequestErrors.lastSYAttended && (
                          <p className="text-red-600 text-sm mt-1">{documentRequestErrors.lastSYAttended}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Navigation buttons */}
                  <div className="flex flex-col space-y-3">
                    <button
                      onClick={handleDocumentRequestStep1Next}
                      disabled={!isDocumentRequestStep1Valid}
                      className={`w-20 h-20 rounded-full border-2 border-white font-bold text-xs transition-all duration-150 shadow-lg ${
                        !isDocumentRequestStep1Valid
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-[#FFE251] text-[#1F3463] active:bg-[#FFD700] active:shadow-md active:scale-95'
                      }`}
                    >
                      NEXT
                    </button>
                    <button
                      onClick={() => {
                        setCurrentStep('service');
                        setDocumentRequestForm({
                          name: '',
                          lastSYAttended: '',
                          programGradeStrand: '',
                          contactNumber: '',
                          emailAddress: '',
                          request: []
                        });
                        setDocumentRequestErrors({});
                        setDocumentRequestFormStep(1);
                      }}
                      className="w-20 h-20 rounded-full border-2 border-white bg-[#1F3463] text-white font-bold text-xs active:bg-[#1A2E56] transition-all duration-150 shadow-lg active:shadow-md active:scale-95"
                    >
                      PREVIOUS
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <BackButton />
          </QueueLayout>

          <HolographicKeyboard
            onKeyPress={handleKeyPress}
            onBackspace={handleBackspace}
            onSpace={handleSpace}
            onHide={hideKeyboard}
            isVisible={showKeyboard}
            showAllFields={true}
            allFieldsData={[
              {
                name: 'documentRequestName',
                label: 'Name (REQUIRED)',
                value: documentRequestForm.name,
                placeholder: 'Enter your full name'
              },
              {
                name: 'documentRequestProgram',
                label: 'Program/Grade/Strand (REQUIRED)',
                value: documentRequestForm.programGradeStrand,
                placeholder: 'Enter program, grade, or strand'
              }
            ]}
            activeFieldName={activeField}
            onFieldFocus={handleFieldFocus}
            formErrors={{
              documentRequestName: documentRequestErrors.name,
              documentRequestProgram: documentRequestErrors.programGradeStrand
            }}
            showNavigationButtons={true}
            navigationButtons={[
              {
                label: 'NEXT',
                onClick: handleDocumentRequestStep1Next,
                disabled: !isDocumentRequestStep1Valid,
                variant: 'next'
              },
              {
                label: 'PREVIOUS',
                onClick: () => {
                  setCurrentStep('service');
                  setDocumentRequestForm({
                    name: '',
                    lastSYAttended: '',
                    programGradeStrand: '',
                    contactNumber: '',
                    emailAddress: '',
                    request: []
                  });
                  setDocumentRequestErrors({});
                  setDocumentRequestFormStep(1);
                },
                disabled: false,
                variant: 'previous'
              }
            ]}
          />
        </>
      );
    }

    // Step 2: Contact No., Email Address
    if (documentRequestFormStep === 2) {
      return (
        <>
          <QueueLayout>
            <style>{`
              .kiosk-container header { display: none !important; }
            `}</style>

            <div className="h-full flex flex-col justify-center overflow-y-auto">
              <div className="flex items-center justify-center w-full px-8 py-8">
                <div className="flex items-center gap-3 relative">
                  <div className="bg-white rounded-lg shadow-xl drop-shadow-lg p-6 w-[600px] max-h-[90vh] overflow-y-auto">
                    <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">
                      Document Request Form
                    </h2>

                    <div className="space-y-4">
                      {/* Contact Number */}
                      <div>
                        <label className="block text-lg font-semibold text-gray-700 mb-2">
                          Contact No. <span className="text-gray-700">(REQUIRED)</span>
                        </label>
                        <input
                          type="text"
                          value={documentRequestForm.contactNumber}
                          onFocus={() => {
                            setActiveField('documentRequestContact');
                            setShowKeyboard(true);
                          }}
                          onChange={(e) => handleDocumentRequestFieldChange('contactNumber', e.target.value)}
                          className={`w-full px-3 py-2 border-2 rounded-lg text-lg focus:outline-none ${
                            activeField === 'documentRequestContact'
                              ? 'border-blue-500 bg-blue-50'
                              : documentRequestErrors.contactNumber
                              ? 'border-red-500 bg-red-50'
                              : 'border-gray-300 bg-gray-50'
                          }`}
                          placeholder="+63XXXXXXXXXX or 0XXXXXXXXXX"
                        />
                        {documentRequestErrors.contactNumber && (
                          <p className="text-red-600 text-sm mt-1">{documentRequestErrors.contactNumber}</p>
                        )}
                      </div>

                      {/* Email Address */}
                      <div>
                        <label className="block text-lg font-semibold text-gray-700 mb-2">
                          Email Address <span className="text-gray-700">(REQUIRED)</span>
                        </label>
                        <input
                          type="email"
                          value={documentRequestForm.emailAddress}
                          onFocus={() => {
                            setActiveField('documentRequestEmail');
                            setShowKeyboard(true);
                          }}
                          onChange={(e) => handleDocumentRequestFieldChange('emailAddress', e.target.value)}
                          className={`w-full px-3 py-2 border-2 rounded-lg text-lg focus:outline-none ${
                            activeField === 'documentRequestEmail'
                              ? 'border-blue-500 bg-blue-50'
                              : documentRequestErrors.emailAddress
                              ? 'border-red-500 bg-red-50'
                              : 'border-gray-300 bg-gray-50'
                          }`}
                          placeholder="your.email@example.com"
                        />
                        {documentRequestErrors.emailAddress && (
                          <p className="text-red-600 text-sm mt-1">{documentRequestErrors.emailAddress}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Navigation buttons */}
                  <div className="flex flex-col space-y-3">
                    <button
                      onClick={handleDocumentRequestStep2Next}
                      disabled={!isDocumentRequestStep2Valid}
                      className={`w-20 h-20 rounded-full border-2 border-white font-bold text-xs transition-all duration-150 shadow-lg ${
                        !isDocumentRequestStep2Valid
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-[#FFE251] text-[#1F3463] active:bg-[#FFD700] active:shadow-md active:scale-95'
                      }`}
                    >
                      NEXT
                    </button>
                    <button
                      onClick={handleDocumentRequestStep2Previous}
                      className="w-20 h-20 rounded-full border-2 border-white bg-[#1F3463] text-white font-bold text-xs active:bg-[#1A2E56] transition-all duration-150 shadow-lg active:shadow-md active:scale-95"
                    >
                      PREVIOUS
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <BackButton />
          </QueueLayout>

          <HolographicKeyboard
            onKeyPress={handleKeyPress}
            onBackspace={handleBackspace}
            onSpace={handleSpace}
            onHide={hideKeyboard}
            isVisible={showKeyboard}
            showAllFields={true}
            allFieldsData={[
              {
                name: 'documentRequestContact',
                label: 'Contact No. (REQUIRED)',
                value: documentRequestForm.contactNumber,
                placeholder: '+63XXXXXXXXXX or 0XXXXXXXXXX'
              },
              {
                name: 'documentRequestEmail',
                label: 'Email Address (REQUIRED)',
                value: documentRequestForm.emailAddress,
                placeholder: 'your.email@example.com'
              }
            ]}
            activeFieldName={activeField}
            onFieldFocus={handleFieldFocus}
            formErrors={{
              documentRequestContact: documentRequestErrors.contactNumber,
              documentRequestEmail: documentRequestErrors.emailAddress
            }}
            showNavigationButtons={true}
            navigationButtons={[
              {
                label: 'NEXT',
                onClick: handleDocumentRequestStep2Next,
                disabled: !isDocumentRequestStep2Valid,
                variant: 'next'
              },
              {
                label: 'PREVIOUS',
                onClick: handleDocumentRequestStep2Previous,
                disabled: false,
                variant: 'previous'
              }
            ]}
          />
        </>
      );
    }

    // Step 3: Request checkboxes
    if (documentRequestFormStep === 3) {
      return (
        <>
          <QueueLayout>
            <style>{`
              .kiosk-container header { display: none !important; }
            `}</style>

            <div className="h-full flex flex-col justify-center overflow-y-auto">
              <div className="flex items-center justify-center w-full px-8 py-8">
                <div className="flex items-center gap-3 relative">
                  <div className="bg-white rounded-lg shadow-xl drop-shadow-lg p-6 w-[600px] max-h-[90vh] overflow-y-auto">
                    <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">
                      Document Request Form
                    </h2>

                    <div className="space-y-4">
                      {/* Request Types - Checkboxes */}
                      <div>
                        <label className="block text-lg font-semibold text-gray-700 mb-2">
                          Request <span className="text-gray-700">(REQUIRED)</span>
                        </label>
                        <div className="space-y-2 border-2 border-gray-300 rounded-lg p-3 bg-gray-50">
                          {requestTypes.map((requestType) => (
                            <label key={requestType} className="flex items-center space-x-3 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={documentRequestForm.request.includes(requestType)}
                                onChange={() => handleDocumentRequestCheckboxChange(requestType)}
                                className="w-5 h-5 text-[#1F3463] border-gray-300 rounded focus:ring-[#1F3463]"
                              />
                              <span className="text-lg text-gray-700">{requestType}</span>
                            </label>
                          ))}
                        </div>
                        {documentRequestErrors.request && (
                          <p className="text-red-600 text-sm mt-1">{documentRequestErrors.request}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Navigation buttons */}
                  <div className="flex flex-col space-y-3">
                    <button
                      onClick={handleDocumentRequestStep3Next}
                      disabled={!isDocumentRequestStep3Valid}
                      className={`w-20 h-20 rounded-full border-2 border-white font-bold text-xs transition-all duration-150 shadow-lg ${
                        !isDocumentRequestStep3Valid
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-[#FFE251] text-[#1F3463] active:bg-[#FFD700] active:shadow-md active:scale-95'
                      }`}
                    >
                      NEXT
                    </button>
                    <button
                      onClick={handleDocumentRequestStep3Previous}
                      className="w-20 h-20 rounded-full border-2 border-white bg-[#1F3463] text-white font-bold text-xs active:bg-[#1A2E56] transition-all duration-150 shadow-lg active:shadow-md active:scale-95"
                    >
                      PREVIOUS
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <BackButton />
          </QueueLayout>

          {/* Confirmation Modal */}
          <ConfirmationModal
            isOpen={showConfirmationModal}
            onYes={handleDocumentRequestConfirm}
            onNo={handleConfirmationNo}
          />

          {/* Thank You Modal */}
          {showDocumentRequestThankYou && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center font-kiosk-public">
              {/* Black background with 80% opacity */}
              <div className="absolute inset-0 bg-black bg-opacity-80" />

              {/* Modal Container - Centered with buttons positioned below */}
              <div className="relative flex flex-col items-center">
                {/* Modal Content - Perfectly centered */}
                <div className="bg-white rounded-2xl shadow-3xl drop-shadow-2xl p-6 mx-3 max-w-lg w-full">
                  {/* Modal Message */}
                  <h2 className="text-2xl font-bold text-gray-800 text-center mb-4">
                    Thank you for completing the form.
                  </h2>
                  <p className="text-lg text-gray-600 text-center">
                    Please wait for the email notification regarding the status of your document request.
                  </p>
                </div>

                {/* Buttons positioned below modal */}
                <div className="flex space-x-6 mt-6">
                  {/* OK Button */}
                  <button
                    onClick={handleDocumentRequestThankYouClose}
                    className="w-20 h-20 rounded-full border-2 border-white bg-[#FFE251] text-[#1F3463] font-bold text-xs active:bg-[#FFD700] transition-all duration-150 shadow-lg active:shadow-md active:scale-95"
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      );
    }
  }

  // Document Claim Step
  if (currentStep === 'documentClaim') {
    return (
      <>
        <QueueLayout>
          <style>{`
            .kiosk-container header { display: none !important; }
          `}</style>

          <div className="h-full flex flex-col justify-center">
            <div className="flex items-center justify-center w-full px-8">
              <div className="flex items-center gap-3 relative">
                <div className="bg-white rounded-lg shadow-xl drop-shadow-lg p-8 w-[500px]">
                  <h2 className="text-4xl font-bold text-gray-800 mb-4 text-center">
                    Enter Transaction No.
                  </h2>

                  <div className="space-y-4">
                    <div>
                      <label htmlFor="transactionNo" className="block text-xl font-semibold text-gray-700 mb-2">
                        Transaction No. <span className="text-gray-700">(REQUIRED)</span>
                      </label>
                      <input
                        id="transactionNo"
                        type="text"
                        value={transactionNo}
                        onFocus={() => {
                          setActiveField('transactionNo');
                          setShowKeyboard(true);
                        }}
                        onChange={(e) => {
                          const value = e.target.value.toUpperCase();
                          setTransactionNo(value);
                          // Real-time validation
                          const error = validateTransactionNoRealTime(value);
                          setTransactionNoError(error);
                        }}
                        className={`w-full px-3 py-3 border-2 rounded-lg text-xl focus:outline-none ${
                          activeField === 'transactionNo'
                            ? 'border-blue-500 bg-blue-50'
                            : transactionNoError
                            ? 'border-red-500 bg-red-50'
                            : 'border-gray-300 bg-gray-50'
                        }`}
                        placeholder="TR######-###"
                        maxLength={12}
                      />
                      {transactionNoError && (
                        <p className="text-red-600 text-sm mt-1">{transactionNoError}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col space-y-3">
                  <button
                    onClick={handleDocumentClaimSubmit}
                    disabled={!transactionNo.trim()}
                    className={`w-20 h-20 rounded-full border-2 border-white font-bold text-xs transition-all duration-150 shadow-lg ${
                      !transactionNo.trim()
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-[#FFE251] text-[#1F3463] active:bg-[#FFD700] active:shadow-md active:scale-95'
                    }`}
                  >
                    NEXT
                  </button>
                  <button
                    onClick={() => {
                      setCurrentStep('service');
                      setTransactionNo('');
                      setTransactionNoError('');
                    }}
                    className="w-20 h-20 rounded-full border-2 border-white bg-[#1F3463] text-white font-bold text-xs active:bg-[#1A2E56] active:shadow-md active:scale-95 transition-all duration-150 shadow-lg"
                  >
                    PREVIOUS
                  </button>
                </div>
              </div>
            </div>
          </div>

          <BackButton />
        </QueueLayout>

        <HolographicKeyboard
          onKeyPress={handleKeyPress}
          onBackspace={handleBackspace}
          onSpace={handleSpace}
          onEnter={handleEnter}
          onHide={hideKeyboard}
          isVisible={showKeyboard}
          activeInputValue={transactionNo}
          activeInputLabel="Transaction No. (REQUIRED)"
          activeInputPlaceholder="TR######-###"
          activeInputError={transactionNoError}
          showNavigationButtons={true}
          navigationButtons={[
            {
              label: 'NEXT',
              onClick: handleDocumentClaimSubmit,
              disabled: !transactionNo.trim(),
              variant: 'next'
            },
            {
              label: 'PREVIOUS',
              onClick: () => {
                setCurrentStep('service');
                setTransactionNo('');
                setTransactionNoError('');
              },
              disabled: false,
              variant: 'previous'
            }
          ]}
        />

        {/* Transaction No. Error Modal - Inside Document Claim step */}
        <TransactionNoErrorModal
          isOpen={showTransactionNoErrorModal}
          onClose={() => setShowTransactionNoErrorModal(false)}
          message={transactionNoErrorMessage}
        />
      </>
    );
  }

  // Role Selection Step
  if (currentStep === 'role') {
    console.log('🎭 ROLE STEP - Rendering with roleOptions:', roleOptions);
    return (
      <RoleSelection
        roleOptions={roleOptions}
        onRoleSelect={handleRoleSelect}
        onBack={() => {
          if (selectedService === 'Enroll') {
            setCurrentStep('studentStatus');
          } else {
            setCurrentStep('service');
          }
        }}
      />
    );
  }

  // Priority Status Step
  if (currentStep === 'priority') {
    return (
      <PrioritySelection
        priorityOptions={priorityOptions}
        onPrioritySelect={handlePrioritySelect}
        onBack={() => setCurrentStep('role')}
      />
    );
  }

  // If we reach here, we should be in the form step or something went wrong
  // Return to department selection as fallback
  return (
    <>
      <KioskLayout>
        <div className="h-full flex flex-col items-center justify-center">
          <h2 className="text-lg font-semibold text-gray-600 mb-3">
            Something went wrong. Please start over.
          </h2>
          <button
            onClick={handleBackToOffices}
            className="px-5 py-2.5 bg-[#1F3463] text-white rounded-lg active:bg-[#1A2E56] active:scale-95 transition-all duration-150"
          >
            Back to Department Selection
          </button>
        </div>
      </KioskLayout>

      {/* Toast Container for Queue page notifications */}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />

      {/* Print Error Modal */}
      <PrintErrorModal
        isOpen={showPrintErrorModal}
        onClose={() => setShowPrintErrorModal(false)}
        message={printErrorMessage}
      />

      {/* Transaction No. Error Modal */}
      <TransactionNoErrorModal
        isOpen={showTransactionNoErrorModal}
        onClose={() => setShowTransactionNoErrorModal(false)}
        message={transactionNoErrorMessage}
      />

      {/* Printing Animation Overlay */}
      <AnimatePresence mode="wait">
        {isPrinting && <PrintingOverlay key="printing-overlay" />}
      </AnimatePresence>
    </>
  );
};

export default Queue;
