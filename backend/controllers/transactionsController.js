const Queue = require('../models/Queue');
const VisitationForm = require('../models/VisitationForm');
const Service = require('../models/Service');
const Window = require('../models/Window');
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

      // Lookup document request if transactionNo exists
      {
        $lookup: {
          from: 'documentrequests',
          localField: 'transactionNo',
          foreignField: 'transactionNo',
          as: 'documentRequest'
        }
      },

      // Unwind arrays
      { $unwind: { path: '$visitationForm', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$documentRequest', preserveNullAndEmptyArrays: true } },

      // Add computed fields for search
      {
        $addFields: {
          // Customer name: prioritize documentRequest, then visitationForm, then Enroll service fallback
          customerName: {
            $ifNull: [
              '$documentRequest.name',
              {
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
              }
            ]
          },
          // Contact number: prioritize documentRequest, then visitationForm
          contactNumber: {
            $ifNull: [
              '$documentRequest.contactNumber',
              '$visitationForm.contactNumber'
            ]
          },
          // Email: prioritize documentRequest, then visitationForm
          email: {
            $ifNull: [
              '$documentRequest.emailAddress',
              '$visitationForm.email'
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
            { remarks: searchRegex },
            { transactionNo: searchRegex }
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
        transactionNo: transaction.transactionNo || null,
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

// POST /api/admin/transactions/:department - Create transaction from admin side
async function createAdminTransaction(req, res, next) {
  try {
    const { department } = req.params;
    const {
      customerName,
      contactNumber,
      email,
      address,
      service,
      specialRequest,
      specialRequestName,
      priority,
      idNumber,
      role,
      status
    } = req.body;

    // Validate department
    if (!['registrar', 'admissions'].includes(department)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid department. Must be either "registrar" or "admissions"'
      });
    }

    // Validate required fields
    if (!customerName || !contactNumber || !email || !role || !status) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        required: ['customerName', 'contactNumber', 'email', 'role', 'status']
      });
    }

    // Validate service or special request
    if (!specialRequest && !service) {
      return res.status(400).json({
        success: false,
        error: 'Either service or special request must be provided'
      });
    }

    if (specialRequest && !specialRequestName) {
      return res.status(400).json({
        success: false,
        error: 'Special request name is required when special request is selected'
      });
    }

    // Validate role
    if (!['Visitor', 'Student', 'Teacher', 'Alumni'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role. Must be one of: Visitor, Student, Teacher, Alumni'
      });
    }

    // Validate status
    if (!['waiting', 'serving', 'completed', 'skipped', 'cancelled', 'no-show'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be one of: waiting, serving, completed, skipped, cancelled, no-show'
      });
    }

    // Validate priority and idNumber
    const isPriority = priority === 'Yes' || priority === true;
    if (isPriority && !idNumber) {
      return res.status(400).json({
        success: false,
        error: 'ID Number is required for priority transactions'
      });
    }

    // Find or create service
    let serviceObj;
    if (specialRequest) {
      // Find existing service with special request name, or create new one
      serviceObj = await Service.findOne({
        name: specialRequestName.trim(),
        office: department
      });

      if (!serviceObj) {
        // Create new service for special request
        serviceObj = await Service.create({
          name: specialRequestName.trim(),
          office: department,
          isActive: true,
          isSpecialRequest: true
        });
        console.log(`✅ Created new service for special request: ${serviceObj.name}`);
      } else {
        // Update existing service to mark as special request if not already marked
        if (!serviceObj.isSpecialRequest) {
          serviceObj.isSpecialRequest = true;
          await serviceObj.save();
        }
      }
    } else {
      // Find existing service
      serviceObj = await Service.findOne({
        name: service,
        office: department,
        isActive: true
      });

      if (!serviceObj) {
        return res.status(404).json({
          success: false,
          error: 'Service not found or not available'
        });
      }
    }

    // Find window assigned to this queue
    let assignedWindow;

    // Priority queues ALWAYS go to the Priority Window
    if (isPriority) {
      assignedWindow = await Window.findOne({
        office: department,
        name: 'Priority'
      }).populate('serviceIds', 'name').lean();

      if (!assignedWindow) {
        // If Priority Window doesn't exist, try to find any open window
        assignedWindow = await Window.findOne({
          office: department,
          isOpen: true
        }).populate('serviceIds', 'name').lean();

        if (!assignedWindow) {
          return res.status(503).json({
            success: false,
            error: 'No available window found for priority queue'
          });
        }
      }
    } else {
      // Non-priority queues use service-based window assignment
      // Exclude Priority Window from non-priority queue assignment
      assignedWindow = await Window.findOne({
        office: department,
        serviceIds: serviceObj._id,
        name: { $ne: 'Priority' }
      }).populate('serviceIds', 'name').lean();

      if (!assignedWindow) {
        // Try to find any open window (excluding Priority) as fallback
        assignedWindow = await Window.findOne({
          office: department,
          isOpen: true,
          name: { $ne: 'Priority' }
        }).populate('serviceIds', 'name').lean();

        if (!assignedWindow) {
          return res.status(503).json({
            success: false,
            error: 'No available window found for this service'
          });
        }
      }
    }

    // Create visitation form (skip for Enroll service)
    let visitationForm = null;
    const serviceName = specialRequest ? specialRequestName : service;

    if (serviceName !== 'Enroll') {
      visitationForm = await VisitationForm.createForm({
        customerName: customerName.trim(),
        contactNumber: contactNumber.trim(),
        email: email.trim().toLowerCase(),
        address: address ? address.trim() : '',
        idNumber: isPriority ? (idNumber ? idNumber.trim() : '') : ''
      });
    }

    // Get next queue number
    const nextQueueNumber = await Queue.getNextQueueNumber(department);

    // Create queue entry
    const queueData = {
      queueNumber: nextQueueNumber,
      office: department,
      serviceId: serviceObj._id,
      windowId: assignedWindow._id,
      role,
      isPriority: Boolean(isPriority),
      status: status,
      isAdminCreated: true, // Mark as admin-created transaction
      processedBy: req.user?.id || req.user?._id || null // Set admin user who created it
    };

    // Only add visitationFormId if visitationForm was created
    if (visitationForm) {
      queueData.visitationFormId = visitationForm._id;
    }

    // Add idNumber if priority
    if (isPriority && idNumber) {
      queueData.idNumber = idNumber.trim();
    }

    // Set timestamps based on status
    const now = new Date();
    queueData.queuedAt = now;

    if (status === 'serving') {
      queueData.calledAt = now;
      queueData.isCurrentlyServing = true;
    } else if (status === 'completed') {
      queueData.calledAt = now;
      queueData.completedAt = now;
    } else if (status === 'skipped') {
      queueData.skippedAt = now;
    }

    const queueEntry = new Queue(queueData);
    await queueEntry.save();

    res.json({
      success: true,
      data: {
        id: queueEntry._id,
        queueNumber: queueEntry.queueNumber,
        office: queueEntry.office,
        service: serviceName,
        status: queueEntry.status,
        role: queueEntry.role,
        isPriority: queueEntry.isPriority
      }
    });

  } catch (error) {
    console.error('Error creating admin transaction:', error);

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationErrors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create transaction',
      details: error.message
    });
  }
}

