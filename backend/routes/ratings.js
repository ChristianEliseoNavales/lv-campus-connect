const express = require('express');
const router = express.Router();
const { query } = require('express-validator');
const { verifyToken, requireSuperAdmin, checkApiAccess } = require('../middleware/authMiddleware');
const ratingsController = require('../controllers/ratingsController');
const asyncHandler = require('../middleware/asyncHandler');

// Note: requireSuperAdmin middleware is now imported from authMiddleware.js

// GET /api/ratings - Get ratings with pagination, filtering, and search
router.get('/', verifyToken, checkApiAccess, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().isString().withMessage('Search must be a string'),
  query('department').optional().isIn(['registrar', 'admissions']).withMessage('Invalid department'),
  query('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO date'),
  query('ratingType').optional().isString().withMessage('Rating type must be a string')
], asyncHandler(ratingsController.getRatings));

// GET /api/ratings/stats - Get ratings statistics
router.get('/stats', verifyToken, checkApiAccess, [
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO date'),
  query('department').optional().isIn(['registrar', 'admissions']).withMessage('Invalid department')
], asyncHandler(ratingsController.getRatingsStats));

// GET /api/ratings/department/:department - Get department-specific ratings summary
router.get('/department/:department', verifyToken, checkApiAccess, [
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO date')
], asyncHandler(ratingsController.getDepartmentRatingsSummary));

module.exports = router;
