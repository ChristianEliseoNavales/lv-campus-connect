const Queue = require('../models/Queue');
const VisitationForm = require('../models/VisitationForm');
const Service = require('../models/Service');
const {
  validateDateString,
  getPhilippineDayBoundaries,
  formatPhilippineDateTime
} = require('../utils/philippineTimezone');

// Helper function to format turnaround time in human-readable format
const formatTurnaroundTime = (diffMs) => {
  const totalSeconds = Math.floor(diffMs / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);

  const seconds = totalSeconds % 60;
  const minutes = totalMinutes % 60;
  const hours = totalHours % 24;
  const days = totalDays;

  // Helper function for singular/plural
  const formatUnit = (value, unit) => {
    if (value === 1) {
      return `${value} ${unit}`;
    }
    return `${value} ${unit}s`;
  };

  // If 24 hours or more: show days and hours only
  if (totalDays >= 1) {
    if (hours === 0) {
      return formatUnit(days, 'day');
    }
    return `${formatUnit(days, 'day')} ${formatUnit(hours, 'hr')}`;
  }

  // If less than 24 hours but 1 hour or more: show hours and minutes only
  if (totalHours >= 1) {
    if (minutes === 0) {
      return formatUnit(hours, 'hr');
    }
    return `${formatUnit(hours, 'hr')} ${formatUnit(minutes, 'min')}`;
  }

  // If less than 1 hour but 1 minute or more: show minutes and seconds
  if (totalMinutes >= 1) {
    if (seconds === 0) {
      return formatUnit(minutes, 'min');
    }
    return `${formatUnit(minutes, 'min')} ${formatUnit(seconds, 'sec')}`;
  }

  // If less than 1 minute: show only seconds
  return formatUnit(seconds, 'sec');
};

