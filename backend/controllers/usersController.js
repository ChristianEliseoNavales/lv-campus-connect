const { validationResult } = require('express-validator');
const User = require('../models/User');
const { AuditService } = require('../middleware/auditMiddleware');
const { validatePageAccessForOffice, getDefaultPageAccess } = require('../utils/rolePermissions');
const emailService = require('../services/emailService');

// Helper function to compare arrays (order-independent) - extracted for reuse
const arraysEqual = (arr1, arr2) => {
  if (!arr1 || !arr2) return false;
  if (arr1.length !== arr2.length) return false;
  const set1 = new Set(arr1);
  const set2 = new Set(arr2);
  return set1.size === set2.size && [...set1].every(item => set2.has(item));
};

// GET /api/users - Fetch all users
async function getAllUsers(req, res, next) {
  try {
    const { role, office, isActive, search, page, limit } = req.query;

    // RBAC: Check if user has permission to fetch users based on office
    // MIS Super Admin can fetch all users
    // Other offices can only fetch users from their own office
    if (req.user.role !== 'MIS Super Admin') {
      // If office filter is provided and doesn't match user's office, deny access
      if (office && office !== req.user.office) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: `You can only access ${req.user.office} office users`
        });
      }

      // If no office filter provided, default to user's office
      // This prevents users from seeing all users across all offices
      if (!office) {
        // Automatically filter to user's office
        req.query.office = req.user.office;
      }
    }

    // Build query object
    const query = {};

    if (role) {
      // Support multiple roles separated by comma
      if (role.includes(',')) {
        const roles = role.split(',').map(r => r.trim());
        query.role = { $in: roles };
      } else {
        query.role = role;
      }
    }

    if (office) {
      query.office = office;
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Check if pagination is requested
    const usePagination = page !== undefined || limit !== undefined;

    if (usePagination) {
      // Validate and parse pagination params
      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
      const skip = (pageNum - 1) * limitNum;

      // Get total count for pagination
      const totalCount = await User.countDocuments(query);

      // Fetch users with pagination
      const users = await User.find(query)
        .select('-password -googleId')
        .populate('createdBy', 'name email')
        .populate('assignedWindow', 'name office')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean();

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalCount / limitNum);

      res.json({
        success: true,
        data: users,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalCount,
          limit: limitNum
        }
      });
    } else {
      // Backward compatibility: return all users if no pagination params
      const users = await User.find(query)
        .select('-password -googleId')
        .populate('createdBy', 'name email')
        .populate('assignedWindow', 'name office')
        .sort({ createdAt: -1 })
        .lean();

      res.json({
        success: true,
        data: users,
        count: users.length
      });
    }
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users',
      message: error.message
    });
  }
}

// GET /api/users/by-access-level/:accessLevel - Fetch users by access level
async function getUsersByAccessLevel(req, res, next) {
  try {
    const { accessLevel } = req.params;

    // Validate accessLevel parameter
    const validAccessLevels = ['super_admin', 'admin', 'admin_staff'];
    if (!validAccessLevels.includes(accessLevel)) {
      return res.status(400).json({
        error: 'Invalid access level specified',
        validAccessLevels
      });
    }

    const users = await User.find({
      accessLevel,
      isActive: true
    })
      .select('_id name email role accessLevel office')
      .sort({ name: 1 });

    res.json(users);
  } catch (error) {
    console.error('Error fetching users by access level:', error);
    res.status(500).json({
      error: 'Failed to fetch users by access level',
      message: error.message
    });
  }
}

// GET /api/users/:id - Fetch single user by ID
async function getUserById(req, res, next) {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -googleId')
      .populate('createdBy', 'name email');

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      error: 'Failed to fetch user',
      message: error.message
    });
  }
}

