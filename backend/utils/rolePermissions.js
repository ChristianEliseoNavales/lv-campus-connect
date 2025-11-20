/**
 * Role-based permissions utility
 * Automatically generates pageAccess arrays based on user roles
 */

/**
 * Get default pageAccess array for a given role
 * @param {string} role - User role (combined format: "Office AccessLevel", e.g., "MIS Super Admin")
 * @param {string} office - User office/department (optional, used for validation)
 * @returns {Array<string>} - Array of accessible route paths
 */
const getDefaultPageAccess = (role, office = null) => {
  // Handle new combined role format (e.g., "MIS Super Admin", "Registrar Admin")
  switch (role) {
    case 'MIS Super Admin':
      // MIS Super admin has access to ALL routes
      return [
        // MIS routes
        '/admin/mis',
        '/admin/mis/users',
        '/admin/mis/database-manager',
        '/admin/mis/audit-trail',
        '/admin/mis/bulletin',
        '/admin/mis/faq',
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

    case 'MIS Admin':
      // MIS admin has access to all MIS routes
      return [
        '/admin/mis',
        '/admin/mis/users',
        '/admin/mis/database-manager',
        '/admin/mis/audit-trail',
        '/admin/mis/bulletin',
        '/admin/mis/ratings'
      ];

    case 'Registrar Admin':
      // Registrar admin has access to all Registrar routes
      return [
        '/admin/registrar',
        '/admin/registrar/queue',
        '/admin/registrar/transaction-logs',
        '/admin/registrar/settings'
      ];

    case 'Admissions Admin':
      // Admissions admin has access to all Admissions routes
      return [
        '/admin/admissions',
        '/admin/admissions/queue',
        '/admin/admissions/transaction-logs',
        '/admin/admissions/settings'
      ];

    case 'Senior Management Admin':
      // Senior Management admin has access to charts only
      return [
        '/admin/seniormanagement/charts'
      ];

    // Admin Staff roles get base queue access
    // Specific window routes are added when they're assigned to a window
    case 'MIS Admin Staff':
      return [
        '/admin/mis'
      ];

    case 'Registrar Admin Staff':
      return [
        '/admin/registrar/queue'
      ];

    case 'Admissions Admin Staff':
      return [
        '/admin/admissions/queue'
      ];

    case 'Senior Management Admin Staff':
      return [];

    default:
      // Unknown role - no access
      console.warn(`Unknown role: ${role}. Returning empty pageAccess.`);
      return [];
  }
};

/**
 * Validate that office matches role
 * @param {string} role - User role (combined format: "Office AccessLevel")
 * @param {string} office - User office/department
 * @returns {boolean} - True if valid, false otherwise
 */
const validateRoleOfficeMatch = (role, office) => {
  // Extract office from combined role (e.g., "MIS Super Admin" -> "MIS")
  const roleOffice = role.split(' ')[0];
  return roleOffice === office;
};

/**
 * Get office/department for a given role
 * @param {string} role - User role (combined format: "Office AccessLevel")
 * @returns {string|null} - Office name or null
 */
const getOfficeForRole = (role) => {
  // Extract office from combined role (e.g., "MIS Super Admin" -> "MIS")
  const parts = role.split(' ');
  if (parts.length >= 2) {
    // Handle "Senior Management" which has two words
    if (parts[0] === 'Senior' && parts[1] === 'Management') {
      return 'Senior Management';
    }
    return parts[0];
  }
  return null;
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

/**
 * Validate that pageAccess routes match the user's office restrictions
 * MIS Super Admin can access all pages
 * Other offices can only access pages from their own office
 * @param {Array<string>} pageAccess - Array of route paths
 * @param {string} office - User's office (MIS, Registrar, Admissions, Senior Management)
 * @param {string} accessLevel - User's access level (super_admin, admin, admin_staff)
 * @returns {Object} - { valid: boolean, invalidRoutes: Array<string>, message: string }
 */
const validatePageAccessForOffice = (pageAccess, office, accessLevel) => {
  // MIS Super Admin can access all pages
  if (office === 'MIS' && accessLevel === 'super_admin') {
    return {
      valid: true,
      invalidRoutes: [],
      message: 'MIS Super Admin has access to all pages'
    };
  }

  // Define office-to-route-prefix mapping
  const officeRoutePrefixes = {
    'MIS': '/admin/mis',
    'Registrar': '/admin/registrar',
    'Admissions': '/admin/admissions',
    'Senior Management': '/admin/seniormanagement'
  };

  const allowedPrefix = officeRoutePrefixes[office];
  if (!allowedPrefix) {
    return {
      valid: false,
      invalidRoutes: [],
      message: `Invalid office: ${office}`
    };
  }

  // Check that all pageAccess routes belong to the user's office
  const invalidRoutes = pageAccess.filter(route => {
    // Allow wildcard only for MIS Super Admin (already handled above)
    if (route === '*') return true;

    // Check if route starts with the allowed prefix for this office
    return !route.startsWith(allowedPrefix);
  });

  if (invalidRoutes.length > 0) {
    return {
      valid: false,
      invalidRoutes,
      message: `${office} users can only access pages under ${allowedPrefix}. Invalid routes: ${invalidRoutes.join(', ')}`
    };
  }

  return {
    valid: true,
    invalidRoutes: [],
    message: 'All pageAccess routes are valid for this office'
  };
};

module.exports = {
  getDefaultPageAccess,
  validateRoleOfficeMatch,
  getOfficeForRole,
  getRouteDepartment,
  mergePageAccess,
  validatePageAccess,
  validatePageAccessForOffice
};