// GET /api/admin/transactions/:id/details - Get full transaction details
async function getTransactionDetails(req, res, next) {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid transaction ID format'
      });
    }

    // Find the queue entry with all populated data
    const queueEntry = await Queue.findById(id)
      .populate('visitationFormId')
      .populate('serviceId')
      .populate('windowId', 'name')
      .lean();

    if (!queueEntry) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    // Calculate turnaround time
    let turnaroundTime = '0 secs';
    if (queueEntry.queuedAt && queueEntry.completedAt) {
      const diffMs = new Date(queueEntry.completedAt) - new Date(queueEntry.queuedAt);
      turnaroundTime = formatTurnaroundTime(diffMs);
    } else if (queueEntry.status === 'waiting' || queueEntry.status === 'serving') {
      turnaroundTime = 'In Progress';
    }

    // Format status for display
    const statusDisplay = queueEntry.status === 'serving' ? 'Now Serving' :
                         queueEntry.status === 'completed' ? 'Complete' :
                         queueEntry.status === 'skipped' ? 'Skipped' :
                         queueEntry.status === 'no-show' ? 'No-show/Cancelled' :
                         queueEntry.status.charAt(0).toUpperCase() + queueEntry.status.slice(1);

    // Get customer name
    let customerName = 'Anonymous Customer';
    if (queueEntry.visitationFormId) {
      customerName = queueEntry.visitationFormId.customerName;
    } else if (queueEntry.serviceId?.name === 'Enroll') {
      customerName = queueEntry.office === 'registrar' ? 'Enrollee' : 'New Student';
    }

    // Format response
    const response = {
      success: true,
      data: {
        // Queue Information
        queueNumber: queueEntry.queueNumber,
        office: queueEntry.office,
        service: queueEntry.serviceId?.name || 'Unknown Service',
        window: queueEntry.windowId?.name || 'Unknown Window',
        role: queueEntry.role,
        priority: queueEntry.isPriority ? 'Yes' : 'No',
        status: statusDisplay,
        statusValue: queueEntry.status,
        turnaroundTime,
        isAdminCreated: queueEntry.isAdminCreated || false,
        isSpecialRequest: queueEntry.serviceId?.isSpecialRequest || false,

        // Customer Information
        customerName,
        contactNumber: queueEntry.visitationFormId?.contactNumber || '',
        email: queueEntry.visitationFormId?.email || '',
        address: queueEntry.visitationFormId?.address || '',
        idNumber: queueEntry.visitationFormId?.idNumber || queueEntry.idNumber || '',

        // Timestamps
        queuedAt: queueEntry.queuedAt,
        calledAt: queueEntry.calledAt,
        servedAt: queueEntry.servedAt,
        completedAt: queueEntry.completedAt,
        skippedAt: queueEntry.skippedAt,
        createdAt: queueEntry.createdAt,
        updatedAt: queueEntry.updatedAt,

        // Admin Remarks
        remarks: queueEntry.remarks || ''
      }
    };

    res.json(response);

  } catch (error) {
    console.error('Error fetching transaction details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transaction details',
      details: error.message
    });
  }
}

