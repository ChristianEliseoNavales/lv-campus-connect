# API Access Fix for Admin and Admin Staff Users

## Problem Summary

Admin and Admin Staff users were experiencing **403 Forbidden** errors when accessing API endpoints, while Super Admin users worked fine. The console showed errors like:

```
GET /api/windows/registrar 403 (Forbidden)
GET /api/analytics/dashboard-table-data/registrar 403 (Forbidden)
GET /api/settings/queue/registrar 403 (Forbidden)
GET /api/transactions/registrar 403 (Forbidden)
```

## Root Cause Analysis

The issue was caused by users having **empty `pageAccess` arrays** in the database:

1. **Backend Issue**: When users were created, if `pageAccess` was not provided or was empty, it defaulted to an empty array `[]` (line 312 in `backend/routes/users.js`)

2. **Frontend Issue**: When creating Admin Staff users, the `pageAccess` was explicitly cleared to `[]` (lines 400-405 in `frontend/src/components/pages/admin/mis/Users.jsx`)

3. **Authorization Middleware**: The `checkApiAccess` middleware requires users to have at least one matching page in their `pageAccess` array to access APIs. Users with empty arrays were denied access.

4. **Super Admin Exception**: Super Admin users bypassed this check entirely (line 401 in `authMiddleware.js`), which is why they worked fine.

## Solution Implemented

### 1. Backend Fixes (`backend/routes/users.js`)

#### Import Default Page Access Function
```javascript
const { validatePageAccessForOffice, getDefaultPageAccess } = require('../utils/rolePermissions');
```

#### Auto-Assign Default PageAccess on User Creation (Lines 304-327)
```javascript
// If pageAccess is not provided or is empty, use default pageAccess for the role
let finalPageAccess = pageAccess;
if (!finalPageAccess || finalPageAccess.length === 0) {
  finalPageAccess = getDefaultPageAccess(role, office);
  console.log(`📋 Auto-assigning default pageAccess for role "${role}":`, finalPageAccess);
}

const userData = {
  email,
  name,
  accessLevel,
  role,
  office,
  isActive: true,
  pageAccess: finalPageAccess  // Now uses default if empty
};
```

#### Auto-Assign Default PageAccess on User Update (Lines 444-450)
```javascript
// If pageAccess is being updated and is empty, auto-assign default pageAccess
if ('pageAccess' in updateData && (!updateData.pageAccess || updateData.pageAccess.length === 0)) {
  const targetRole = updateData.role || oldUser.role;
  const targetOffice = updateData.office || oldUser.office;
  updateData.pageAccess = getDefaultPageAccess(targetRole, targetOffice);
  console.log(`📋 Auto-assigning default pageAccess for role "${targetRole}":`, updateData.pageAccess);
}
```

### 2. Frontend Fixes (`frontend/src/components/pages/admin/mis/Users.jsx`)

#### Enhanced getDefaultPageAccess Function (Lines 116-166)
Now supports both Admin and Admin Staff access levels:

```javascript
const getDefaultPageAccess = useCallback((office, accessLevel) => {
  // Admin gets full office access
  const adminAccess = {
    'Registrar': [
      '/admin/registrar',
      '/admin/registrar/queue',
      '/admin/registrar/transaction-logs',
      '/admin/registrar/settings'
    ],
    // ... other offices
  };

  // Admin Staff gets limited access (queue page only)
  const adminStaffAccess = {
    'Registrar': [
      '/admin/registrar/queue'
    ],
    // ... other offices
  };

  // Return appropriate access based on access level
  if (accessLevel === 'admin_staff') {
    return adminStaffAccess[office] || [];
  }
  
  return adminAccess[office] || [];
}, []);
```

#### Fixed Admin Staff Auto-Selection (Lines 400-407)
Changed from clearing pageAccess to assigning defaults:

