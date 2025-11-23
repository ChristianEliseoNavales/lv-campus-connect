import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MdSearch, MdKeyboardArrowUp, MdKeyboardArrowDown, MdClose } from 'react-icons/md';
import { IoMdRefresh } from 'react-icons/io';
import { MdPerson } from 'react-icons/md';
import { FiEdit3 } from 'react-icons/fi';
import { useToast, ToastContainer, ConfirmModal } from '../../../ui';
import Portal from '../../../ui/Portal';
import API_CONFIG from '../../../../config/api';
import { authFetch } from '../../../../utils/apiClient';

// Define initial state outside component to prevent recreation
const INITIAL_URL_STATE = {
  searchTerm: '',
  filterBy: 'all',
  usersPerPage: 10,
  currentPage: 1
};

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [lastRefreshTime, setLastRefreshTime] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // URL state management
  const [searchTerm, setSearchTerm] = useState(INITIAL_URL_STATE.searchTerm);
  const [filterBy, setFilterBy] = useState(INITIAL_URL_STATE.filterBy);
  const [usersPerPage, setUsersPerPage] = useState(INITIAL_URL_STATE.usersPerPage);
  const [currentPage, setCurrentPage] = useState(INITIAL_URL_STATE.currentPage);

  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    accessLevel: '',
    office: '',
    isActive: true,
    pageAccess: []
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [isOnlySuperAdmin, setIsOnlySuperAdmin] = useState(false);

  const { toasts, showSuccess, showError, removeToast } = useToast();

  // Refs for cleanup
  const abortControllerRef = useRef(null);

  // Access level options (conditionally filtered based on office)
  const getAccessLevelOptions = (office) => {
    const baseOptions = [
      { value: 'admin', label: 'Admin' },
      { value: 'admin_staff', label: 'Admin Staff' }
    ];

    // Super Admin is only available for MIS office
    if (office === 'MIS') {
      return [
        { value: 'super_admin', label: 'Super Admin' },
        ...baseOptions
      ];
    }

    return baseOptions;
  };

  const officeOptions = [
    { value: 'MIS', label: 'MIS' },
    { value: 'Registrar', label: 'Registrar' },
    { value: 'Admissions', label: 'Admissions' },
    { value: 'Senior Management', label: 'Senior Management' }
  ];

  // Helper function to compute role from office and accessLevel
  const computeRole = (office, accessLevel) => {
    if (!office || !accessLevel) return '';

    const accessLevelMap = {
      'super_admin': 'Super Admin',
      'admin': 'Admin',
      'admin_staff': 'Admin Staff'
    };

    return `${office} ${accessLevelMap[accessLevel]}`;
  };

  // Comprehensive list of all admin pages for access control
  const adminPages = [
    // MIS Super Admin Pages
    { id: 'mis_dashboard', label: 'MIS Dashboard', category: 'MIS', path: '/admin/mis' },
    { id: 'users_management', label: 'Users Management', category: 'MIS', path: '/admin/mis/users' },
    { id: 'database_manager', label: 'Database Manager', category: 'MIS', path: '/admin/mis/database-manager' },
    { id: 'mis_audit_trail', label: 'MIS Audit Trail', category: 'MIS', path: '/admin/mis/audit-trail' },
    { id: 'mis_bulletin', label: 'MIS Bulletin', category: 'MIS', path: '/admin/mis/bulletin' },
    { id: 'mis_ratings', label: 'MIS Ratings', category: 'MIS', path: '/admin/mis/ratings' },
    { id: 'mis_faq', label: 'FAQ Management', category: 'MIS', path: '/admin/mis/faq' },

    // Registrar Admin Pages
    { id: 'registrar_dashboard', label: 'Registrar Dashboard', category: 'Registrar', path: '/admin/registrar' },
    { id: 'registrar_queue', label: 'Registrar Queue Management', category: 'Registrar', path: '/admin/registrar/queue' },
    { id: 'registrar_transaction_logs', label: 'Registrar Transaction Logs', category: 'Registrar', path: '/admin/registrar/transaction-logs' },
    { id: 'registrar_settings', label: 'Registrar Settings', category: 'Registrar', path: '/admin/registrar/settings' },
    { id: 'registrar_faq', label: 'FAQ Management', category: 'Registrar', path: '/admin/registrar/faq' },

    // Admissions Admin Pages
    { id: 'admissions_dashboard', label: 'Admissions Dashboard', category: 'Admissions', path: '/admin/admissions' },
    { id: 'admissions_queue', label: 'Admissions Queue Management', category: 'Admissions', path: '/admin/admissions/queue' },
    { id: 'admissions_transaction_logs', label: 'Admissions Transaction Logs', category: 'Admissions', path: '/admin/admissions/transaction-logs' },
    { id: 'admissions_settings', label: 'Admissions Settings', category: 'Admissions', path: '/admin/admissions/settings' },
    { id: 'admissions_faq', label: 'FAQ Management', category: 'Admissions', path: '/admin/admissions/faq' },

    // Senior Management Admin Pages
    { id: 'senior_management_charts', label: 'Senior Management Charts', category: 'Senior Management', path: '/admin/seniormanagement/charts' },
    { id: 'senior_management_faq', label: 'FAQ Management', category: 'Senior Management', path: '/admin/seniormanagement/faq' }
  ];

  // Helper function to get default page access based on office and access level
  // Returns route paths (not old-style IDs)
  const getDefaultPageAccess = useCallback((office, accessLevel) => {
    // Admin gets full office access
    const adminAccess = {
      'MIS': [
        '/admin/mis',
        '/admin/mis/users',
        '/admin/mis/database-manager',
        '/admin/mis/audit-trail',
        '/admin/mis/bulletin',
        '/admin/mis/ratings'
      ],
      'Registrar': [
        '/admin/registrar',
        '/admin/registrar/queue',
        '/admin/registrar/transaction-logs',
        '/admin/registrar/settings'
      ],
      'Admissions': [
        '/admin/admissions',
        '/admin/admissions/queue',
        '/admin/admissions/transaction-logs',
        '/admin/admissions/settings'
      ],
      'Senior Management': [
        '/admin/seniormanagement/charts'
      ]
    };

    // Admin Staff gets limited access (queue page only)
    const adminStaffAccess = {
      'MIS': [
        '/admin/mis'
      ],
      'Registrar': [
        '/admin/registrar/queue'
      ],
      'Admissions': [
        '/admin/admissions/queue'
      ],
      'Senior Management': []
    };

    // Return appropriate access based on access level
    if (accessLevel === 'admin_staff') {
      return adminStaffAccess[office] || [];
    }

    return adminAccess[office] || [];
  }, []);

  // Helper function to format refresh time
  const formatRefreshTime = useCallback((date) => {
    if (!date) return 'Never';
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  }, []);

  // Helper function to handle users per page changes
  const handleUsersPerPageChange = useCallback((direction) => {
    const options = [5, 10, 25, 50];
    const currentIndex = options.indexOf(usersPerPage);
    let newIndex;

    if (direction === 1) { // Up
      newIndex = Math.min(currentIndex + 1, options.length - 1);
    } else { // Down
      newIndex = Math.max(currentIndex - 1, 0);
    }

    setUsersPerPage(options[newIndex]);
    setCurrentPage(1); // Reset to first page
  }, [usersPerPage]);

  // Fetch users from API
  const fetchUsers = useCallback(async () => {
    // Cancel previous request if it exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setFetchError(null);

    try {
      const response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/users`, {
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setUsers(result.data);
        // Update refresh timestamp
        setLastRefreshTime(new Date());
      } else {
        throw new Error(result.error || 'Failed to fetch users');
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Fetch aborted');
        return;
      }
      console.error('Error fetching users:', error);
      setFetchError(error.message); // Set error state instead of calling showError directly
      setUsers([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  }, []);

  // Manual refresh handler
  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchUsers();
    setIsRefreshing(false);
  }, [fetchUsers]);

  // Initial data fetch
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Check if editing user is the only Super Admin
  useEffect(() => {
    const checkSuperAdminCount = async () => {
      if (!editingUser || editingUser.role !== 'MIS Super Admin') {
        setIsOnlySuperAdmin(false);
        return;
      }

      try {
        const response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/users?role=MIS Super Admin&isActive=true`);
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            const activeSuperAdmins = result.data.filter(user => user.isActive === true);
            setIsOnlySuperAdmin(activeSuperAdmins.length === 1 && activeSuperAdmins[0]._id === editingUser._id);
          }
        }
      } catch (error) {
        console.error('Error checking Super Admin count:', error);
        setIsOnlySuperAdmin(false);
      }
    };

    checkSuperAdminCount();
  }, [editingUser]);

  // Filter and search logic
  const filteredUsers = useMemo(() => {
    let filtered = users;

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(user =>
        user.name.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower) ||
        user.office?.toLowerCase().includes(searchLower) ||
        user.role.toLowerCase().includes(searchLower)
      );
    }

    // Apply filter by dropdown
    if (filterBy !== 'all') {
      if (filterBy === 'active') {
        filtered = filtered.filter(user => user.isActive === true);
      } else if (filterBy === 'inactive') {
        filtered = filtered.filter(user => user.isActive === false);
      } else {
        // Filter by role
        filtered = filtered.filter(user => user.role === filterBy);
      }
    }

    return filtered;
  }, [users, searchTerm, filterBy]);

  // Pagination logic
  const totalUsers = filteredUsers.length;
  const totalPages = Math.ceil(totalUsers / usersPerPage);
  const startIndex = (currentPage - 1) * usersPerPage;
  const endIndex = startIndex + usersPerPage;
  const currentUsers = filteredUsers.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterBy]);

  // Form validation
  const validateForm = () => {
    const errors = {};

    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.accessLevel) {
      errors.accessLevel = 'Access Level is required';
    }

    if (!formData.office) {
      errors.office = 'Office is required';
    }

    if (!formData.pageAccess || formData.pageAccess.length === 0) {
      errors.pageAccess = 'At least one page access permission is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form input changes
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear specific field error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }

    // When office changes, reset accessLevel if it was super_admin and new office is not MIS
    if (field === 'office' && value !== 'MIS' && formData.accessLevel === 'super_admin') {
      setFormData(prev => ({
        ...prev,
        accessLevel: '',
        pageAccess: [] // Clear page access when office changes
      }));
    }

    // When office changes, filter pageAccess to only include pages from the new office
    if (field === 'office' && value) {
      setFormData(prev => {
        // Filter existing pageAccess to only include pages from the new office
        const filteredPageAccess = prev.pageAccess.filter(pagePath => {
          const page = adminPages.find(p => p.path === pagePath);
          return page && page.category === value;
        });

        // If accessLevel is admin, auto-select all pages from the new office
        if (prev.accessLevel === 'admin') {
          const defaultAccess = getDefaultPageAccess(value);
          return {
            ...prev,
            pageAccess: defaultAccess
          };
        }

        // If accessLevel is super_admin and office is MIS, select all pages
        if (prev.accessLevel === 'super_admin' && value === 'MIS') {
          const allPagePaths = adminPages.map(page => page.path);
          return {
            ...prev,
            pageAccess: allPagePaths
          };
        }

        // Otherwise, keep filtered pageAccess
        return {
          ...prev,
          pageAccess: filteredPageAccess
        };
      });
    }

    // Smart auto-selection: When accessLevel changes to super_admin with MIS office, select all pages
    if (field === 'accessLevel' && value === 'super_admin' && formData.office === 'MIS') {
      const allPagePaths = adminPages.map(page => page.path);
      setFormData(prev => ({
        ...prev,
        pageAccess: allPagePaths
      }));
    }

    // Smart auto-selection: When accessLevel changes to admin, auto-select office pages
    if (field === 'accessLevel' && value === 'admin' && formData.office) {
      const defaultAccess = getDefaultPageAccess(formData.office, 'admin');
      setFormData(prev => ({
        ...prev,
        pageAccess: defaultAccess
      }));
    }

    // Smart auto-selection: When accessLevel changes to admin_staff, auto-select default staff pages
    if (field === 'accessLevel' && value === 'admin_staff' && formData.office) {
      const defaultAccess = getDefaultPageAccess(formData.office, 'admin_staff');
      setFormData(prev => ({
        ...prev,
        pageAccess: defaultAccess
      }));
    }
  };

  // Get available pages based on office and access level
  const getAvailablePages = useCallback(() => {
    const { office, accessLevel } = formData;

    // If no office selected, return empty array
    if (!office) {
      return [];
    }

    // MIS Super Admin can select all pages
    if (office === 'MIS' && accessLevel === 'super_admin') {
      return adminPages;
    }

    // Other offices can select pages from their own office
    return adminPages.filter(page => page.category === office);
  }, [formData.office, formData.accessLevel]);

  // Check if a page checkbox should be disabled
  const isPageCheckboxDisabled = (page) => {
    const { office, accessLevel } = formData;

    // If no office selected, disable all
    if (!office) {
      return true;
    }

    // MIS Super Admin can select all pages
    if (office === 'MIS' && accessLevel === 'super_admin') {
      return false;
    }

    // Other offices can only select pages from their own office
    return page.category !== office;
  };

  // Handle page access checkbox changes
  // Note: pagePath is the route path (e.g., '/admin/mis'), not the old ID format
  const handlePageAccessChange = (pagePath, checked) => {
    // Prevent unchecking Users Management page if user is the only Super Admin
    if (pagePath === '/admin/mis/users' && !checked && isOnlySuperAdmin) {
      showError('Cannot Remove Access', 'You are the only active Super Admin. Users Management access cannot be removed to ensure system administration capabilities.');
      return;
    }

    setFormData(prev => ({
      ...prev,
      pageAccess: checked
        ? [...prev.pageAccess, pagePath]
        : prev.pageAccess.filter(path => path !== pagePath)
    }));

    // Clear page access error when user makes changes
    if (formErrors.pageAccess) {
      setFormErrors(prev => ({
        ...prev,
        pageAccess: ''
      }));
    }
  };

  // Open add user modal
  const openAddModal = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      accessLevel: '',
      office: '',
      isActive: true,
      pageAccess: []
    });
    setFormErrors({});
    setShowAddEditModal(true);
  };

  // Open edit user modal
  const openEditModal = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      accessLevel: user.accessLevel || '',
      office: user.office || '',
      isActive: user.isActive,
      pageAccess: user.pageAccess || []
    });
    setFormErrors({});
    setShowAddEditModal(true);
  };

  // Close modal
  const closeModal = () => {
    setShowAddEditModal(false);
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      accessLevel: '',
      office: '',
      isActive: true,
      pageAccess: []
    });
    setFormErrors({});
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Compute the role from office and accessLevel
      const computedRole = computeRole(formData.office, formData.accessLevel);

      const submitData = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        accessLevel: formData.accessLevel,
        role: computedRole,
        office: formData.office,
        isActive: formData.isActive,
        pageAccess: formData.pageAccess
      };

      let response;
      if (editingUser) {
        // Update existing user
        response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/users/${editingUser._id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(submitData),
        });
      } else {
        // Create new user
        response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(submitData),
        });
      }

      if (response.ok) {
        const userData = await response.json();

        if (editingUser) {
          // Update user in state
          setUsers(prev => prev.map(user =>
            user._id === editingUser._id ? userData : user
          ));
          showSuccess('User Updated', `${userData.name} has been updated successfully`);
        } else {
          // Add new user to state
          setUsers(prev => [userData, ...prev]);
          showSuccess('User Created', `${userData.name} has been created successfully`);
        }

        closeModal();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save user');
      }
    } catch (error) {
      console.error('Error saving user:', error);
      showError('Error', error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle user deletion (deactivation)
  const handleDeleteUser = (user) => {
    setUserToDelete(user);
    setShowConfirmModal(true);
  };

  // Perform actual user deletion after confirmation
  const performDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      const response = await authFetch(`${API_CONFIG.getAdminUrl()}/api/users/${userToDelete._id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Update user in state to show as inactive
        setUsers(prev => prev.map(u =>
          u._id === userToDelete._id ? { ...u, isActive: false } : u
        ));
        showSuccess('User Deactivated', `${userToDelete.name} has been deactivated`);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to deactivate user');
      }
    } catch (error) {
      console.error('Error deactivating user:', error);
      showError('Error', error.message);
    } finally {
      setShowConfirmModal(false);
      setUserToDelete(null);
    }
  };

  // Get status badge color
  const getStatusBadgeColor = (isActive) => {
    return isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />

      {/* Show error if fetch failed */}
      {fetchError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex">
            <div className="ml-2.5">
              <h3 className="text-xs font-medium text-red-800">Error loading users</h3>
              <div className="mt-1.5 text-xs text-red-700">
                <p>{fetchError}</p>
              </div>
              <div className="mt-3">
                <button
                  onClick={handleManualRefresh}
                  className="bg-red-100 px-2.5 py-1.5 rounded-md text-xs font-medium text-red-800 hover:bg-red-200"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Container - White background similar to Settings.jsx */}
      <div className="bg-white p-3 sm:p-4 md:p-5 border border-gray-200 rounded-xl sm:rounded-2xl">

        {/* Row 1 - Header */}
        <div className="mb-3 sm:mb-4 md:mb-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">User Management</h1>
            <div className="flex items-center space-x-1">
              <p className="text-[8px] sm:text-[9px] text-gray-500 uppercase tracking-wide">
                As of {formatRefreshTime(lastRefreshTime)}
              </p>
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="p-1.5 transition-colors duration-200 hover:bg-[#1F3463]/10 rounded-lg border border-[#1F3463]/20"
                title="Refresh users"
              >
                <IoMdRefresh
                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#1F3463] ${isRefreshing ? 'animate-spin' : ''}`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Row 2 - Controls */}
        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3 mb-3 sm:mb-4 md:mb-5">
          {/* Left side - Pagination Control */}
          <div className="flex items-center space-x-1.5">
            <span className="text-xs sm:text-sm text-gray-700 font-medium">Showing</span>
            <div className="flex items-center space-x-1">
              <input
                type="number"
                value={usersPerPage}
                onChange={(e) => setUsersPerPage(Math.max(5, Math.min(50, parseInt(e.target.value) || 10)))}
                className="w-10 sm:w-12 px-1 sm:px-1.5 py-0.5 text-xs sm:text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent"
                min="5"
                max="50"
              />
              <div className="flex flex-col">
                <button
                  onClick={() => handleUsersPerPageChange(1)}
                  className="p-0.5 text-gray-500 hover:text-[#1F3463] transition-colors"
                >
                  <MdKeyboardArrowUp className="text-xs sm:text-sm" />
                </button>
                <button
                  onClick={() => handleUsersPerPageChange(-1)}
                  className="p-0.5 text-gray-500 hover:text-[#1F3463] transition-colors"
                >
                  <MdKeyboardArrowDown className="text-xs sm:text-sm" />
                </button>
              </div>
            </div>
            <span className="text-xs sm:text-sm text-gray-700 font-medium">Users</span>
          </div>

          {/* Right side - Search, Filter dropdown, Add button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            {/* Search */}
            <div className="relative flex-1 sm:flex-initial">
              <MdSearch className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 text-base sm:text-lg" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-52 pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent"
              />
            </div>

            {/* Filter */}
            <div className="flex items-center space-x-1.5">
              <label className="text-xs sm:text-sm text-gray-700 font-medium whitespace-nowrap">Filter by:</label>
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value)}
                className="flex-1 sm:flex-initial px-2 sm:px-2.5 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent text-xs sm:text-sm"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="super_admin">Super Admin</option>
                <option value="admin">Admin</option>
                <option value="admin_staff">Admin Staff</option>
              </select>
            </div>

            {/* Add Button */}
            <button
              onClick={openAddModal}
              className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-[#1F3463] text-white rounded-lg hover:bg-[#1F3463]/90 transition-colors text-xs sm:text-sm font-semibold"
            >
              + Add User
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {loading ? (
            <>
              {/* Table Header - Hidden on mobile, shown on md+ */}
              <div className="hidden md:flex bg-gray-50 px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 md:py-3 border-b border-gray-200 items-center">
                <div className="grid grid-cols-5 gap-2 sm:gap-3 text-xs font-medium text-gray-700 w-full">
                  <div>Name</div>
                  <div>Email</div>
                  <div>Office</div>
                  <div>Role</div>
                  <div>Action</div>
                </div>
              </div>

              {/* Skeleton Loading Rows */}
              <div className="divide-y divide-gray-200">
                {[...Array(7)].map((_, index) => (
                  <div key={index} className="px-3 sm:px-4 md:px-5 py-2.5 sm:py-3 md:py-3 md:h-12 flex items-center animate-pulse">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-2 sm:gap-3 items-center w-full">
                      {/* Name Skeleton */}
                      <div className="h-3 bg-gray-200 rounded w-28"></div>

                      {/* Email Skeleton - Hidden on mobile */}
                      <div className="hidden md:block h-3 bg-gray-200 rounded w-32"></div>

                      {/* Office Skeleton - Hidden on mobile */}
                      <div className="hidden md:block h-3 bg-gray-200 rounded w-20"></div>

                      {/* Role Skeleton - Hidden on mobile */}
                      <div className="hidden md:block h-3 bg-gray-200 rounded w-24"></div>

                      {/* Action Skeleton */}
                      <div className="h-3 bg-gray-200 rounded w-5"></div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : currentUsers.length === 0 ? (
            <div className="text-center py-8 sm:py-10">
              <MdPerson className="text-4xl sm:text-5xl text-gray-300 mx-auto mb-2 sm:mb-3" />
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1 sm:mb-1.5">No users found</h3>
              <p className="text-xs sm:text-sm text-gray-500">Try adjusting your search or filter criteria</p>
            </div>
          ) : (
            <>
              {/* Table Header - Hidden on mobile, shown on md+ */}
              <div className="hidden md:flex bg-gray-50 px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 md:py-3 border-b border-gray-200 items-center">
                <div className="grid grid-cols-5 gap-2 sm:gap-3 text-xs sm:text-sm font-bold text-gray-700 w-full">
                  <div>Name</div>
                  <div>Email</div>
                  <div>Office</div>
                  <div>Role</div>
                  <div>Action</div>
                </div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-gray-200">
                {currentUsers.map((user) => (
                  <div key={user._id} className="px-3 sm:px-4 md:px-5 py-2.5 sm:py-3 md:py-3 hover:bg-gray-50 transition-colors md:h-12 flex items-center">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-1.5 sm:gap-2 md:gap-3 items-start md:items-center w-full">
                      {/* Mobile: Stacked layout, Desktop: Grid layout */}

                      {/* Name */}
                      <div className="text-xs sm:text-sm font-bold text-gray-900 truncate" title={user.name}>
                        <span className="md:hidden text-[10px] text-gray-500 uppercase tracking-wide block mb-0.5">Name</span>
                        {user.name}
                      </div>

                      {/* Email */}
                      <div className="text-xs sm:text-sm font-medium text-gray-900 truncate" title={user.email}>
                        <span className="md:hidden text-[10px] text-gray-500 uppercase tracking-wide block mb-0.5">Email</span>
                        {user.email}
                      </div>

                      {/* Office */}
                      <div className="text-xs sm:text-sm font-medium text-gray-900 truncate" title={user.office || 'N/A'}>
                        <span className="md:hidden text-[10px] text-gray-500 uppercase tracking-wide block mb-0.5">Office</span>
                        {user.office || 'N/A'}
                      </div>

                      {/* Role */}
                      <div className="text-xs sm:text-sm font-medium text-gray-900 truncate" title={user.role || 'N/A'}>
                        <span className="md:hidden text-[10px] text-gray-500 uppercase tracking-wide block mb-0.5">Role</span>
                        {user.role || 'N/A'}
                      </div>

                      {/* Action */}
                      <div className="text-xs mt-2 md:mt-0">
                        <button
                          onClick={() => openEditModal(user)}
                          className="text-[#1F3463] hover:text-[#1F3463]/80 p-0.5 rounded"
                          title="Edit user"
                        >
                          <FiEdit3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-3 sm:mt-4 md:mt-5 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-0">
            <div className="text-[10px] sm:text-xs md:text-sm text-gray-700 font-medium order-2 sm:order-1">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredUsers.length)} of {filteredUsers.length} users
            </div>
            <div className="flex items-center space-x-1.5 order-1 sm:order-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-2 sm:px-2.5 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium text-gray-700 bg-gray-50 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              {/* Current Page Number */}
              <button
                className="px-2 sm:px-2.5 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium text-white bg-[#1F3463] border border-[#1F3463] rounded-md"
              >
                {currentPage}
              </button>

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-2 sm:px-2.5 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium text-gray-700 bg-gray-50 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit User Modal */}
      {showAddEditModal && (
        <Portal>
          <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
              <div className="relative bg-white rounded-xl w-full max-w-2xl shadow-xl">
                {/* Close Button */}
                <button
                  onClick={closeModal}
                  className="absolute -top-1.5 -right-1.5 z-10 w-6 h-6 bg-[#1F3463] border-2 border-white rounded-full flex items-center justify-center text-white hover:bg-opacity-90 transition-colors"
                >
                  <MdClose className="w-3 h-3" />
                </button>

                {/* Modal Content with max height and scroll */}
                <div className="max-h-[90vh] overflow-y-auto p-4 sm:p-5">
                  <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4">
                    {editingUser ? 'Edit User' : 'Add New User'}
                  </h2>

            <form onSubmit={handleSubmit} className="space-y-2.5 sm:space-y-3">
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-gray-900 mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={`w-full px-2.5 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${
                    formErrors.name
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                  placeholder="Enter full name"
                />
                {formErrors.name && (
                  <p className="mt-0.5 text-xs text-red-600">{formErrors.name}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-gray-900 mb-1.5">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className={`w-full px-2.5 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${
                    formErrors.email
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                  placeholder="Enter email address"
                />
                {formErrors.email && (
                  <p className="mt-0.5 text-xs text-red-600">{formErrors.email}</p>
                )}
              </div>

              {/* Office */}
              <div>
                <label className="block text-xs font-medium text-gray-900 mb-1.5">
                  Office <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.office}
                  onChange={(e) => handleInputChange('office', e.target.value)}
                  className={`w-full px-2.5 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${
                    formErrors.office
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                >
                  <option value="">Select an office</option>
                  {officeOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {formErrors.office && (
                  <p className="mt-0.5 text-xs text-red-600">{formErrors.office}</p>
                )}
              </div>

              {/* Access Level */}
              <div>
                <label className="block text-xs font-medium text-gray-900 mb-1.5">
                  Access Level <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.accessLevel}
                  onChange={(e) => handleInputChange('accessLevel', e.target.value)}
                  className={`w-full px-2.5 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${
                    formErrors.accessLevel
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                  disabled={!formData.office}
                >
                  <option value="">Select an access level</option>
                  {getAccessLevelOptions(formData.office).map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {formErrors.accessLevel && (
                  <p className="mt-0.5 text-xs text-red-600">{formErrors.accessLevel}</p>
                )}
                {!formData.office && (
                  <p className="mt-0.5 text-xs text-gray-500">Please select an office first</p>
                )}
              </div>

              {/* Page Access Control */}
              <div>
                <label className="block text-xs font-medium text-gray-900 mb-2.5">
                  Page Access Permissions <span className="text-red-500">*</span>
                </label>
                {!formData.office && (
                  <p className="text-xs text-gray-500 mb-1.5">Please select an office first to see available pages</p>
                )}
                {formData.office && formData.office !== 'MIS' && formData.accessLevel !== 'super_admin' && (
                  <p className="text-xs text-blue-600 mb-1.5">
                    You can only select pages from the {formData.office} office
                  </p>
                )}
                {formData.office === 'MIS' && formData.accessLevel === 'super_admin' && (
                  <p className="text-xs text-green-600 mb-1.5">
                    As MIS Super Admin, you can select pages from all offices
                  </p>
                )}
                {isOnlySuperAdmin && (
                  <p className="text-xs text-amber-600 mb-1.5">
                    Cannot remove Users Management access. You are the only active Super Admin in the system.
                  </p>
                )}
                <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto">
                  {/* Group pages by category */}
                  {['MIS', 'Registrar', 'Admissions', 'Senior Management'].map(category => {
                    const categoryPages = adminPages.filter(page => page.category === category);
                    if (categoryPages.length === 0) return null;

                    return (
                      <div key={category} className="mb-3 last:mb-0">
                        <h4 className="text-xs font-semibold text-[#1F3463] mb-1.5">{category} Pages</h4>
                        <div className="space-y-1.5">
                          {categoryPages.map(page => {
                            const isDisabled = isPageCheckboxDisabled(page);
                            // Disable Users Management checkbox if user is the only Super Admin
                            const isUsersManagementPage = page.path === '/admin/mis/users';
                            const shouldDisableUsersPage = isUsersManagementPage && isOnlySuperAdmin && formData.pageAccess.includes(page.path);
                            const finalDisabled = isDisabled || shouldDisableUsersPage;
                            return (
                              <label
                                key={page.path}
                                className={`flex items-center space-x-1.5 ${finalDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={formData.pageAccess.includes(page.path)}
                                  onChange={(e) => handlePageAccessChange(page.path, e.target.checked)}
                                  disabled={finalDisabled}
                                  className="rounded border-gray-300 text-[#1F3463] focus:ring-[#1F3463] disabled:opacity-50 disabled:cursor-not-allowed w-3 h-3"
                                />
                                <span className="text-xs text-gray-700">{page.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {formErrors.pageAccess && (
                  <p className="mt-0.5 text-xs text-red-600">{formErrors.pageAccess}</p>
                )}
              </div>

              {/* Status (for editing) */}
              {editingUser && (
                <div>
                  <label className="flex items-center space-x-1.5">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => handleInputChange('isActive', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
                    />
                    <span className="text-xs font-medium text-gray-900">Active User</span>
                  </label>
                </div>
              )}

              {/* Form Actions */}
              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="w-full sm:w-auto px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors order-2 sm:order-1"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-white rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50 order-1 sm:order-2"
                  style={{ backgroundColor: '#1F3463' }}
                >
                  {isSubmitting ? 'Saving...' : (editingUser ? 'Update User' : 'Create User')}
                </button>
              </div>
            </form>
                </div>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false);
          setUserToDelete(null);
        }}
        onConfirm={performDeleteUser}
        title="Deactivate User"
        message={userToDelete ? `Are you sure you want to deactivate ${userToDelete.name}? This action will disable their access to the system.` : ''}
        confirmText="Deactivate"
        cancelText="Cancel"
        type="warning"
      />
    </div>
  );
};

export default Users;