// PATCH /api/admin/transactions/:id/status - Update transaction status and remarks
async function updateTransactionStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;

    // Validate ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid transaction ID format'
      });
    }

    // Validate status if provided
    if (status && !['waiting', 'serving', 'completed', 'skipped', 'cancelled', 'no-show'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be one of: waiting, serving, completed, skipped, cancelled, no-show'
      });
    }

    // Validate remarks if provided
    if (remarks !== undefined) {
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
    }

    // Find the queue entry
    const queueEntry = await Queue.findById(id);

    if (!queueEntry) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    // Update status if provided
    if (status) {
      queueEntry.status = status;
      const now = new Date();

      // Update timestamps based on status
      if (status === 'serving') {
        queueEntry.calledAt = queueEntry.calledAt || now;
        queueEntry.isCurrentlyServing = true;
      } else if (status === 'completed') {
        queueEntry.calledAt = queueEntry.calledAt || now;
        queueEntry.completedAt = now;
        queueEntry.isCurrentlyServing = false;
      } else if (status === 'skipped') {
        queueEntry.skippedAt = now;
        queueEntry.isCurrentlyServing = false;
      } else {
        queueEntry.isCurrentlyServing = false;
      }
    }

    // Update remarks if provided
    if (remarks !== undefined) {
      queueEntry.remarks = remarks.trim();
    }

    await queueEntry.save();

    res.json({
      success: true,
      data: {
        id: queueEntry._id,
        status: queueEntry.status,
        remarks: queueEntry.remarks
      }
    });

  } catch (error) {
    console.error('Error updating transaction status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update transaction status',
      details: error.message
    });
  }
}

module.exports = {
  getTransactionsByDepartment,
  updateTransactionRemarks,
  createAdminTransaction,
  getTransactionDetails,
  updateTransactionStatus
};


