/**
 * Debug Permissions Utility
 *
 * Helper function to check current user's permissions and diagnose 403 errors
 */

import API_CONFIG from '../config/api';

/**
 * Fetch and display current user's permissions
 * Only works in development mode
 *
 * @returns {Promise<Object>} Permission details
 */
export const debugPermissions = async () => {
  try {
    const token = localStorage.getItem('authToken');

    if (!token) {
      if (import.meta.env.DEV) {
        console.error('❌ No auth token found. Please sign in first.');
      }
      return null;
    }

    const response = await fetch(`${API_CONFIG.getAdminUrl()}/api/auth/debug/permissions`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      if (import.meta.env.DEV) {
        console.error('❌ Failed to fetch permissions:', error);
      }
      return null;
    }

    const data = await response.json();

    // Pretty print the results (only in development)
    if (import.meta.env.DEV) {
      console.log('🔍 PERMISSION DEBUG REPORT');
      console.log('========================');
      console.log('');
      console.log('👤 User Information:');
      console.log('   Email:', data.user.email);
      console.log('   Name:', data.user.name);
      console.log('   Role:', data.user.role);
      console.log('   Office:', data.user.office);
      console.log('   Active:', data.user.isActive);
      console.log('');
      console.log('🔐 Permissions:');
      console.log('   Current PageAccess:', data.permissions.currentPageAccess);
      console.log('   Expected PageAccess:', data.permissions.expectedPageAccess);
      console.log('   Has Correct Access:', data.permissions.hasCorrectAccess ? '✅ YES' : '❌ NO');
      console.log('');

      if (data.permissions.missingPages.length > 0) {
        console.log('⚠️  Missing Pages:');
        data.permissions.missingPages.forEach(page => {
          console.log('   -', page);
        });
        console.log('');
        console.log('💡 Solution: Sign out and sign back in to auto-populate missing pages.');
        console.log('');
      }

      if (data.permissions.extraPages.length > 0) {
        console.log('ℹ️  Extra Pages (not in default):');
        data.permissions.extraPages.forEach(page => {
          console.log('   -', page);
        });
        console.log('');
      }

      if (data.permissions.hasCorrectAccess) {
        console.log('✅ Your permissions are correctly configured!');
      } else {
        console.log('❌ Your permissions need to be updated.');
        console.log('   Please sign out and sign back in.');
      }

      console.log('');
      console.log('========================');
    }

    return data;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('❌ Error debugging permissions:', error);
    }
    return null;
  }
};

/**
 * Check if user has access to a specific page
 *
 * @param {string} page - Page path to check (e.g., '/admin/registrar')
 * @returns {Promise<boolean>} True if user has access
 */
export const checkPageAccess = async (page) => {
  try {
    const data = await debugPermissions();

    if (!data) {
      return false;
    }

    const hasAccess = data.permissions.currentPageAccess.includes(page);

    if (import.meta.env.DEV) {
      if (hasAccess) {
        console.log(`✅ You have access to ${page}`);
      } else {
        console.log(`❌ You do NOT have access to ${page}`);
        console.log(`   Your current access:`, data.permissions.currentPageAccess);
      }
    }

    return hasAccess;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Error checking page access:', error);
    }
    return false;
  }
};

/**
 * Quick fix: Sign out and redirect to login
 * This will trigger the auto-population of pageAccess on next sign in
 */
export const quickFixPermissions = () => {
  if (import.meta.env.DEV) {
    console.log('🔄 Signing out to refresh permissions...');
    console.log('   Please sign in again after being redirected.');
  }

  // Clear auth data
  localStorage.removeItem('authToken');
  localStorage.removeItem('userData');

  // Redirect to login
  window.location.href = '/login';
};

// Make it available in browser console for easy debugging
if (typeof window !== 'undefined') {
  window.debugPermissions = debugPermissions;
  window.checkPageAccess = checkPageAccess;
  window.quickFixPermissions = quickFixPermissions;

  if (import.meta.env.DEV) {
    console.log('🔧 Debug utilities loaded:');
    console.log('   - debugPermissions() - Check your current permissions');
    console.log('   - checkPageAccess("/admin/registrar") - Check access to a specific page');
    console.log('   - quickFixPermissions() - Sign out and refresh permissions');
  }
}

export default {
  debugPermissions,
  checkPageAccess,
  quickFixPermissions
};

