const express = require('express');
const router = express.Router();
const { query } = require('express-validator');
const { verifyToken, checkApiAccess } = require('../middleware/authMiddleware');
const queueRatingsController = require('../controllers/queueRatingsController');
const asyncHandler = require('../middleware/asyncHandler');

// GET /api/queue-ratings - Get ratings from Queue collection with pagination, filtering, and search
router.get('/', verifyToken, checkApiAccess, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 10000 }).withMessage('Limit must be between 1 and 10000'),
  query('search').optional().isString().withMessage('Search must be a string'),
  query('department').optional().isIn(['registrar', 'admissions']).withMessage('Invalid department'),
  query('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO date')
], asyncHandler(queueRatingsController.getQueueRatings));

module.exports = router;