// GET /api/transactions/:department - Get transaction logs for a department
async function getTransactionsByDepartment(req, res, next) {
  try {
    const { department } = req.params;
    const {
      date,
      page = 1,
      limit = 20,
      search,
      filterBy
    } = req.query;

    // Validate department
    if (!['registrar', 'admissions'].includes(department)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid department. Must be either "registrar" or "admissions"'
      });
    }

    // Validate and parse pagination params
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Build base query filter
    let queryFilter = {
      office: department,
      status: { $in: ['completed', 'skipped', 'serving', 'waiting', 'no-show'] }
    };

    // Add date filter if provided
    if (date) {
      // Validate date string and check if it's not in the future
      const validation = validateDateString(date);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: validation.error
        });
      }

      try {
        // Get day boundaries in Philippine timezone, converted to UTC for database queries
        const { startOfDay, endOfDay } = getPhilippineDayBoundaries(date);

        console.log(`[${formatPhilippineDateTime()}] Filtering transactions for date: ${date}`);
        console.log(`[${formatPhilippineDateTime()}] UTC boundaries: ${startOfDay.toISOString()} to ${endOfDay.toISOString()}`);

        // Filter by queuedAt only for consistency with dashboard "Visits Today" metric
        queryFilter.queuedAt = {
          $gte: startOfDay,
          $lte: endOfDay
        };
      } catch (error) {
        console.error('Error processing date filter:', error);
        return res.status(400).json({
          success: false,
          error: 'Invalid date format'
        });
      }
    }

    // Add filterBy support (status or priority)
    if (filterBy) {
      if (filterBy === 'priority') {
        queryFilter.isPriority = true;
      } else if (filterBy === 'complete') {
        queryFilter.status = 'completed';
      } else if (filterBy === 'serving') {
        queryFilter.status = 'serving';
      } else if (filterBy === 'waiting') {
        queryFilter.status = 'waiting';
      } else if (filterBy === 'skipped') {
        queryFilter.status = 'skipped';
      } else if (filterBy === 'no-show') {
        queryFilter.status = 'no-show';
      }
    }

    // Build aggregation pipeline for search and pagination
    const pipeline = [
      // Match base filters
      { $match: queryFilter },

      // Lookup visitation form
      {
        $lookup: {
          from: 'visitationforms',
          localField: 'visitationFormId',
          foreignField: '_id',
          as: 'visitationForm'
        }
      },

      // Lookup service
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

      // Add computed fields for search
      {
        $addFields: {
          customerName: {
            $ifNull: [
              '$visitationForm.customerName',
              {
                $cond: {
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
          purposeOfVisit: { $ifNull: ['$service.name', 'Unknown Service'] },
          priorityDisplay: {
            $cond: {
              if: '$isPriority',
              then: { $ifNull: ['$visitationForm.idNumber', 'No'] },
              else: 'No'
            }
          },
          statusDisplay: {
            $switch: {
              branches: [
                { case: { $eq: ['$status', 'serving'] }, then: 'Now Serving' },
                { case: { $eq: ['$status', 'completed'] }, then: 'Complete' },
                { case: { $eq: ['$status', 'skipped'] }, then: 'Skipped' },
                { case: { $eq: ['$status', 'waiting'] }, then: 'Waiting' },
                { case: { $eq: ['$status', 'no-show'] }, then: 'No-show/Cancelled' }
              ],
              default: '$status'
            }
          }
        }
      }
    ];

    // Add search filter if provided
    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      pipeline.push({
        $match: {
          $or: [
            { customerName: searchRegex },
            { purposeOfVisit: searchRegex },
            { queueNumber: { $regex: search.trim(), $options: 'i' } },
            { role: searchRegex },
            { remarks: searchRegex }
          ]
        }
      });
    }

    // Get total count for pagination (before skip/limit)
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await Queue.aggregate(countPipeline);
    const totalCount = countResult.length > 0 ? countResult[0].total : 0;

    // Add sorting and pagination
    pipeline.push(
      { $sort: { completedAt: -1, calledAt: -1, queuedAt: -1 } },
      { $skip: skip },
      { $limit: limitNum }
    );

    // Execute aggregation
    const transactions = await Queue.aggregate(pipeline);

    // Transform data for frontend
    const transformedTransactions = transactions.map(transaction => {
      // Calculate turnaround time
      let turnaroundTime = '0 secs';
      if (transaction.queuedAt && transaction.completedAt) {
        const diffMs = new Date(transaction.completedAt) - new Date(transaction.queuedAt);
        turnaroundTime = formatTurnaroundTime(diffMs);
      } else if (transaction.status === 'waiting' || transaction.status === 'serving') {
        turnaroundTime = 'In Progress';
      }

      return {
        id: transaction._id,
        queueNumber: transaction.queueNumber,
        customerName: transaction.customerName,
        purposeOfVisit: transaction.purposeOfVisit,
        priority: transaction.priorityDisplay,
        role: transaction.role,
        turnaroundTime,
        remarks: transaction.remarks || '',
        status: transaction.statusDisplay,
        timestamp: transaction.completedAt || transaction.calledAt || transaction.createdAt,
        serviceStartTime: transaction.calledAt,
        serviceEndTime: transaction.completedAt
      };
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limitNum);

    res.json({
      success: true,
      data: transformedTransactions,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        limit: limitNum
      }
    });

  } catch (error) {
    console.error('Error fetching transaction logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transaction logs'
    });
  }
}

// PATCH /api/transactions/:id/remarks - Update remarks for a transaction
async function updateTransactionRemarks(req, res, next) {
  try {
    const { id } = req.params;
    const { remarks } = req.body;

    // Validate remarks
    if (typeof remarks !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Remarks must be a string'
      });
    }

    if (remarks.length > 500) {
      return res.status(400).json({
        success: false,
        error: 'Remarks cannot exceed 500 characters'
      });
    }

    // Update the queue record
    const updatedQueue = await Queue.findByIdAndUpdate(
      id,
      { remarks: remarks.trim() },
      { new: true, runValidators: true }
    );

    if (!updatedQueue) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: updatedQueue._id,
        remarks: updatedQueue.remarks
      }
    });

  } catch (error) {
    console.error('Error updating remarks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update remarks'
    });
  }
}

module.exports = {
  getTransactionsByDepartment,
  updateTransactionRemarks
};


