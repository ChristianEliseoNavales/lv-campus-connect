const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { verifyToken, requireSuperAdmin, checkApiAccess } = require('../middleware/authMiddleware');
const usersController = require('../controllers/usersController');

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
router.get('/', verifyToken, checkApiAccess, usersController.getAllUsers);

// GET /api/users/by-access-level/:accessLevel - Fetch users by access level
router.get('/by-access-level/:accessLevel', verifyToken, requireSuperAdmin, usersController.getUsersByAccessLevel);

// GET /api/users/:id - Fetch single user by ID
router.get('/:id', verifyToken, requireSuperAdmin, usersController.getUserById);

// POST /api/users - Create new user
router.post('/', verifyToken, requireSuperAdmin, validateUser, usersController.createUser);

// PUT /api/users/:id - Update user
router.put('/:id', verifyToken, requireSuperAdmin, validateUserUpdate, usersController.updateUser);

// DELETE /api/users/:id - Delete user (soft delete by setting isActive to false)
router.delete('/:id', verifyToken, requireSuperAdmin, usersController.deleteUser);

module.exports = router;
