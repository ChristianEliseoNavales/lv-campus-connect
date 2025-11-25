const { validationResult } = require('express-validator');
const Queue = require('../models/Queue');
const VisitationForm = require('../models/VisitationForm');
const Service = require('../models/Service');

// GET /api/queue-ratings - Get ratings from Queue collection with pagination, filtering, and search
async function getQueueRatings(req, res, next) {
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
          localField: 'serviceId',
          foreignField: '_id',
          as: 'service'
        }
      },

      // Unwind arrays
      { $unwind: { path: '$visitationForm', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },

      // Add computed fields with conditional logic for customerName
      {
        $addFields: {
          customerName: {
            $ifNull: [
              '$visitationForm.customerName',
              {
                $cond: {
                  // If service is 'Enroll', use office-specific labels
                  if: { $eq: ['$service.name', 'Enroll'] },
                  then: {
                    $cond: {
                      if: { $eq: ['$office', 'registrar'] },
                      then: 'Enrollee',
                      else: {
                        $cond: {
                          if: { $eq: ['$office', 'admissions'] },
                          then: 'New Student',
                          else: 'Anonymous Customer'
                        }
                      }
                    }
                  },
                  else: 'Anonymous Customer'
                }
              }
            ]
          },
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

    // Debug logging for Enroll service ratings
    const enrollRatings = ratings.filter(r => r.serviceName === 'Enroll');
    if (enrollRatings.length > 0) {
      console.log('🎓 [QUEUE-RATINGS] Found Enroll service ratings:', enrollRatings.length);
      console.log('🎓 [QUEUE-RATINGS] Sample Enroll rating:', JSON.stringify(enrollRatings[0], null, 2));
    }

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
}

module.exports = {
  getQueueRatings
};