// POST /api/users - Create new user
async function createUser(req, res, next) {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Log failed validation
      await AuditService.logCRUD({
        user: req.user,
        action: 'CREATE',
        resourceType: 'User',
        resourceName: req.body.email,
        req,
        success: false,
        errorMessage: 'Validation failed'
      });

      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, name, accessLevel, role, office, password, pageAccess } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      // Log failed creation attempt
      await AuditService.logCRUD({
        user: req.user,
        action: 'CREATE',
        resourceType: 'User',
        resourceName: email,
        req,
        success: false,
        errorMessage: 'User already exists'
      });

      return res.status(409).json({
        error: 'User already exists',
        message: 'A user with this email already exists'
      });
    }

    // Validate office requirement (now required for all users)
    if (!office) {
      await AuditService.logCRUD({
        user: req.user,
        action: 'CREATE',
        resourceType: 'User',
        resourceName: email,
        req,
        success: false,
        errorMessage: 'Office is required'
      });

      return res.status(400).json({
        error: 'Office is required'
      });
    }

    // Validate pageAccess matches office restrictions
    if (pageAccess && pageAccess.length > 0) {
      const pageAccessValidation = validatePageAccessForOffice(pageAccess, office, accessLevel);
      if (!pageAccessValidation.valid) {
        await AuditService.logCRUD({
          user: req.user,
          action: 'CREATE',
          resourceType: 'User',
          resourceName: email,
          req,
          success: false,
          errorMessage: pageAccessValidation.message
        });

        return res.status(400).json({
          error: 'Invalid page access',
          message: pageAccessValidation.message,
          invalidRoutes: pageAccessValidation.invalidRoutes
        });
      }
    }

    // Create new user
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
      pageAccess: finalPageAccess
    };

    if (password) {
      userData.password = password;
    }

    const user = new User(userData);
    await user.save();

    // Log successful user creation
    await AuditService.logCRUD({
      user: req.user,
      action: 'CREATE',
      resourceType: 'User',
      resourceId: user._id,
      resourceName: `${user.name} (${user.email})`,
      req,
      success: true,
      newValues: {
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department,
        pageAccess: user.pageAccess
      }
    });

    // Send welcome email to new user (truly non-blocking with timeout)
    // Use Promise.race to ensure email sending doesn't block the response
    const emailStartTime = Date.now();
    const emailTimestamp = new Date().toISOString();

    // [EMAIL_DEBUG] Log email sending attempt start
    console.log(`[EMAIL_DEBUG] ${emailTimestamp} - User creation email sending initiated`);
    console.log(`[EMAIL_DEBUG]   - User: ${user.name} (${user.email})`);
    console.log(`[EMAIL_DEBUG]   - Office: ${user.office}`);
    console.log(`[EMAIL_DEBUG]   - Access Level: ${user.accessLevel}`);

    const emailPromise = emailService.sendWelcomeEmail({
      name: user.name,
      email: user.email,
      office: user.office,
      accessLevel: user.accessLevel
    });

    // Create a timeout promise (3 seconds max wait)
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => {
        const timeoutTimestamp = new Date().toISOString();
        console.log(`[EMAIL_DEBUG] ${timeoutTimestamp} - Promise.race timeout triggered (3 seconds)`);
        resolve({ success: false, error: 'Connection timeout', timeout: true });
      }, 3000);
    });

    // Race between email sending and timeout - don't await, fire and forget
    // This ensures the HTTP response is sent immediately regardless of email status
    Promise.race([emailPromise, timeoutPromise])
      .then((result) => {
        const resultTimestamp = new Date().toISOString();
        const emailDuration = Date.now() - emailStartTime;

        console.log(`[EMAIL_DEBUG] ${resultTimestamp} - Promise.race completed`);
        console.log(`[EMAIL_DEBUG]   - Duration: ${emailDuration}ms`);
        console.log(`[EMAIL_DEBUG]   - Result: ${JSON.stringify(result)}`);

        if (result && !result.success) {
          // Only log if email failed (timeout or other error)
          // Note: emailService already logs errors internally, this is for additional context
          if (result.timeout) {
            console.error(`[EMAIL_DEBUG] ${resultTimestamp} - Email sending timed out after 3 seconds`);
          } else {
            console.error(`[EMAIL_DEBUG] ${resultTimestamp} - Email sending failed:`, result.error || 'Connection timeout');
          }
        } else if (result && result.success) {
          console.log(`[EMAIL_DEBUG] ${resultTimestamp} - Email sending succeeded via Promise.race`);
        }
      })
      .catch((emailError) => {
        const errorTimestamp = new Date().toISOString();
        const emailDuration = Date.now() - emailStartTime;

        // Log email error but don't fail user creation
        console.error(`[EMAIL_DEBUG] ${errorTimestamp} - Promise.race catch block triggered`);
        console.error(`[EMAIL_DEBUG]   - Duration: ${emailDuration}ms`);
        console.error(`[EMAIL_DEBUG]   - Error: ${emailError.message}`);
        if (emailError.stack) {
          console.error(`[EMAIL_DEBUG]   - Stack:`, emailError.stack);
        }
        console.error('❌ Error sending welcome email:', emailError.message);
      });

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('user-created', {
      user: user.toJSON(),
      timestamp: new Date().toISOString()
    });

    // Send response immediately - don't wait for email
    res.status(201).json(user.toJSON());
  } catch (error) {
    console.error('Error creating user:', error);

    // Log failed creation
    await AuditService.logCRUD({
      user: req.user,
      action: 'CREATE',
      resourceType: 'User',
      resourceName: req.body.email,
      req,
      success: false,
      errorMessage: error.message
    });

    res.status(500).json({
      error: 'Failed to create user',
      message: error.message
    });
  }
}

