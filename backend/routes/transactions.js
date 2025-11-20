const express = require('express');
const router = express.Router();
const Queue = require('../models/Queue');
const VisitationForm = require('../models/VisitationForm');
const Service = require('../models/Service');
const { verifyToken, requireRole, checkApiAccess } = require('../middleware/authMiddleware');
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
router.get('/:department', verifyToken, checkApiAccess, async (req, res) => {
  try {
    const { department } = req.params;
    const { date } = req.query; // Get date filter from query parameters

    // Validate department
    if (!['registrar', 'admissions'].includes(department)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid department. Must be either "registrar" or "admissions"'
      });
    }

    // Build query filter
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

    // Fetch transaction logs
    const transactions = await Queue.find(queryFilter)
    .populate('visitationFormId', 'customerName contactNumber email address idNumber')
    .sort({ completedAt: -1, calledAt: -1, queuedAt: -1 }) // Most recent first
    .lean();

    // Fetch services for mapping serviceId to service name
    const services = await Service.find({ office: department }).lean();
    const serviceMap = services.reduce((map, service) => {
      map[service._id.toString()] = service.name;
      return map;
    }, {});

    // Transform data for frontend
    const transformedTransactions = transactions.map(transaction => {
      // Calculate turnaround time (total time from queue submission to completion)
      let turnaroundTime = '0 secs';
      if (transaction.queuedAt && transaction.completedAt) {
        const diffMs = new Date(transaction.completedAt) - new Date(transaction.queuedAt);
        turnaroundTime = formatTurnaroundTime(diffMs);
      } else if (transaction.status === 'waiting' || transaction.status === 'serving') {
        turnaroundTime = 'In Progress';
      }

      // Determine status display
      let statusDisplay = transaction.status;
      if (transaction.status === 'serving') {
        statusDisplay = 'Now Serving';
      } else if (transaction.status === 'completed') {
        statusDisplay = 'Complete';
      } else if (transaction.status === 'skipped') {
        statusDisplay = 'Skipped';
      } else if (transaction.status === 'waiting') {
        statusDisplay = 'Waiting';
      } else if (transaction.status === 'no-show') {
        statusDisplay = 'No-show/Cancelled';
      }

      // Determine customer name using same logic as queue display
      let customerName;
      if (transaction.visitationFormId?.customerName) {
        customerName = transaction.visitationFormId.customerName;
      } else {
        // For Enroll service without visitation form, use office-specific labels
        const serviceName = serviceMap[transaction.serviceId];
        if (serviceName === 'Enroll') {
          if (transaction.office === 'registrar') {
            customerName = 'Enrollee';
          } else if (transaction.office === 'admissions') {
            customerName = 'New Student';
          } else {
            customerName = 'N/A (Enroll Service)';
          }
        } else {
          customerName = 'Anonymous Customer';
        }
      }

      return {
        id: transaction._id,
        queueNumber: transaction.queueNumber,
        customerName,
        purposeOfVisit: serviceMap[transaction.serviceId] || 'Unknown Service',
        priority: transaction.isPriority ? (transaction.visitationFormId?.idNumber || 'No') : 'No',
        role: transaction.role,
        turnaroundTime,
        remarks: transaction.remarks || '',
        status: statusDisplay,
        timestamp: transaction.completedAt || transaction.calledAt || transaction.createdAt,
        serviceStartTime: transaction.calledAt,
        serviceEndTime: transaction.completedAt
      };
    });

    res.json({
      success: true,
      data: transformedTransactions,
      count: transformedTransactions.length
    });

  } catch (error) {
    console.error('Error fetching transaction logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transaction logs'
    });
  }
});

// PATCH /api/transactions/:id/remarks - Update remarks for a transaction
router.patch('/:id/remarks', async (req, res) => {
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
});

module.exports = router;
