import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  MdDashboard,
  MdSettings,
  MdPeople,
  MdQueue,
  MdChevronLeft,
  MdChevronRight,
  MdExpandMore,
  MdExpandLess,
  MdHistory,
  MdNewspaper,
  MdStar,
  MdBarChart,
  MdSwapHoriz,
  MdStorage,
  MdMonitor,
  MdQuestionAnswer
} from 'react-icons/md';
import { BiSolidNotepad } from 'react-icons/bi';
import { useSocket } from '../../contexts/SocketContext';
import { useOptimizedFetch } from '../../hooks/useOptimizedFetch';
import { ToastContainer, useToast } from '../ui/Toast';
import NotificationBell from '../ui/NotificationBell';
import API_CONFIG from '../../config/api';

const AdminLayout = ({ children }) => {
  const { user, signOut, refreshUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isScrollable, setIsScrollable] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isQueueExpanded, setIsQueueExpanded] = useState(false);
  // Track the last office context to maintain it when navigating to shared routes
  const [lastOfficeContext, setLastOfficeContext] = useState(null);

  // Use centralized Socket context
  const { joinRoom, leaveRoom, subscribe } = useSocket();

  // Toast notifications
  const { toasts, removeToast } = useToast();
  const dropdownRef = useRef(null);
  const mainContentRef = useRef(null);

  // Development mode detection - check if using URL-based role switching
  const isDevelopmentMode = user?.id === 'dev-bypass-user';

  // Determine department based on current admin context (URL path) - memoized
  const department = useMemo(() => {
    const currentPath = location.pathname;
    if (currentPath.startsWith('/admin/registrar')) {
      return 'registrar';
    } else if (currentPath.startsWith('/admin/admissions')) {
      return 'admissions';
    } else {
      // Fallback to role-based department for other paths
      if (user?.role?.includes('Registrar')) {
        return 'registrar';
      } else if (user?.role?.includes('Admissions')) {
        return 'admissions';
      } else if (user?.role === 'MIS Super Admin' || user?.role?.includes('MIS')) {
        // For MIS users, default to registrar if no specific path context
        return 'registrar';
      }
    }
    return null;
  }, [location.pathname, user?.role]);

  // Use optimized fetch for windows data
  const { data: windowsData, refetch: refetchWindows } = useOptimizedFetch(
    department ? `${API_CONFIG.getAdminUrl()}/api/windows/${department}` : null,
    {
      dependencies: [department],
      cacheKey: `windows-${department}`,
      enableCache: true
    }
  );

  // Ensure windows is always an array to prevent null/undefined errors
  const windows = useMemo(() => {
    return Array.isArray(windowsData) ? windowsData : [];
  }, [windowsData]);

  // Socket room management and real-time updates
  useEffect(() => {
    if (!department) return;

    // Join appropriate room based on current admin context
    const roomName = `admin-${department}`;
    joinRoom(roomName);

    // Listen for windows updates with cleanup
    const unsubscribeWindows = subscribe('windows-updated', (data) => {
      if (data.department === department) {
        // console.log(`📡 Windows updated for ${department}:`, data);
        refetchWindows(); // Use optimized refetch
      }
    });

    // Listen for user window assignment changes
    const unsubscribeUserAssignment = subscribe('user-window-assignment-changed', async (data) => {
      // Check if this event is for the current user (try both _id and id)
      if (user && (data.userId === user._id || data.userId === user.id)) {
        // Refresh user data to get updated assignedWindow
        const refreshed = await refreshUser();

        if (refreshed) {
          // Also refetch windows to update navigation
          refetchWindows();
        }
      }
    });

    return () => {
      leaveRoom(roomName);
      unsubscribeWindows();
      unsubscribeUserAssignment();
    };
  }, [department, user, joinRoom, leaveRoom, subscribe, refetchWindows, refreshUser]);

  // Check if queue menu should be expanded based on current route
  const isQueueRouteActive = () => {
    return location.pathname.includes('/queue');
  };

  // Update queue expanded state based on current route
  useEffect(() => {
    const isQueueRoute = isQueueRouteActive();
    if (isQueueRoute && !isQueueExpanded) {
      setIsQueueExpanded(true);
    }
  }, [location.pathname, isQueueExpanded]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsUserDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Detect if page content is scrollable (for unified scrolling)
  useEffect(() => {
    const checkScrollable = () => {
      // Check if the document body is scrollable
      const { scrollHeight, clientHeight } = document.documentElement;
      setIsScrollable(scrollHeight > clientHeight);
    };

    // Check on mount and when children change
    checkScrollable();

    // Check on window resize
    window.addEventListener('resize', checkScrollable);

    // Use MutationObserver to detect content changes in the main content
    const observer = new MutationObserver(checkScrollable);
    if (mainContentRef.current) {
      observer.observe(mainContentRef.current, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true
      });
    }

    return () => {
      window.removeEventListener('resize', checkScrollable);
      observer.disconnect();
    };
  }, [children]);

  // Detect scroll position for header shadow animation
  useEffect(() => {
    const handleScroll = () => {
      // Set isScrolled to true when scrolled down, false when at top
      setIsScrolled(window.scrollY > 0);
    };

    // Check initial scroll position
    handleScroll();

    // Add scroll event listener
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleSignOut = async () => {
    const result = await signOut();
    if (result.success) {
      navigate('/login');
    }
    setIsUserDropdownOpen(false);
  };

  // Office switching functionality
  const canSwitchOffices = () => {
    // Only MIS Super Admin users can switch between offices
    // In development mode, also allow switching when DEV_BYPASS_AUTH is enabled
    return user?.role === 'MIS Super Admin' || isDevelopmentMode;
  };

  const handleOfficeSwitch = (targetOffice) => {
    const targetPaths = {
      'registrar': '/admin/registrar',
      'admissions': '/admin/admissions',
      'mis': '/admin/mis',
      'seniormanagement': '/admin/seniormanagement/charts'
    };

    navigate(targetPaths[targetOffice]);
    setIsUserDropdownOpen(false);
  };

  const getOfficeSwitchButtons = () => {
    // RBAC Logic for Office Switching:
    // - Only MIS Super Admin can switch between all dashboards
    // - MIS Admin/Admin Staff: no switching
    // - Registrar/Admissions/Senior Management (any level): no switching

    // Check if user is MIS Super Admin
    if (user?.role !== 'MIS Super Admin') {
      return []; // No switching for non-super admins
    }

    const currentPath = location.pathname;
    const buttons = [];

    // Determine the effective office context (use lastOfficeContext for shared routes)
    let effectiveOffice = null;
    if (currentPath.startsWith('/admin/mis')) {
      effectiveOffice = 'mis';
    } else if (currentPath.startsWith('/admin/registrar')) {
      effectiveOffice = 'registrar';
    } else if (currentPath.startsWith('/admin/admissions')) {
      effectiveOffice = 'admissions';
    } else if (currentPath.startsWith('/admin/seniormanagement')) {
      effectiveOffice = 'seniormanagement';
    } else if (currentPath.startsWith('/admin/shared')) {
      effectiveOffice = lastOfficeContext;
    }

    if (effectiveOffice === 'mis') {
      // When viewing MIS pages - show ALL target paths: Registrar, Admissions, Senior Management
      buttons.push({
        key: 'registrar',
        text: 'Switch to Registrar\'s Office',
        onClick: () => handleOfficeSwitch('registrar')
      });
      buttons.push({
        key: 'admissions',
        text: 'Switch to Admissions Office',
        onClick: () => handleOfficeSwitch('admissions')
      });
      buttons.push({
        key: 'seniormanagement',
        text: 'Switch to Senior Management',
        onClick: () => handleOfficeSwitch('seniormanagement')
      });
    } else if (effectiveOffice === 'registrar') {
      // When viewing Registrar pages - show MIS, Admissions, Senior Management
      buttons.push({
        key: 'mis',
        text: 'Switch to MIS Office',
        onClick: () => handleOfficeSwitch('mis')
      });
      buttons.push({
        key: 'admissions',
        text: 'Switch to Admissions Office',
        onClick: () => handleOfficeSwitch('admissions')
      });
      buttons.push({
        key: 'seniormanagement',
        text: 'Switch to Senior Management',
        onClick: () => handleOfficeSwitch('seniormanagement')
      });
    } else if (effectiveOffice === 'admissions') {
      // When viewing Admissions pages - show MIS, Registrar, Senior Management
      buttons.push({
        key: 'mis',
        text: 'Switch to MIS Office',
        onClick: () => handleOfficeSwitch('mis')
      });
      buttons.push({
        key: 'registrar',
        text: 'Switch to Registrar\'s Office',
        onClick: () => handleOfficeSwitch('registrar')
      });
      buttons.push({
        key: 'seniormanagement',
        text: 'Switch to Senior Management',
        onClick: () => handleOfficeSwitch('seniormanagement')
      });
    } else if (effectiveOffice === 'seniormanagement') {
      // When viewing Senior Management pages - show MIS, Registrar, Admissions
      buttons.push({
        key: 'mis',
        text: 'Switch to MIS Office',
        onClick: () => handleOfficeSwitch('mis')
      });
      buttons.push({
        key: 'registrar',
        text: 'Switch to Registrar\'s Office',
        onClick: () => handleOfficeSwitch('registrar')
      });
      buttons.push({
        key: 'admissions',
        text: 'Switch to Admissions Office',
        onClick: () => handleOfficeSwitch('admissions')
      });
    }

    return buttons;
  };

  // Dynamic navigation items based on pageAccess
  const getNavigationItems = useCallback(() => {
    const currentPath = location.pathname;
    const pageAccess = user?.pageAccess || [];

    // Debug logging for RBAC
    // console.log('🔍 RBAC Debug - User object:', {
    //   role: user?.role,
    //   assignedWindow: user?.assignedWindow,
    //   assignedWindowType: typeof user?.assignedWindow,
    //   assignedWindowId: user?.assignedWindow?._id || user?.assignedWindow,
    //   assignedWindowIdType: typeof (user?.assignedWindow?._id || user?.assignedWindow),
    //   office: user?.office,
    //   pageAccess: pageAccess
    // });
    // console.log('🔍 RBAC Debug - Current path:', currentPath);
    // console.log('🔍 RBAC Debug - Windows available:', windows.length, windows.map(w => ({ id: w.id, name: w.name })));

    // Determine current office context based on URL for MIS Super Admin
    let currentOffice = null;
    if (currentPath.startsWith('/admin/registrar')) {
      currentOffice = 'registrar';
    } else if (currentPath.startsWith('/admin/admissions')) {
      currentOffice = 'admissions';
    } else if (currentPath.startsWith('/admin/seniormanagement')) {
      currentOffice = 'seniormanagement';
    } else if (currentPath.startsWith('/admin/mis')) {
      currentOffice = 'mis';
    } else if (currentPath.startsWith('/admin/shared')) {
      // For shared routes, use the last office context
      currentOffice = lastOfficeContext;
    }

    // Update lastOfficeContext when we're on a non-shared route
    if (currentOffice && !currentPath.startsWith('/admin/shared')) {
      if (currentOffice !== lastOfficeContext) {
        setLastOfficeContext(currentOffice);
      }
    }

    // Helper function to check if user has access to a specific path
    const hasAccessToPath = (path) => {
      // MIS Super Admin has access to everything
      if (user?.role === 'MIS Super Admin') return true;

      // Check if path is in pageAccess array - exact match only
      // No parent path access - each page must be explicitly granted
      return pageAccess.some(accessPath => {
        if (accessPath === path) return true;
        return false;
      });
    };

    // Master list of all possible navigation items
    const allPossibleItems = {
      // MIS items
      '/admin/mis': { name: 'Dashboard', path: '/admin/mis', icon: MdDashboard, end: true, office: 'mis' },
      '/admin/mis/users': { name: 'Users', path: '/admin/mis/users', icon: MdPeople, office: 'mis' },
      '/admin/mis/database-manager': { name: 'Database Manager', path: '/admin/mis/database-manager', icon: MdStorage, office: 'mis' },
      '/admin/mis/audit-trail': { name: 'Audit Trail', path: '/admin/mis/audit-trail', icon: MdHistory, office: 'mis' },
      '/admin/mis/bulletin': { name: 'Bulletin', path: '/admin/mis/bulletin', icon: MdNewspaper, office: 'mis' },
      '/admin/mis/ratings': { name: 'Ratings', path: '/admin/mis/ratings', icon: MdStar, office: 'mis' },

      // Registrar items
      '/admin/registrar': { name: 'Dashboard', path: '/admin/registrar', icon: MdDashboard, end: true, office: 'registrar' },
      '/admin/registrar/queue': {
        name: 'Queue',
        path: '/admin/registrar/queue',
        icon: MdQueue,
        office: 'registrar',
        isExpandable: true,
        requiresWindows: true
      },
      '/admin/registrar/transaction-logs': { name: 'Transaction Logs', path: '/admin/registrar/transaction-logs', icon: BiSolidNotepad, office: 'registrar' },
      '/admin/registrar/settings': { name: 'Settings', path: '/admin/registrar/settings', icon: MdSettings, office: 'registrar' },

      // Admissions items
      '/admin/admissions': { name: 'Dashboard', path: '/admin/admissions', icon: MdDashboard, end: true, office: 'admissions' },
      '/admin/admissions/queue': {
        name: 'Queue',
        path: '/admin/admissions/queue',
        icon: MdQueue,
        office: 'admissions',
        isExpandable: true,
        requiresWindows: true
      },
      '/admin/admissions/transaction-logs': { name: 'Transaction Logs', path: '/admin/admissions/transaction-logs', icon: BiSolidNotepad, office: 'admissions' },
      '/admin/admissions/settings': { name: 'Settings', path: '/admin/admissions/settings', icon: MdSettings, office: 'admissions' },

      // Senior Management items
      '/admin/seniormanagement/charts': { name: 'Charts', path: '/admin/seniormanagement/charts', icon: MdBarChart, office: 'seniormanagement' },

      // Shared items (accessible by all offices when granted)
      '/admin/shared/faq': { name: 'FAQs', path: '/admin/shared/faq', icon: MdQuestionAnswer, office: 'shared' }
    };

    // Build navigation items based on pageAccess and current office context
    const navigationItems = [];

    // Determine which office's navigation to show
    const targetOffice = currentOffice || user?.office?.toLowerCase() || 'mis';

    // Filter items for the current office
    Object.values(allPossibleItems).forEach(item => {
      // Show items from the current office context OR shared items
      if (item.office !== targetOffice && item.office !== 'shared') return;

      // Check if user has access to this path
      if (!hasAccessToPath(item.path)) return;

      // Handle queue items with window filtering
      if (item.requiresWindows) {
        const officeWindows = windows.filter(w => w && w.id && w.name);

        // Window filtering logic:
        // - Admin Staff: Only see their assigned window(s)
        // - Admin/Super Admin: See all windows
        let filteredWindows = officeWindows;

        // Check if user is Admin Staff (role includes "Admin Staff")
        const isAdminStaff = user?.role?.includes('Admin Staff');

        // Only filter by assigned windows if user is Admin Staff
        if (isAdminStaff) {
          // Support both assignedWindows (array) and assignedWindow (single, deprecated)
          const assignedWindows = user?.assignedWindows || (user?.assignedWindow ? [user.assignedWindow] : []);

          if (assignedWindows.length > 0) {
            // Extract window IDs from assignedWindows (handle both object and string formats)
            const assignedWindowIds = assignedWindows.map(w =>
              typeof w === 'object' ? String(w._id) : String(w)
            );

            filteredWindows = officeWindows.filter(window => {
              const windowId = String(window.id || window._id);
              return assignedWindowIds.includes(windowId);
            });
          } else {
            filteredWindows = []; // Admin Staff without assigned windows should see no windows
          }
        }

        // Only add queue item if there are windows to show
        if (filteredWindows.length > 0) {
          navigationItems.push({
            ...item,
            children: filteredWindows.map(window => ({
              name: window.name,
              path: `${item.path}/${window.id}`,
              windowId: window.id
            }))
          });
        }
      } else {
        // Regular navigation item
        navigationItems.push(item);
      }
    });

    // console.log('📋 RBAC Debug - Navigation items count:', navigationItems.length);
    // console.log('📋 RBAC Debug - Navigation items:', navigationItems.map(i => i.name));

    // For queue items, log the filtered windows
    const queueItem = navigationItems.find(item => item.isExpandable);
    if (queueItem) {
      // console.log('📋 RBAC Debug - Queue windows:', queueItem.children?.length || 0, 'windows');
      // console.log('📋 RBAC Debug - Queue window names:', queueItem.children?.map(w => w.name) || []);
    }

    return navigationItems;
  }, [windows, user?.role, user?.assignedWindows, user?.assignedWindow, user?.pageAccess, location.pathname, isDevelopmentMode, user, lastOfficeContext, setLastOfficeContext]);

  // Get navigation items with error handling
  const navigationItems = useMemo(() => {
    try {
      return getNavigationItems();
    } catch (error) {
      console.error('Error getting navigation items:', error);
      return [];
    }
  }, [getNavigationItems]);

  // Get display name - use actual user name or fallback
  const getDisplayName = () => {
    return user?.name || 'Admin User';
  };

  // Icon components for header
  const UserIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );

  const ChevronDownIcon = () => (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );

  const LogoutIcon = () => (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );

  return (
    <div className="min-h-screen admin-layout" style={{ backgroundColor: '#efefef' }}>
      {/* Sidebar - fixed position, full height, no scrolling */}
      <div
        className={`fixed left-0 top-0 h-screen shadow-xl transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'w-16' : 'w-60'} flex flex-col z-30 rounded-tr-3xl rounded-br-3xl`}
        style={{
          background: 'linear-gradient(to bottom, #161F55 0%, #161F55 70%, #3044BB 100%)',
          // Ensure smooth transitions by preventing layout shifts
          minWidth: isSidebarCollapsed ? '4rem' : '15rem'
        }}
      >
        {/* Logo Section - centered */}
        <div className="p-5 flex flex-col items-center">
          {/* Logo - actual logo image */}
          <img
            src="/logo.png"
            alt="LV Logo"
            className="w-12 h-12 flex-shrink-0 mb-2 object-contain"
          />
          {/* Title with fade animation - centered */}
          <div
            className={`transition-all duration-300 ease-in-out overflow-hidden ${
              isSidebarCollapsed
                ? 'opacity-0 h-0 transform scale-y-0'
                : 'opacity-100 h-auto transform scale-y-100'
            }`}
          >
            <h1 className="text-base font-bold text-white whitespace-nowrap text-center font-days-one">LVCampusConnect</h1>
          </div>
        </div>

        {/* Menu Label - left-aligned */}
        <div
          className={`px-5 mb-1.5 transition-all duration-300 ease-in-out overflow-hidden ${
            isSidebarCollapsed
              ? 'opacity-0 h-0 transform scale-y-0'
              : 'opacity-100 h-auto transform scale-y-100'
          }`}
        >
          <h2 className="text-xs font-semibold text-white uppercase tracking-wider">Menu</h2>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-1.5">
          {navigationItems.map((item) => {
            const IconComponent = item.icon;

            // Handle expandable items (like Queue)
            if (item.isExpandable) {
              const isExpanded = isQueueExpanded;
              const isAnyChildActive = item.children?.some(child =>
                location.pathname === child.path
              );
              const isQueueRoute = location.pathname.includes('/queue');

              return (
                <div key={item.name} className="space-y-1">
                  {/* Parent item - expandable */}
                  <button
                    onClick={() => setIsQueueExpanded(!isQueueExpanded)}
                    className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'space-x-2.5'} px-2.5 py-2.5 rounded-2xl transition-all duration-300 ease-in-out ${
                      isAnyChildActive || isExpanded || isQueueRoute
                        ? 'bg-white/40 text-white'
                        : 'text-white hover:bg-white/10'
                    }`}
                  >
                    {/* Icon - always visible with fixed width */}
                    <IconComponent className="text-lg flex-shrink-0" />

                    {/* Text and chevron with fade and slide animation */}
                    <div
                      className={`flex items-center justify-between w-full transition-all duration-300 ease-in-out overflow-hidden ${
                        isSidebarCollapsed
                          ? 'opacity-0 w-0 transform translate-x-4'
                          : 'opacity-100 w-auto transform translate-x-0'
                      }`}
                    >
                      <span className="font-medium text-sm whitespace-nowrap text-white">{item.name}</span>
                      {!isSidebarCollapsed && (
                        <div className="ml-1.5">
                          {isExpanded ? (
                            <MdExpandLess className="text-base" />
                          ) : (
                            <MdExpandMore className="text-base" />
                          )}
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Child items - windows */}
                  {isExpanded && !isSidebarCollapsed && (
                    <div className="ml-5 space-y-1">
                      {item.children?.map((child) => (
                        <NavLink
                          key={child.path}
                          to={child.path}
                          className={({ isActive }) =>
                            `flex items-center px-2.5 py-1.5 rounded-xl transition-all duration-300 ease-in-out ${
                              isActive
                                ? 'bg-white/50 text-white'
                                : 'text-white/80 hover:bg-white/20 hover:text-white'
                            }`
                          }
                        >
                          <span className="font-medium text-xs">{child.name}</span>
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            // Handle regular navigation items
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center ${isSidebarCollapsed ? 'justify-center' : 'space-x-2.5'} px-2.5 py-2.5 rounded-2xl transition-all duration-300 ease-in-out ${
                    isActive
                      ? 'bg-white/40 text-white'
                      : 'text-white hover:bg-white/10'
                  }`
                }
              >
                {/* Icon - always visible with fixed width */}
                <IconComponent className="text-lg flex-shrink-0" />

                {/* Text with fade and slide animation */}
                <div
                  className={`transition-all duration-300 ease-in-out overflow-hidden ${
                    isSidebarCollapsed
                      ? 'opacity-0 w-0 transform translate-x-4'
                      : 'opacity-100 w-auto transform translate-x-0'
                  }`}
                >
                  <span className="font-medium text-sm whitespace-nowrap text-white">{item.name}</span>
                </div>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Main Content Area - with left margin to account for fixed sidebar */}
      <div
        className="flex flex-col min-h-screen transition-all duration-300 ease-in-out"
        style={{ marginLeft: isSidebarCollapsed ? '4rem' : '15rem' }}
      >
        {/* Header - sticky position with scroll-based shadow animation */}
        <header
          className={`sticky top-0 z-20 px-5 py-3 flex items-center justify-between transition-shadow duration-300 ease-in-out ${isScrolled ? 'shadow-md' : ''}`}
          style={{
            backgroundColor: '#efefef'
          }}
        >
          {/* Left side: Sidebar Toggle Button and Dev Mode Indicator */}
          <div className="flex items-center space-x-2.5">
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="w-8 h-8 rounded-full hover:opacity-80 transition-opacity flex items-center justify-center text-white"
              style={{ backgroundColor: '#161F55' }}
            >
              {isSidebarCollapsed ? (
                <MdChevronRight className="text-lg" />
              ) : (
                <MdChevronLeft className="text-lg" />
              )}
            </button>

            {/* Development Mode Indicator */}
            {isDevelopmentMode && (
              <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-yellow-100 border border-yellow-300 rounded-lg">
                <span className="text-[10px] font-semibold text-yellow-800">DEV MODE</span>
                <span className="text-[10px] text-yellow-700">• URL-based role switching enabled</span>
              </div>
            )}
          </div>

          {/* Right side: Notification Bell and User Profile */}
          <div className="flex items-center space-x-2.5">
            {/* Notification Bell */}
            <NotificationBell />

            {/* User Profile with navy blue background */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                className="flex items-center space-x-2.5 px-3 py-1.5 rounded-xl transition-colors text-white"
                style={{ backgroundColor: '#1F3463' }}
              >
                <UserIcon />
                <span className="font-medium text-sm">{getDisplayName()}</span>
                <ChevronDownIcon />
              </button>

              {/* User Dropdown */}
              {isUserDropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  {/* Office Switch Buttons - only visible for users with multi-office access */}
                  {canSwitchOffices() && getOfficeSwitchButtons().map((button) => (
                    <button
                      key={button.key}
                      onClick={button.onClick}
                      className="w-full flex items-center space-x-1.5 px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <MdSwapHoriz className="w-4 h-4" />
                      <span>{button.text}</span>
                    </button>
                  ))}
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center space-x-1.5 px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <LogoutIcon />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content - natural flow, no internal scrolling */}
        <main
          ref={mainContentRef}
          className="flex-1 p-5"
          style={{ backgroundColor: '#efefef' }}
        >
          {children}
        </main>

        {/* Footer */}
        <footer
          className="px-5 py-3"
          style={{ backgroundColor: '#efefef' }}
        >
          <div className="text-center">
            <p className="text-xs text-gray-500">
              © 2025 LVCampusConnect LVCC - Developed by BSIS4 Group 6
            </p>
          </div>
        </footer>
      </div>

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
    </div>
  );
};

export default AdminLayout;
