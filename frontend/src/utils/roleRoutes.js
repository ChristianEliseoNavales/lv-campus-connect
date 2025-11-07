/**
 * Role-based routing utility
 * Maps user roles to their default dashboard routes and determines access permissions
 */

/**
 * Get the default route for a user based on their role and pageAccess
 * @param {Object} user - User object with role, office, pageAccess, and assignedWindow properties
 * @returns {string} - Default route path for the user
 */
export const getDefaultRoute = (user) => {
  if (!user || !user.role) {
    return '/login';
  }

  const pageAccess = user.pageAccess || [];

  // Define dashboard paths for each office
  const dashboardPaths = {
    'MIS': '/admin/mis',
    'Registrar': '/admin/registrar',
    'Admissions': '/admin/admissions',
    'Senior Management': '/admin/seniormanagement/charts'
  };

  // MIS Super Admin always goes to MIS dashboard
  if (user.role === 'MIS Super Admin') {
    return '/admin/mis';
  }

  // Get the expected dashboard for the user's office
  const expectedDashboard = dashboardPaths[user.office];

  // Priority 1: Redirect to dashboard if it's in pageAccess
  if (expectedDashboard && pageAccess.includes(expectedDashboard)) {
    return expectedDashboard;
  }

  // Priority 2: For Admin Staff with assignedWindow and queue access, redirect to their window
  if (user.role?.includes('Admin Staff') && user.assignedWindow) {
    const assignedWindowId = typeof user.assignedWindow === 'object'
      ? user.assignedWindow._id
      : user.assignedWindow;

    // Check if user has queue access
    const officePrefix = user.office === 'Registrar' ? '/admin/registrar' : '/admin/admissions';
    const queuePath = `${officePrefix}/queue`;

    if (pageAccess.includes(queuePath) || pageAccess.some(path => path.startsWith(queuePath + '/'))) {
      return `${queuePath}/${assignedWindowId}`;
    }
  }

  // Priority 3: Redirect to first page in pageAccess
  if (pageAccess.length > 0) {
    // Filter out queue base paths (e.g., /admin/registrar/queue) if user has assignedWindow
    // because they should go to specific window route
    let firstPage = pageAccess[0];

    // If first page is a queue base path and user has assignedWindow, try to find a better route
    if (user.assignedWindow && (firstPage === '/admin/registrar/queue' || firstPage === '/admin/admissions/queue')) {
      const assignedWindowId = typeof user.assignedWindow === 'object'
        ? user.assignedWindow._id
        : user.assignedWindow;
      return `${firstPage}/${assignedWindowId}`;
    }

    return firstPage;
  }

  // Fallback: Use office-based default
  if (expectedDashboard) {
    return expectedDashboard;
  }

  // Final fallback
  console.warn(`Unable to determine default route for user: ${user.email}. Redirecting to /admin`);
  return '/admin';
};

/**
 * Get the first accessible page from user's pageAccess array
 * Used for Admin Staff users who have limited page access
 * @param {Array} pageAccess - Array of accessible page routes
 * @returns {string} - First accessible route or null
 */
export const getFirstAccessiblePage = (pageAccess) => {
  if (!pageAccess || !Array.isArray(pageAccess) || pageAccess.length === 0) {
    return null;
  }

  // Filter out wildcard and get the first specific page
  const specificPages = pageAccess.filter(page => page !== '*' && page.startsWith('/admin'));
  
  if (specificPages.length > 0) {
    return specificPages[0];
  }

  return null;
};

/**
 * Check if a user has access to a specific route
 * @param {Object} user - User object with role and pageAccess
 * @param {string} route - Route to check access for
 * @returns {boolean} - True if user has access, false otherwise
 */
export const canAccessRoute = (user, route) => {
  if (!user || !route) return false;

  // MIS Super Admin has access to everything
  if (user.role === 'MIS Super Admin') return true;

  // Check pageAccess array
  const pageAccess = user.pageAccess || [];

  // Check for exact match or wildcard access
  const hasAccess = pageAccess.some(page => {
    if (page === '*') return true; // Wildcard access
    if (page === route) return true; // Exact match

    // Check if the route starts with the allowed page (for parent routes)
    // e.g., if user has access to '/admin/registrar', they can access '/admin/registrar/queue'
    if (route.startsWith(page + '/')) return true;
    if (route.startsWith(page)) return true;

    return false;
  });

  return hasAccess;
};

/**
 * Get allowed routes for a specific role
 * @param {string} role - User role (combined format: "Office AccessLevel")
 * @returns {Array} - Array of allowed route patterns
 */
export const getAllowedRoutesForRole = (role) => {
  switch (role) {
    case 'MIS Super Admin':
      return ['*']; // Access to all routes

    case 'MIS Admin':
      return ['/admin/mis', '/admin/mis/*'];

    case 'Registrar Admin':
      return ['/admin/registrar', '/admin/registrar/*'];

    case 'Admissions Admin':
      return ['/admin/admissions', '/admin/admissions/*'];

    case 'Senior Management Admin':
      return ['/admin/seniormanagement', '/admin/seniormanagement/*'];

    // Admin Staff roles return empty - they use pageAccess array
    case 'MIS Admin Staff':
    case 'Registrar Admin Staff':
    case 'Admissions Admin Staff':
    case 'Senior Management Admin Staff':
      return [];

    default:
      return [];
  }
};

/**
 * Determine if a route belongs to a specific department/office
 * @param {string} route - Route to check
 * @returns {string|null} - Department name or null
 */
export const getRouteDepartment = (route) => {
  if (route.startsWith('/admin/mis')) return 'MIS';
  if (route.startsWith('/admin/registrar')) return 'Registrar';
  if (route.startsWith('/admin/admissions')) return 'Admissions';
  if (route.startsWith('/admin/seniormanagement')) return 'Senior Management';
  return null;
};

/**
 * Check if user's role matches the route's department
 * @param {Object} user - User object
 * @param {string} route - Route to check
 * @returns {boolean} - True if role matches department
 */
export const roleMatchesDepartment = (user, route) => {
  if (!user || !route) return false;

  // MIS Super Admin can access all departments
  if (user.role === 'MIS Super Admin') return true;

  const routeDepartment = getRouteDepartment(route);

  // Extract office from combined role (e.g., "Registrar Admin" -> "Registrar")
  if (user.role && user.role.includes(routeDepartment)) {
    return true;
  }

  return false;
};