// PUT /api/users/:id - Update user
async function updateUser(req, res, next) {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await AuditService.logCRUD({
        user: req.user,
        action: 'UPDATE',
        resourceType: 'User',
        resourceId: req.params.id,
        req,
        success: false,
        errorMessage: 'Validation failed'
      });

      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const updateData = req.body;

    // Get old values for audit trail
    const oldUser = await User.findById(id).select('-password -googleId');
    if (!oldUser) {
      await AuditService.logCRUD({
        user: req.user,
        action: 'UPDATE',
        resourceType: 'User',
        resourceId: id,
        req,
        success: false,
        errorMessage: 'User not found'
      });

      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Remove password from update if empty
    if (updateData.password === '') {
      delete updateData.password;
    }

    // Validate office requirement (now required for all users)
    if (updateData.role && !updateData.office) {
      if (!oldUser?.office) {
        await AuditService.logCRUD({
          user: req.user,
          action: 'UPDATE',
          resourceType: 'User',
          resourceId: id,
          resourceName: `${oldUser.name} (${oldUser.email})`,
          req,
          success: false,
          errorMessage: 'Office is required'
        });

        return res.status(400).json({
          error: 'Office is required'
        });
      }
    }

    // If pageAccess is being updated and is empty, auto-assign default pageAccess
    if ('pageAccess' in updateData && (!updateData.pageAccess || updateData.pageAccess.length === 0)) {
      const targetRole = updateData.role || oldUser.role;
      const targetOffice = updateData.office || oldUser.office;
      updateData.pageAccess = getDefaultPageAccess(targetRole, targetOffice);
      console.log(`📋 Auto-assigning default pageAccess for role "${targetRole}":`, updateData.pageAccess);
    }

    // Validate pageAccess matches office restrictions
    if (updateData.pageAccess && updateData.pageAccess.length > 0) {
      const targetOffice = updateData.office || oldUser.office;
      const targetAccessLevel = updateData.accessLevel || oldUser.accessLevel;

      // Safeguard: Prevent last Super Admin from removing Users Management access
      if (oldUser.role === 'MIS Super Admin' && !updateData.pageAccess.includes('/admin/mis/users')) {
        const superAdminCount = await User.countDocuments({
          role: 'MIS Super Admin',
          isActive: true
        });

        if (superAdminCount === 1) {
          await AuditService.logCRUD({
            user: req.user,
            action: 'UPDATE',
            resourceType: 'User',
            resourceId: id,
            resourceName: `${oldUser.name} (${oldUser.email})`,
            req,
            success: false,
            errorMessage: 'Cannot remove Users Management access. User is the only active Super Admin.'
          });

          return res.status(400).json({
            error: 'Cannot remove Users Management access',
            message: 'Cannot remove Users Management access. You are the only active Super Admin in the system.'
          });
        }
      }

      const pageAccessValidation = validatePageAccessForOffice(
        updateData.pageAccess,
        targetOffice,
        targetAccessLevel
      );

      if (!pageAccessValidation.valid) {
        await AuditService.logCRUD({
          user: req.user,
          action: 'UPDATE',
          resourceType: 'User',
          resourceId: id,
          resourceName: `${oldUser.name} (${oldUser.email})`,
          req,
          success: false,
          errorMessage: pageAccessValidation.message
        });

        return res.status(400).json({
          error: 'Invalid page access',
          message: pageAccessValidation.message,
          invalidRoutes: pageAccessValidation.invalidRoutes
        });
      }
    }

    const user = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -googleId');

    // Detect changes that require force logout
    let shouldForceLogout = false;
    let logoutReason = '';

    // Check if pageAccess changed
    if ('pageAccess' in updateData) {
      const oldPageAccess = oldUser.pageAccess || [];
      const newPageAccess = user.pageAccess || [];
      if (!arraysEqual(oldPageAccess, newPageAccess)) {
        shouldForceLogout = true;
        logoutReason = 'Your page access permissions have been modified. Please log in again to refresh your access.';
      }
    }

    // Check if isActive changed from true to false
    if ('isActive' in updateData) {
      const oldIsActive = oldUser.isActive !== false; // Treat undefined/null as true
      const newIsActive = user.isActive === true;
      if (oldIsActive && !newIsActive) {
        shouldForceLogout = true;
        logoutReason = 'Your account has been deactivated. Please contact your administrator.';
      }
    }

    // Emit force-logout event if changes detected
    if (shouldForceLogout) {
      const emitForceLogout = req.app.get('emitForceLogout');
      if (emitForceLogout) {
        // Convert user ID to string to match session tracking
        const userId = user._id.toString();
        emitForceLogout(userId, logoutReason);
      }
    }

    // Log successful update
    await AuditService.logCRUD({
      user: req.user,
      action: 'UPDATE',
      resourceType: 'User',
      resourceId: user._id,
      resourceName: `${user.name} (${user.email})`,
      req,
      success: true,
      oldValues: {
        name: oldUser.name,
        email: oldUser.email,
        role: oldUser.role,
        department: oldUser.department,
        pageAccess: oldUser.pageAccess,
        isActive: oldUser.isActive
      },
      newValues: {
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        pageAccess: user.pageAccess,
        isActive: user.isActive
      }
    });

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('user-updated', {
      user: user.toJSON(),
      timestamp: new Date().toISOString()
    });

    res.json(user);
  } catch (error) {
    console.error('Error updating user:', error);

    await AuditService.logCRUD({
      user: req.user,
      action: 'UPDATE',
      resourceType: 'User',
      resourceId: req.params.id,
      req,
      success: false,
      errorMessage: error.message
    });

    res.status(500).json({
      error: 'Failed to update user',
      message: error.message
    });
  }
}

