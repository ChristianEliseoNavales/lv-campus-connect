/**
 * Role-based permissions utility
 * Automatically generates pageAccess arrays based on user roles
 */

/**
 * Get default pageAccess array for a given role
 * @param {string} role - User role
 * @param {string} office - User office/department (optional, used for validation)
 * @returns {Array<string>} - Array of accessible route paths
 */
const getDefaultPageAccess = (role, office = null) => {
  switch (role) {
    case 'super_admin':
      // Super admin has access to ALL routes
      return [
        // MIS routes
        '/admin/mis',
        '/admin/mis/users',
        '/admin/mis/database-manager',
        '/admin/mis/audit-trail',
        '/admin/mis/bulletin',
        '/admin/mis/ratings',
        
        // Registrar routes
        '/admin/registrar',
        '/admin/registrar/queue',
        '/admin/registrar/transaction-logs',
        '/admin/registrar/settings',
        
        // Admissions routes
        '/admin/admissions',
        '/admin/admissions/queue',
        '/admin/admissions/transaction-logs',
        '/admin/admissions/settings',
        
        // Senior Management routes
        '/admin/seniormanagement/charts'
      ];

    case 'registrar_admin':
      // Registrar admin has access to all Registrar routes
      return [
        '/admin/registrar',
        '/admin/registrar/queue',
        '/admin/registrar/transaction-logs',
        '/admin/registrar/settings'
      ];

    case 'admissions_admin':
      // Admissions admin has access to all Admissions routes
      return [
        '/admin/admissions',
        '/admin/admissions/queue',
        '/admin/admissions/transaction-logs',
        '/admin/admissions/settings'
      ];

    case 'senior_management_admin':
      // Senior Management admin has access to charts only
      return [
        '/admin/seniormanagement/charts'
      ];

    default:
      // Unknown role - no access
      console.warn(`Unknown role: ${role}. Returning empty pageAccess.`);
      return [];
  }
};

/**
 * Validate that office matches role
 * @param {string} role - User role
 * @param {string} office - User office/department
 * @returns {boolean} - True if valid, false otherwise
 */
const validateRoleOfficeMatch = (role, office) => {
  const roleOfficeMap = {
    'super_admin': 'MIS',
    'registrar_admin': 'Registrar',
    'admissions_admin': 'Admissions',
    'senior_management_admin': 'Senior Management'
  };

  const expectedOffice = roleOfficeMap[role];
  
  if (!expectedOffice) {
    console.warn(`Unknown role: ${role}`);
    return false;
  }

  return office === expectedOffice;
};

/**
 * Get office/department for a given role
 * @param {string} role - User role
 * @returns {string|null} - Office name or null
 */
const getOfficeForRole = (role) => {
  const roleOfficeMap = {
    'super_admin': 'MIS',
    'registrar_admin': 'Registrar',
    'admissions_admin': 'Admissions',
    'senior_management_admin': 'Senior Management'
  };

  return roleOfficeMap[role] || null;
};

/**
 * Check if a route belongs to a specific department
 * @param {string} route - Route path
 * @returns {string|null} - Department name or null
 */
const getRouteDepartment = (route) => {
  if (route.startsWith('/admin/mis')) return 'MIS';
  if (route.startsWith('/admin/registrar')) return 'Registrar';
  if (route.startsWith('/admin/admissions')) return 'Admissions';
  if (route.startsWith('/admin/seniormanagement')) return 'Senior Management';
  return null;
};

/**
 * Merge custom pageAccess with default pageAccess for a role
 * Ensures users always have at least their role's default access
 * @param {string} role - User role
 * @param {Array<string>} customPageAccess - Custom page access array
 * @returns {Array<string>} - Merged pageAccess array (unique values)
 */
const mergePageAccess = (role, customPageAccess = []) => {
  const defaultAccess = getDefaultPageAccess(role);
  const merged = [...new Set([...defaultAccess, ...customPageAccess])];
  return merged;
};

/**
 * Validate that all routes in pageAccess are valid admin routes
 * @param {Array<string>} pageAccess - Array of route paths
 * @returns {Object} - { valid: boolean, invalidRoutes: Array<string> }
 */
const validatePageAccess = (pageAccess) => {
  const validPrefixes = [
    '/admin/mis',
    '/admin/registrar',
    '/admin/admissions',
    '/admin/seniormanagement'
  ];

  const invalidRoutes = pageAccess.filter(route => {
    // Allow wildcard
    if (route === '*') return false;
    
    // Check if route starts with any valid prefix
    return !validPrefixes.some(prefix => route.startsWith(prefix));
  });

  return {
    valid: invalidRoutes.length === 0,
    invalidRoutes
  };
};

module.exports = {
  getDefaultPageAccess,
  validateRoleOfficeMatch,
  getOfficeForRole,
  getRouteDepartment,
  mergePageAccess,
  validatePageAccess
};

