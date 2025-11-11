const express = require('express');
const router = express.Router();
const Queue = require('../models/Queue');
const VisitationForm = require('../models/VisitationForm');
const Service = require('../models/Service');
const { query, validationResult } = require('express-validator');
const { verifyToken, checkApiAccess } = require('../middleware/authMiddleware');

// GET /api/queue-ratings - Get ratings from Queue collection with pagination, filtering, and search
router.get('/', verifyToken, checkApiAccess, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000'),
  query('search').optional().isString().withMessage('Search must be a string'),
  query('department').optional().isIn(['registrar', 'admissions']).withMessage('Invalid department'),
  query('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO date')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const {
      page = 1,
      limit = 20,
      search,
      department,
      rating,
      startDate,
      endDate
    } = req.query;

    // Build match stage for aggregation
    const matchStage = {
      rating: { $exists: true, $ne: null } // Only queues with ratings
    };

    // Department filter
    if (department) {
      matchStage.office = department;
    }

    // Rating filter
    if (rating) {
      matchStage.rating = parseInt(rating);
    }

    // Date range filter
    if (startDate || endDate) {
      matchStage.queuedAt = {};
      if (startDate) {
        matchStage.queuedAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        matchStage.queuedAt.$lte = endDateTime;
      }
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build aggregation pipeline
    const pipeline = [
      // Match queues with ratings
      { $match: matchStage },
      
      // Join with VisitationForm to get customer details
      {
        $lookup: {
          from: 'visitationforms',
          localField: 'visitationFormId',
          foreignField: '_id',
          as: 'visitationForm'
        }
      },
      
      // Join with Service to get service name
      {
        $lookup: {
          from: 'services',
          let: { serviceIdStr: { $toString: '$serviceId' } },
          pipeline: [
            {
              $match: {
                $expr: { $eq: [{ $toString: '$_id' }, '$$serviceIdStr'] }
              }
            }
          ],
          as: 'service'
        }
      },
      
      // Unwind arrays
      { $unwind: { path: '$visitationForm', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
      
      // Add computed fields
      {
        $addFields: {
          customerName: '$visitationForm.customerName',
          serviceName: '$service.name',
          department: '$office'
        }
      },
      
      // Search filter (after joining to access customerName)
      ...(search ? [{
        $match: {
          $or: [
            { customerName: { $regex: search, $options: 'i' } },
            { serviceName: { $regex: search, $options: 'i' } }
          ]
        }
      }] : []),
      
      // Sort by queuedAt descending (most recent first)
      { $sort: { queuedAt: -1 } },
      
      // Facet for pagination
      {
        $facet: {
          metadata: [
            { $count: 'total' }
          ],
          data: [
            { $skip: skip },
            { $limit: parseInt(limit) },
            {
              $project: {
                _id: 1,
                queueNumber: 1,
                office: 1,
                rating: 1,
                queuedAt: 1,
                customerName: 1,
                serviceName: 1,
                department: 1,
                role: 1,
                status: 1
              }
            }
          ]
        }
      }
    ];

    const result = await Queue.aggregate(pipeline);
    
    const total = result[0].metadata[0]?.total || 0;
    const ratings = result[0].data || [];
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: ratings,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching queue ratings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch queue ratings',
      details: error.message
    });
  }
});

module.exports = router;

