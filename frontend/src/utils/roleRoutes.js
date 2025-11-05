/**
 * Role-based routing utility
 * Maps user roles to their default dashboard routes and determines access permissions
 */

/**
 * Get the default route for a user based on their role
 * @param {Object} user - User object with role and office properties
 * @returns {string} - Default route path for the user
 */
export const getDefaultRoute = (user) => {
  if (!user || !user.role) {
    return '/login';
  }

  // Role-based routing
  switch (user.role) {
    case 'super_admin':
      // MIS Super Admin always goes to MIS dashboard
      return '/admin/mis';

    case 'registrar_admin':
      // Registrar Admin goes to Registrar dashboard
      return '/admin/registrar';

    case 'admissions_admin':
      // Admissions Admin goes to Admissions dashboard
      return '/admin/admissions';

    case 'senior_management_admin':
      // Senior Management Admin goes to Charts page
      return '/admin/seniormanagement/charts';

    default:
      // Fallback to generic admin route
      console.warn(`Unknown role: ${user.role}. Redirecting to /admin`);
      return '/admin';
  }
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

  // Super admin has access to everything
  if (user.role === 'super_admin') return true;

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
 * @param {string} role - User role
 * @returns {Array} - Array of allowed route patterns
 */
export const getAllowedRoutesForRole = (role) => {
  switch (role) {
    case 'super_admin':
      return ['*']; // Access to all routes

    case 'registrar_admin':
      return ['/admin/registrar', '/admin/registrar/*'];

    case 'admissions_admin':
      return ['/admin/admissions', '/admin/admissions/*'];

    case 'senior_management_admin':
      return ['/admin/seniormanagement', '/admin/seniormanagement/*'];

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
  
  // Super admin can access all departments
  if (user.role === 'super_admin') return true;

  const routeDepartment = getRouteDepartment(route);
  
  // Map roles to departments
  const roleDepartmentMap = {
    'registrar_admin': 'Registrar',
    'admissions_admin': 'Admissions',
    'senior_management_admin': 'Senior Management'
  };

  return roleDepartmentMap[user.role] === routeDepartment;
};

