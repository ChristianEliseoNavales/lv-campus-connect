import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MdSearch, MdKeyboardArrowUp, MdKeyboardArrowDown } from 'react-icons/md';
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
    role: '',
    office: '',
    isActive: true,
    pageAccess: []
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  const { toasts, showSuccess, showError, removeToast } = useToast();

  // Refs for cleanup
  const abortControllerRef = useRef(null);

  // Role and office options
  const roleOptions = [
    { value: 'super_admin', label: 'Super Admin' },
    { value: 'admin', label: 'Admin' },
    { value: 'admin_staff', label: 'Admin Staff' }
  ];

  const officeOptions = [
    { value: 'MIS', label: 'MIS' },
    { value: 'Registrar', label: 'Registrar' },
    { value: 'Admissions', label: 'Admissions' },
    { value: 'Senior Management', label: 'Senior Management' }
  ];

  // Comprehensive list of all admin pages for access control
  const adminPages = [
    // MIS Super Admin Pages
    { id: 'mis_dashboard', label: 'MIS Dashboard', category: 'MIS', path: '/admin/mis' },
    { id: 'users_management', label: 'Users Management', category: 'MIS', path: '/admin/mis/users' },
    { id: 'database_manager', label: 'Database Manager', category: 'MIS', path: '/admin/mis/database-manager' },
    { id: 'mis_audit_trail', label: 'MIS Audit Trail', category: 'MIS', path: '/admin/mis/audit-trail' },
    { id: 'mis_bulletin', label: 'MIS Bulletin', category: 'MIS', path: '/admin/mis/bulletin' },
    { id: 'mis_ratings', label: 'MIS Ratings', category: 'MIS', path: '/admin/mis/ratings' },

    // Registrar Admin Pages
    { id: 'registrar_dashboard', label: 'Registrar Dashboard', category: 'Registrar', path: '/admin/registrar' },
    { id: 'registrar_queue', label: 'Registrar Queue Management', category: 'Registrar', path: '/admin/registrar/queue' },
    { id: 'registrar_transaction_logs', label: 'Registrar Transaction Logs', category: 'Registrar', path: '/admin/registrar/transaction-logs' },
    { id: 'registrar_audit_trail', label: 'Registrar Audit Trail', category: 'Registrar', path: '/admin/registrar/audit-trail' },
    { id: 'registrar_settings', label: 'Registrar Settings', category: 'Registrar', path: '/admin/registrar/settings' },

    // Admissions Admin Pages
    { id: 'admissions_dashboard', label: 'Admissions Dashboard', category: 'Admissions', path: '/admin/admissions' },
    { id: 'admissions_queue', label: 'Admissions Queue Management', category: 'Admissions', path: '/admin/admissions/queue' },
    { id: 'admissions_transaction_logs', label: 'Admissions Transaction Logs', category: 'Admissions', path: '/admin/admissions/transaction-logs' },
    { id: 'admissions_audit_trail', label: 'Admissions Audit Trail', category: 'Admissions', path: '/admin/admissions/audit-trail' },
    { id: 'admissions_settings', label: 'Admissions Settings', category: 'Admissions', path: '/admin/admissions/settings' },

    // Senior Management Admin Pages
    { id: 'senior_management_charts', label: 'Senior Management Charts', category: 'Senior Management', path: '/admin/seniormanagement/charts' }
  ];

  // Helper function to get default page access based on office
  const getDefaultPageAccess = useCallback((office) => {
    const defaultAccess = {
      'MIS': ['mis_dashboard', 'users_management', 'database_manager', 'mis_audit_trail', 'mis_bulletin', 'mis_ratings'],
      'Registrar': ['registrar_dashboard', 'registrar_queue', 'registrar_transaction_logs', 'registrar_audit_trail', 'registrar_settings'],
      'Admissions': ['admissions_dashboard', 'admissions_queue', 'admissions_transaction_logs', 'admissions_audit_trail', 'admissions_settings'],
      'Senior Management': ['senior_management_charts']
    };
    return defaultAccess[office] || [];
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

    if (!formData.role) {
      errors.role = 'Role is required';
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



    // Smart auto-selection: When office changes and role is admin, auto-select relevant page access
    if (field === 'office' && value && formData.role === 'admin') {
      const defaultAccess = getDefaultPageAccess(value);
      setFormData(prev => ({
        ...prev,
        pageAccess: defaultAccess
      }));
    }

    // Smart auto-selection: When role changes to super_admin with MIS office, select all pages
    if (field === 'role' && value === 'super_admin' && formData.office === 'MIS') {
      const allPageIds = adminPages.map(page => page.id);
      setFormData(prev => ({
        ...prev,
        pageAccess: allPageIds
      }));
    }

    // Smart auto-selection: When role changes to admin, auto-select office pages
    if (field === 'role' && value === 'admin' && formData.office) {
      const defaultAccess = getDefaultPageAccess(formData.office);
      setFormData(prev => ({
        ...prev,
        pageAccess: defaultAccess
      }));
    }

    // Clear page access when role changes to admin_staff
    if (field === 'role' && value === 'admin_staff') {
      setFormData(prev => ({
        ...prev,
        pageAccess: []
      }));
    }
  };

  // Handle page access checkbox changes
  const handlePageAccessChange = (pageId, checked) => {
    setFormData(prev => ({
      ...prev,
      pageAccess: checked
        ? [...prev.pageAccess, pageId]
        : prev.pageAccess.filter(id => id !== pageId)
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
      role: '',
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
      role: user.role,
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
      role: '',
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
      const submitData = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        role: formData.role,
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

  // Get role display name
  const getRoleDisplayName = (role) => {
    const roleOption = roleOptions.find(option => option.value === role);
    return roleOption ? roleOption.label : role;
  };

  // Get status badge color
  const getStatusBadgeColor = (isActive) => {
    return isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />

      {/* Show error if fetch failed */}
      {fetchError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading users</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{fetchError}</p>
              </div>
              <div className="mt-4">
                <button
                  onClick={handleManualRefresh}
                  className="bg-red-100 px-3 py-2 rounded-md text-sm font-medium text-red-800 hover:bg-red-200"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Container - White background similar to Settings.jsx */}
      <div className="bg-white p-6 border border-gray-200 rounded-xl">

        {/* Row 1 - Header */}
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <h1 className="text-4xl font-bold text-gray-900 tracking-tight">User Management</h1>
            <div className="flex items-center space-x-1">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">
                As of {formatRefreshTime(lastRefreshTime)}
              </p>
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="p-2 transition-colors duration-200 hover:bg-[#1F3463]/10 rounded-lg border border-[#1F3463]/20"
                title="Refresh users"
              >
                <IoMdRefresh
                  className={`w-5 h-5 text-[#1F3463] ${isRefreshing ? 'animate-spin' : ''}`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Row 2 - Controls */}
        <div className="flex justify-between items-center mb-6">
          {/* Left side - Pagination Control */}
          <div className="flex items-center space-x-2">
            <span className="text-base text-gray-700 font-medium">Showing</span>
            <div className="flex items-center space-x-1">
              <input
                type="number"
                value={usersPerPage}
                onChange={(e) => setUsersPerPage(Math.max(5, Math.min(50, parseInt(e.target.value) || 10)))}
                className="w-16 px-2 py-1 text-base border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent"
                min="5"
                max="50"
              />
              <div className="flex flex-col">
                <button
                  onClick={() => handleUsersPerPageChange(1)}
                  className="p-1 text-gray-500 hover:text-[#1F3463] transition-colors"
                >
                  <MdKeyboardArrowUp className="text-base" />
                </button>
                <button
                  onClick={() => handleUsersPerPageChange(-1)}
                  className="p-1 text-gray-500 hover:text-[#1F3463] transition-colors"
                >
                  <MdKeyboardArrowDown className="text-base" />
                </button>
              </div>
            </div>
            <span className="text-base text-gray-700 font-medium">Users</span>
          </div>

          {/* Right side - Search, Filter dropdown, Add button */}
          <div className="flex items-center space-x-4">
            {/* Search */}
            <div className="relative">
              <MdSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-xl" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent"
              />
            </div>

            {/* Filter */}
            <div className="flex items-center space-x-2">
              <label className="text-base text-gray-700 font-medium">Filter by:</label>
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3463] focus:border-transparent text-base"
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
              className="px-5 py-2.5 bg-[#1F3463] text-white rounded-lg hover:bg-[#1F3463]/90 transition-colors text-base font-semibold"
            >
              + Add User
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {loading ? (
            <>
              {/* Table Header */}
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 h-16 flex items-center">
                <div className="grid grid-cols-5 gap-4 text-sm font-medium text-gray-700 w-full">
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
                  <div key={index} className="px-6 py-4 h-16 flex items-center animate-pulse">
                    <div className="grid grid-cols-5 gap-4 items-center w-full">
                      {/* Name Skeleton */}
                      <div className="h-4 bg-gray-200 rounded w-32"></div>

                      {/* Email Skeleton */}
                      <div className="h-4 bg-gray-200 rounded w-40"></div>

                      {/* Office Skeleton */}
                      <div className="h-4 bg-gray-200 rounded w-24"></div>

                      {/* Role Skeleton */}
                      <div className="h-4 bg-gray-200 rounded w-28"></div>

                      {/* Action Skeleton */}
                      <div className="h-4 bg-gray-200 rounded w-6"></div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : currentUsers.length === 0 ? (
            <div className="text-center py-12">
              <MdPerson className="text-6xl text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No users found</h3>
              <p className="text-base text-gray-500">Try adjusting your search or filter criteria</p>
            </div>
          ) : (
            <>
              {/* Table Header */}
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 h-16 flex items-center">
                <div className="grid grid-cols-5 gap-4 text-base font-bold text-gray-700 w-full">
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
                  <div key={user._id} className="px-6 py-4 hover:bg-gray-50 transition-colors h-16 flex items-center">
                    <div className="grid grid-cols-5 gap-4 items-center w-full">
                      {/* Name */}
                      <div className="text-base font-bold text-gray-900">
                        {user.name}
                      </div>

                      {/* Email */}
                      <div className="text-base font-medium text-gray-900">
                        {user.email}
                      </div>

                      {/* Office */}
                      <div className="text-base font-medium text-gray-900">
                        {user.office || 'N/A'}
                      </div>

                      {/* Role */}
                      <div className="text-base font-medium text-gray-900">
                        {getRoleDisplayName(user.role)}
                      </div>

                      {/* Action */}
                      <div className="text-sm">
                        <button
                          onClick={() => openEditModal(user)}
                          className="text-[#1F3463] hover:text-[#1F3463]/80 p-1 rounded"
                          title="Edit user"
                        >
                          <FiEdit3 className="h-5 w-5" />
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
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredUsers.length)} of {filteredUsers.length} users
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              {/* Current Page Number */}
              <button
                className="px-3 py-2 text-sm font-medium text-white bg-[#1F3463] border border-[#1F3463] rounded-md"
              >
                {currentPage}
              </button>

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingUser ? 'Edit User' : 'Add New User'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${
                    formErrors.name
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                  placeholder="Enter full name"
                />
                {formErrors.name && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${
                    formErrors.email
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                  placeholder="Enter email address"
                />
                {formErrors.email && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>
                )}
              </div>

              {/* Office */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Office <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.office}
                  onChange={(e) => handleInputChange('office', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${
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
                  <p className="mt-1 text-sm text-red-600">{formErrors.office}</p>
                )}
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => handleInputChange('role', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${
                    formErrors.role
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                >
                  <option value="">Select a role</option>
                  {roleOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {formErrors.role && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.role}</p>
                )}
              </div>

              {/* Page Access Control */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-3">
                  Page Access Permissions <span className="text-red-500">*</span>
                </label>
                <div className="border border-gray-300 rounded-lg p-4 max-h-48 overflow-y-auto">
                  {/* Group pages by category */}
                  {['MIS', 'Registrar', 'Admissions', 'Senior Management'].map(category => {
                    const categoryPages = adminPages.filter(page => page.category === category);
                    if (categoryPages.length === 0) return null;

                    return (
                      <div key={category} className="mb-4 last:mb-0">
                        <h4 className="text-sm font-semibold text-[#1F3463] mb-2">{category} Pages</h4>
                        <div className="space-y-2">
                          {categoryPages.map(page => (
                            <label key={page.id} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={formData.pageAccess.includes(page.id)}
                                onChange={(e) => handlePageAccessChange(page.id, e.target.checked)}
                                className="rounded border-gray-300 text-[#1F3463] focus:ring-[#1F3463]"
                              />
                              <span className="text-sm text-gray-700">{page.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {formErrors.pageAccess && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.pageAccess}</p>
                )}
              </div>

              {/* Status (for editing) */}
              {editingUser && (
                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => handleInputChange('isActive', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-900">Active User</span>
                  </label>
                </div>
              )}

              {/* Form Actions */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-white rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50"
                  style={{ backgroundColor: '#1F3463' }}
                >
                  {isSubmitting ? 'Saving...' : (editingUser ? 'Update User' : 'Create User')}
                </button>
              </div>
            </form>
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

