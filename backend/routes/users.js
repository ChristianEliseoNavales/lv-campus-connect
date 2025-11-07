const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auditCRUD, AuditService } = require('../middleware/auditMiddleware');
const { verifyToken, requireSuperAdmin } = require('../middleware/authMiddleware');
const { validatePageAccessForOffice } = require('../utils/rolePermissions');

// Validation middleware
const validateUser = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('accessLevel')
    .isIn(['super_admin', 'admin', 'admin_staff'])
    .withMessage('Invalid access level specified'),
  body('office')
    .isIn(['MIS', 'Registrar', 'Admissions', 'Senior Management'])
    .withMessage('Invalid office specified'),
  body('role')
    .isIn([
      'MIS Super Admin',
      'MIS Admin',
      'MIS Admin Staff',
      'Registrar Admin',
      'Registrar Admin Staff',
      'Admissions Admin',
      'Admissions Admin Staff',
      'Senior Management Admin',
      'Senior Management Admin Staff'
    ])
    .withMessage('Invalid role specified'),
  body('password')
    .optional()
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('pageAccess')
    .optional()
    .isArray()
    .withMessage('Page access must be an array')
];

const validateUserUpdate = [
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('accessLevel')
    .optional()
    .isIn(['super_admin', 'admin', 'admin_staff'])
    .withMessage('Invalid access level specified'),
  body('office')
    .optional()
    .isIn(['MIS', 'Registrar', 'Admissions', 'Senior Management'])
    .withMessage('Invalid office specified'),
  body('role')
    .optional()
    .isIn([
      'MIS Super Admin',
      'MIS Admin',
      'MIS Admin Staff',
      'Registrar Admin',
      'Registrar Admin Staff',
      'Admissions Admin',
      'Admissions Admin Staff',
      'Senior Management Admin',
      'Senior Management Admin Staff'
    ])
    .withMessage('Invalid role specified'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean value'),
  body('pageAccess')
    .optional()
    .isArray()
    .withMessage('Page access must be an array')
];

// GET /api/users - Fetch all users
router.get('/', verifyToken, async (req, res) => {
  try {
    const { role, office, isActive, search } = req.query;

    // RBAC: Check if user has permission to fetch users
    // MIS Super Admin can fetch all users
    // Registrar Admin can only fetch Registrar office users
    // Admissions Admin can only fetch Admissions office users
    if (req.user.role !== 'MIS Super Admin') {
      // If not super admin, check if they're requesting their own office users
      if (req.user.role === 'Registrar Admin' && office !== 'Registrar') {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'Registrar Admin can only access Registrar office users'
        });
      }

      if (req.user.role === 'Admissions Admin' && office !== 'Admissions') {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'Admissions Admin can only access Admissions office users'
        });
      }

      // If they're not super admin and not requesting their own office, deny
      if (req.user.role !== 'Registrar Admin' && req.user.role !== 'Admissions Admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'You do not have permission to access user data'
        });
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

    const users = await User.find(query)
      .select('-password -googleId')
      .populate('createdBy', 'name email')
      .populate('assignedWindow', 'name office')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: users,
      count: users.length
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users',
      message: error.message
    });
  }
});

// GET /api/users/by-access-level/:accessLevel - Fetch users by access level
router.get('/by-access-level/:accessLevel', verifyToken, requireSuperAdmin, async (req, res) => {
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
});

// GET /api/users/:id - Fetch single user by ID
router.get('/:id', verifyToken, requireSuperAdmin, async (req, res) => {
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
});

// POST /api/users - Create new user
router.post('/', verifyToken, requireSuperAdmin, validateUser, async (req, res) => {
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
    const userData = {
      email,
      name,
      accessLevel,
      role,
      office,
      isActive: true,
      pageAccess: pageAccess || []
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

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('user-created', {
      user: user.toJSON(),
      timestamp: new Date().toISOString()
    });

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
});

// PUT /api/users/:id - Update user
router.put('/:id', verifyToken, requireSuperAdmin, validateUserUpdate, async (req, res) => {
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

    // Validate pageAccess matches office restrictions
    if (updateData.pageAccess && updateData.pageAccess.length > 0) {
      const targetOffice = updateData.office || oldUser.office;
      const targetAccessLevel = updateData.accessLevel || oldUser.accessLevel;

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
});

// DELETE /api/users/:id - Delete user (soft delete by setting isActive to false)
router.delete('/:id', verifyToken, requireSuperAdmin, async (req, res) => {
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
});

module.exports = router;