// DELETE /api/users/:id - Delete user (soft delete by setting isActive to false)
async function deleteUser(req, res, next) {
  try {
    const { id } = req.params;

    // Get user info before deletion for audit trail
    const oldUser = await User.findById(id).select('-password -googleId');
    if (!oldUser) {
      await AuditService.logCRUD({
        user: req.user,
        action: 'DELETE',
        resourceType: 'User',
        resourceId: id,
        req,
        success: false,
        errorMessage: 'User not found'
      });

      return res.status(404).json({
        error: 'User not found'
      });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    ).select('-password -googleId');

    // Emit force-logout event to deactivated user
    const emitForceLogout = req.app.get('emitForceLogout');
    if (emitForceLogout) {
      // Convert user ID to string to match session tracking
      const userId = user._id.toString();
      emitForceLogout(userId, 'Your account has been deactivated. Please contact your administrator.');
    }

    // Log successful deletion (deactivation)
    await AuditService.logCRUD({
      user: req.user,
      action: 'DELETE',
      resourceType: 'User',
      resourceId: user._id,
      resourceName: `${user.name} (${user.email})`,
      req,
      success: true,
      oldValues: {
        name: oldUser.name,
        email: oldUser.email,
        role: oldUser.role,
        department: oldUser.department,
        isActive: oldUser.isActive
      },
      newValues: {
        isActive: false
      }
    });

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('user-deleted', {
      userId: id,
      timestamp: new Date().toISOString()
    });

    res.json({
      message: 'User deactivated successfully',
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Error deleting user:', error);

    await AuditService.logCRUD({
      user: req.user,
      action: 'DELETE',
      resourceType: 'User',
      resourceId: req.params.id,
      req,
      success: false,
      errorMessage: error.message
    });

    res.status(500).json({
      error: 'Failed to delete user',
      message: error.message
    });
  }
}

module.exports = {
  getAllUsers,
  getUsersByAccessLevel,
  getUserById,
  createUser,
  updateUser,
  deleteUser
};


