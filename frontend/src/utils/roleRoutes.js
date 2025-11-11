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
  const allDashboardPaths = [
    '/admin/mis',
    '/admin/registrar',
    '/admin/admissions',
    '/admin/seniormanagement/charts'
  ];

  // MIS Super Admin always goes to MIS dashboard
  if (user.role === 'MIS Super Admin') {
    return '/admin/mis';
  }

  // Priority 1: Check if user has access to ANY dashboard page
  // This ensures dashboard pages are prioritized over other pages
  for (const dashboardPath of allDashboardPaths) {
    if (pageAccess.includes(dashboardPath)) {
      return dashboardPath;
    }
  }

  // Priority 2: Redirect to first page in pageAccess array
  // This is the main logic for users without dashboard access
  if (pageAccess.length > 0) {
    const firstPage = pageAccess[0];

    // Special handling for queue pages with assigned windows
    if (user.assignedWindow && (firstPage === '/admin/registrar/queue' || firstPage === '/admin/admissions/queue')) {
      const assignedWindowId = typeof user.assignedWindow === 'object'
        ? user.assignedWindow._id
        : user.assignedWindow;
      return `${firstPage}/${assignedWindowId}`;
    }

    return firstPage;
  }

  // Fallback: Redirect to login if no page access
  console.warn(`No page access found for user: ${user.email}. Redirecting to login.`);
  return '/login';
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

  // Check for exact match or wildcard access ONLY
  // No parent route access - each page must be explicitly granted
  const hasAccess = pageAccess.some(page => {
    if (page === '*') return true; // Wildcard access (MIS Super Admin only)
    if (page === route) return true; // Exact match required

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

