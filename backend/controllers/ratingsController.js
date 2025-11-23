const { validationResult } = require('express-validator');
const Rating = require('../models/Rating');
const Queue = require('../models/Queue');

// GET /api/ratings - Get ratings with pagination, filtering, and search
async function getRatings(req, res, next) {
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
      endDate,
      ratingType
    } = req.query;

    // Build query object
    const query = {};

    // Department filter
    if (department) {
      query.office = department;
    }

    // Rating filter
    if (rating) {
      query.rating = parseInt(rating);
    }

    // Rating type filter
    if (ratingType) {
      query.ratingType = ratingType;
    }

    // Date range filter (based on queue creation time)
    if (startDate || endDate) {
      // We need to join with Queue to filter by queuedAt
      // This will be handled in the aggregation pipeline
    }

    // Search filter (search in customerName, feedback)
    if (search) {
      query.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { feedback: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build aggregation pipeline to join with Queue for queuedAt
    const pipeline = [
      // Match ratings based on basic filters
      { $match: query },
      
      // Join with Queue to get queuedAt
      {
        $lookup: {
          from: 'queues',
          localField: 'queueId',
          foreignField: '_id',
          as: 'queue'
        }
      },
      
      // Unwind queue array (should be single item)
      { $unwind: { path: '$queue', preserveNullAndEmptyArrays: true } },
      
      // Add queuedAt field for easier access
      {
        $addFields: {
          queuedAt: '$queue.queuedAt'
        }
      }
    ];

    // Add date filtering if specified
    if (startDate || endDate) {
      const dateMatch = {};
      if (startDate) {
        dateMatch.$gte = new Date(startDate);
      }
      if (endDate) {
        dateMatch.$lte = new Date(endDate);
      }
      pipeline.push({
        $match: {
          queuedAt: dateMatch
        }
      });
    }

    // Add sorting
    pipeline.push({ $sort: { createdAt: -1 } });

    // Get total count for pagination
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await Rating.aggregate(countPipeline);
    const totalCount = countResult.length > 0 ? countResult[0].total : 0;

    // Add pagination
    pipeline.push(
      { $skip: skip },
      { $limit: parseInt(limit) }
    );

    // Execute aggregation
    const ratings = await Rating.aggregate(pipeline);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.json({
      success: true,
      data: ratings,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        limit: parseInt(limit),
        hasNextPage,
        hasPrevPage
      }
    });

  } catch (error) {
    console.error('Error fetching ratings:', error);
    res.status(500).json({
      error: 'Failed to fetch ratings',
      message: error.message
    });
  }
}

// GET /api/ratings/stats - Get ratings statistics
async function getRatingsStats(req, res, next) {
  try {
    const { startDate, endDate, department } = req.query;

    // Build match stage
    const matchStage = { status: 'approved' };

    if (department) {
      matchStage.office = department;
    }

    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    const stats = await Rating.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalRatings: { $sum: 1 },
          averageRating: { $avg: '$rating' },
          ratingDistribution: {
            $push: '$rating'
          },
          departmentBreakdown: {
            $push: '$department'
          },
          ratingTypeBreakdown: {
            $push: '$ratingType'
          }
        }
      }
    ]);

    if (stats.length === 0) {
      return res.json({
        success: true,
        data: {
          totalRatings: 0,
          averageRating: 0,
          ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          departmentBreakdown: { registrar: 0, admissions: 0 },
          ratingTypeBreakdown: {}
        }
      });
    }

    const data = stats[0];

    // Calculate rating distribution
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    data.ratingDistribution.forEach(rating => {
      ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
    });

    // Calculate department breakdown
    const departmentBreakdown = { registrar: 0, admissions: 0 };
    data.departmentBreakdown.forEach(dept => {
      departmentBreakdown[dept] = (departmentBreakdown[dept] || 0) + 1;
    });

    // Calculate rating type breakdown
    const ratingTypeBreakdown = {};
    data.ratingTypeBreakdown.forEach(type => {
      ratingTypeBreakdown[type] = (ratingTypeBreakdown[type] || 0) + 1;
    });

    res.json({
      success: true,
      data: {
        totalRatings: data.totalRatings,
        averageRating: Math.round(data.averageRating * 10) / 10,
        ratingDistribution,
        departmentBreakdown,
        ratingTypeBreakdown
      }
    });

  } catch (error) {
    console.error('Error fetching ratings statistics:', error);
    res.status(500).json({
      error: 'Failed to fetch ratings statistics',
      message: error.message
    });
  }
}

// GET /api/ratings/department/:department - Get department-specific ratings summary
async function getDepartmentRatingsSummary(req, res, next) {
  try {
    const { department } = req.params;
    const { startDate, endDate } = req.query;

    // Validate department
    if (!['registrar', 'admissions'].includes(department)) {
      return res.status(400).json({
        error: 'Invalid department. Must be registrar or admissions'
      });
    }

    const summary = await Rating.getDepartmentSummary(department, startDate, endDate);

    res.json({
      success: true,
      data: summary
    });

  } catch (error) {
    console.error('Error fetching department ratings summary:', error);
    res.status(500).json({
      error: 'Failed to fetch department ratings summary',
      message: error.message
    });
  }
}

module.exports = {
  getRatings,
  getRatingsStats,
  getDepartmentRatingsSummary
};