```javascript
// BEFORE (WRONG):
if (field === 'accessLevel' && value === 'admin_staff') {
  setFormData(prev => ({
    ...prev,
    pageAccess: []  // ❌ This caused the problem!
  }));
}

// AFTER (FIXED):
if (field === 'accessLevel' && value === 'admin_staff' && formData.office) {
  const defaultAccess = getDefaultPageAccess(formData.office, 'admin_staff');
  setFormData(prev => ({
    ...prev,
    pageAccess: defaultAccess  // ✅ Now assigns proper defaults
  }));
}
```

### 3. Migration Script (`backend/scripts/fixUserPageAccess.js`)

Created a migration script to fix existing users with empty `pageAccess` arrays. This script:
- Finds all users with empty or missing `pageAccess`
- Automatically assigns default `pageAccess` based on their role
- Provides detailed logging of all changes

## Default Page Access by Role

### Registrar Admin
```javascript
[
  '/admin/registrar',
  '/admin/registrar/queue',
  '/admin/registrar/transaction-logs',
  '/admin/registrar/settings'
]
```

### Registrar Admin Staff
```javascript
[
  '/admin/registrar/queue'
]
```

### Admissions Admin
```javascript
[
  '/admin/admissions',
  '/admin/admissions/queue',
  '/admin/admissions/transaction-logs',
  '/admin/admissions/settings'
]
```

### Admissions Admin Staff
```javascript
[
  '/admin/admissions/queue'
]
```

### MIS Admin
```javascript
[
  '/admin/mis',
  '/admin/mis/users',
  '/admin/mis/database-manager',
  '/admin/mis/audit-trail',
  '/admin/mis/bulletin',
  '/admin/mis/ratings'
]
```

## How to Apply the Fix

### Option 1: Restart Backend Server (Recommended)
1. Stop the backend server
2. Start the backend server again
3. The new code will automatically apply to:
   - All new users created
   - All existing users when they are updated

### Option 2: Run Migration Script (For Immediate Fix)
If you need to fix existing users immediately without waiting for updates:

```bash
# Make sure you have .env file with MONGODB_URI
node backend/scripts/fixUserPageAccess.js
```

### Option 3: Manual Fix via Admin Interface
1. Login as Super Admin
2. Go to MIS > Users
3. Edit each affected Admin/Admin Staff user
4. Click Save (the backend will automatically assign default pageAccess)

## Testing the Fix

### Test New User Creation
1. Login as Super Admin
2. Create a new Registrar Admin user
3. Check the user's pageAccess in the database - should have all 4 Registrar routes
4. Login as that new user
5. Verify they can access Dashboard, Queue, Transaction Logs, and Settings

### Test Existing User Update
1. Login as Super Admin
2. Edit an existing Admin/Admin Staff user with empty pageAccess
3. Click Save without changing anything
4. The backend will automatically assign default pageAccess
5. Login as that user and verify API access works

## Files Modified

1. **backend/routes/users.js**
   - Added import for `getDefaultPageAccess`
   - Modified POST endpoint to auto-assign default pageAccess
   - Modified PUT endpoint to auto-assign default pageAccess

2. **frontend/src/components/pages/admin/mis/Users.jsx**
   - Enhanced `getDefaultPageAccess` to support both admin and admin_staff
   - Fixed admin_staff auto-selection to assign defaults instead of clearing

3. **backend/scripts/fixUserPageAccess.js** (NEW)
   - Migration script to fix existing users

## Expected Behavior After Fix

✅ **Admin Users** can access:
- Dashboard
- Queue Management
- Transaction Logs
- Settings

✅ **Admin Staff Users** can access:
- Queue Management only

✅ **Super Admin Users** can access:
- Everything (unchanged)

✅ **All API requests** return 200 OK instead of 403 Forbidden

## Verification

After applying the fix, you should see:
- No more 403 Forbidden errors in the browser console
- Admin users can view all their assigned pages
- Admin Staff users can view the Queue page
- All charts, tables, and data load properly
- No "Access denied" messages

## Notes

- The fix is **backward compatible** - existing Super Admin users are unaffected
- The fix is **automatic** - no manual intervention needed for new users
- The fix is **safe** - it only assigns defaults when pageAccess is empty
- The fix respects **office restrictions** - users only get access to their office's pages

