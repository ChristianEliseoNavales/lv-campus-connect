const express = require('express');
const router = express.Router();
const { Queue, Service, Window, User, AuditTrail } = require('../models');
const mongoose = require('mongoose');

// Middleware to validate department parameter
const validateDepartment = (req, res, next) => {
  const { department } = req.params;
  if (!['registrar', 'admissions'].includes(department)) {
    return res.status(400).json({ error: 'Invalid department. Must be registrar or admissions.' });
  }
  next();
};

// Middleware to validate time range parameter
const validateTimeRange = (req, res, next) => {
  const { timeRange } = req.query;
  const validRanges = ['year', '6months', '3months', '1month'];
  if (timeRange && !validRanges.includes(timeRange)) {
    return res.status(400).json({
      error: 'Invalid time range. Must be one of: year, 6months, 3months, 1month'
    });
  }
  next();
};

// Helper function to get date range based on time filter (backward-looking from current date)
const getDateRange = (timeRange) => {
  const now = new Date();
  let startDate;
  let endDate = new Date(); // Always end at current date

  switch (timeRange) {
    case '1month':
      // Current month only
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case '3months':
      // Last 3 months from current month (backward-looking)
      startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      break;
    case '6months':
      // Last 6 months from current month (backward-looking)
      startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      break;
    case 'year':
    default:
      // Last 12 months from current month (backward-looking)
      startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      break;
  }

  return { startDate, endDate };
};

// GET /api/analytics/pie-chart/combined - Get combined service distribution for MIS Super Admin
router.get('/pie-chart/combined', async (req, res) => {
  try {
    const { timeRange = 'all' } = req.query;

    // Get date range
    const { startDate } = getDateRange(timeRange);

    // Build match stage for aggregation (both departments)
    const matchStage = {
      status: { $in: ['completed', 'cancelled', 'skipped'] } // Only historical data
    };

    if (startDate) {
      matchStage.queuedAt = { $gte: startDate };
    }

    // Aggregate queue data by service across both departments
    const serviceStats = await Queue.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$serviceId',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 4 } // Top 4 services only
    ]);

    // Get service details (from both departments)
    const serviceIds = serviceStats.map(stat => stat._id);
    const services = await Service.find({
      _id: { $in: serviceIds },
      isActive: true
    }).select('name department');

    // Create service lookup map
    const serviceMap = {};
    services.forEach(service => {
      serviceMap[service._id.toString()] = {
        name: service.name,
        department: service.office // Use 'office' field from database
      };
    });

    // Calculate total for percentages
    const total = serviceStats.reduce((sum, stat) => sum + stat.count, 0);

    // Format data for pie chart
    const chartData = serviceStats.map((stat, index) => {
      const serviceInfo = serviceMap[stat._id] || { name: 'Unknown Service', department: 'unknown' };
      const percentage = ((stat.count / total) * 100).toFixed(1);

      return {
        service: serviceInfo.name,
        department: serviceInfo.department, // Keep 'department' key for backward compatibility with frontend
        count: stat.count,
        percentage: parseFloat(percentage),
        fill: `var(--color-service-${index + 1})`
      };
    });

    res.json({
      success: true,
      data: chartData,
      total,
      timeRange,
      departments: 'combined',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching combined pie chart data:', error);
    res.status(500).json({
      error: 'Failed to fetch combined pie chart data',
      message: error.message
    });
  }
});

// GET /api/analytics/pie-chart/:department - Get service distribution for pie chart
router.get('/pie-chart/:department', validateDepartment, async (req, res) => {
  try {
    const { department } = req.params;
    const { timeRange = 'all' } = req.query;
    
    // Get date range
    const { startDate } = getDateRange(timeRange);
    
    // Build match stage for aggregation
    const matchStage = {
      office: department, // Use 'office' field in database, value comes from route parameter
      status: { $in: ['completed', 'cancelled', 'skipped'] } // Only historical data
    };

    if (startDate) {
      matchStage.queuedAt = { $gte: startDate };
    }

    // Aggregate queue data by service
    const serviceStats = await Queue.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$serviceId',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 4 } // Top 4 services only
    ]);

    // Get service details
    const serviceIds = serviceStats.map(stat => stat._id);
    const services = await Service.find({
      _id: { $in: serviceIds },
      office: department // Use 'office' field in database, value comes from route parameter
    }).select('name');
    
    // Create service lookup map
    const serviceMap = {};
    services.forEach(service => {
      serviceMap[service._id.toString()] = service.name;
    });
    
    // Calculate total for percentages
    const total = serviceStats.reduce((sum, stat) => sum + stat.count, 0);
    
    // Format data for pie chart
    const chartData = serviceStats.map((stat, index) => {
      const serviceName = serviceMap[stat._id] || 'Unknown Service';
      const percentage = ((stat.count / total) * 100).toFixed(1);
      
      return {
        service: serviceName,
        count: stat.count,
        percentage: parseFloat(percentage),
        fill: `var(--color-service-${index + 1})`
      };
    });
    
    res.json({
      success: true,
      data: chartData,
      total,
      department,
      timeRange,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error fetching pie chart data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch pie chart data',
      message: error.message 
    });
  }
});

// GET /api/analytics/area-chart/:department - Get time series data for area chart
router.get('/area-chart/:department', validateDepartment, validateTimeRange, async (req, res) => {
  try {
    const { department } = req.params;
    const { timeRange = '3months' } = req.query;
    
    // Get date range
    const { startDate } = getDateRange(timeRange);
    
    // Build match stage for aggregation
    const matchStage = {
      office: department, // Use 'office' field in database, value comes from route parameter
      status: { $in: ['completed', 'cancelled', 'skipped'] } // Only historical data
    };

    if (startDate) {
      matchStage.queuedAt = { $gte: startDate };
    }
    
    // Choose aggregation based on time range
    let chartData;
    let aggregationStats;

    if (timeRange === '1month') {
      // For "This Month", aggregate by day for detailed view
      aggregationStats = await Queue.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: {
              year: { $year: '$queuedAt' },
              month: { $month: '$queuedAt' },
              day: { $dayOfMonth: '$queuedAt' }
            },
            count: { $sum: 1 },
            firstDate: { $min: '$queuedAt' }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ]);

      // Format data for daily area chart
      chartData = aggregationStats.map(stat => {
        const date = new Date(stat._id.year, stat._id.month - 1, stat._id.day);
        return {
          date: date.toISOString().split('T')[0], // YYYY-MM-DD format
          month: stat._id.day.toString(), // Day number for X-axis
          day: stat._id.day, // Keep day number for reference
          count: stat.count,
          department
        };
      });
    } else {
      // For other time ranges, aggregate by month for cleaner chart display
      aggregationStats = await Queue.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: {
              year: { $year: '$queuedAt' },
              month: { $month: '$queuedAt' }
            },
            count: { $sum: 1 },
            firstDate: { $min: '$queuedAt' }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);

      // Format data for monthly area chart
      chartData = aggregationStats.map(stat => {
        const date = new Date(stat._id.year, stat._id.month - 1, 1); // First day of month
        return {
          date: date.toISOString().split('T')[0], // YYYY-MM-DD format
          month: date.toLocaleDateString('en-US', { month: 'short' }), // Month shortcut (e.g., "Aug")
          count: stat.count,
          department
        };
      });
    }
    
    res.json({
      success: true,
      data: chartData,
      department,
      timeRange,
      aggregationType: timeRange === '1month' ? 'daily' : 'monthly',
      totalEntries: chartData.length,
      totalQueues: aggregationStats.reduce((sum, stat) => sum + stat.count, 0),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error fetching area chart data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch area chart data',
      message: error.message 
    });
  }
});

// GET /api/analytics/dashboard-stats/:department - Get dashboard statistics
router.get('/dashboard-stats/:department', validateDepartment, async (req, res) => {
  try {
    const { department } = req.params;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Get today's stats
    const todayStats = await Queue.aggregate([
      {
        $match: {
          office: department, // Use 'office' field in database, value comes from route parameter
          queuedAt: { $gte: today }
        }
      },
      {
        $group: {
          _id: null,
          totalToday: { $sum: 1 },
          completedToday: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          waitingToday: {
            $sum: { $cond: [{ $eq: ['$status', 'waiting'] }, 1, 0] }
          },
          servingToday: {
            $sum: { $cond: [{ $eq: ['$status', 'serving'] }, 1, 0] }
          }
        }
      }
    ]);

    // Get active windows count
    const activeWindows = await Window.countDocuments({
      office: department, // Use 'office' field in database, value comes from route parameter
      isOpen: true
    });

    // Get total historical queues
    const totalQueues = await Queue.countDocuments({
      office: department, // Use 'office' field in database, value comes from route parameter
      status: { $in: ['completed', 'cancelled', 'skipped'] }
    });

    const stats = todayStats.length > 0 ? todayStats[0] : {
      totalToday: 0,
      completedToday: 0,
      waitingToday: 0,
      servingToday: 0
    };

    res.json({
      success: true,
      data: {
        ...stats,
        activeWindows,
        totalQueues,
        department,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      error: 'Failed to fetch dashboard stats',
      message: error.message
    });
  }
});

// GET /api/analytics/dashboard-table-data/:department - Get dashboard table data
router.get('/dashboard-table-data/:department', validateDepartment, async (req, res) => {
  try {
    const { department } = req.params;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Get all windows for the department
    const windows = await Window.find({
      office: department, // Use 'office' field in database, value comes from route parameter
      isOpen: true
    }).sort({ name: 1 });

    // Get window data with current serving and incoming queue numbers
    const windowData = await Promise.all(
      windows.map(async (window) => {
        // Get current serving queue for this window
        const currentServing = await Queue.findOne({
          windowId: window._id.toString(),
          status: 'serving',
          isCurrentlyServing: true
        });

        // Get next waiting queue for this window
        const nextWaiting = await Queue.findOne({
          windowId: window._id.toString(),
          status: 'waiting'
        }).sort({ queuedAt: 1 });

        return {
          windowName: window.name,
          currentServingNumber: currentServing ? currentServing.queueNumber : 0,
          incomingNumber: nextWaiting ? nextWaiting.queueNumber : 0
        };
      })
    );

    // Get today's total visits
    const todayVisits = await Queue.countDocuments({
      office: department, // Use 'office' field in database, value comes from route parameter
      queuedAt: { $gte: today }
    });

    // Calculate average turnaround time for completed queues
    const completedQueues = await Queue.find({
      office: department, // Use 'office' field in database, value comes from route parameter
      status: 'completed',
      queuedAt: { $exists: true },
      completedAt: { $exists: true }
    }).select('queuedAt completedAt');

    let averageTurnaroundTime = '0 mins';
    if (completedQueues.length > 0) {
      const totalTurnaroundMs = completedQueues.reduce((total, queue) => {
        const turnaroundMs = new Date(queue.completedAt) - new Date(queue.queuedAt);
        return total + turnaroundMs;
      }, 0);

      const averageTurnaroundMs = totalTurnaroundMs / completedQueues.length;
      const averageTurnaroundMins = Math.round(averageTurnaroundMs / (1000 * 60));
      averageTurnaroundTime = `${averageTurnaroundMins} mins`;
    }

    res.json({
      success: true,
      data: {
        windows: windowData,
        todayVisits,
        averageTurnaroundTime,
        department,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching dashboard table data:', error);
    res.status(500).json({
      error: 'Failed to fetch dashboard table data',
      message: error.message
    });
  }
});

// GET /api/analytics/queue-monitor/:department - Get queue monitor data for real-time display
router.get('/queue-monitor/:department', validateDepartment, async (req, res) => {
  try {
    const { department } = req.params;

    // Get all windows for the department (including closed ones for status display)
    const windows = await Window.find({
      office: department // Use 'office' field in database, value comes from route parameter
    }).sort({ name: 1 });

    // Get window data with current serving, incoming queue numbers, and serving status
    const windowData = await Promise.all(
      windows.map(async (window) => {
        // Get current serving queue for this window
        const currentServing = await Queue.findOne({
          windowId: window._id.toString(),
          status: 'serving',
          isCurrentlyServing: true
        });

        // Get next waiting queue for this window
        const nextWaiting = await Queue.findOne({
          windowId: window._id.toString(),
          status: 'waiting'
        }).sort({ queuedAt: 1 });

        return {
          windowId: window._id.toString(),
          windowName: window.name,
          currentServingNumber: currentServing ? currentServing.queueNumber : 0,
          incomingNumber: nextWaiting ? nextWaiting.queueNumber : 0,
          isServing: window.isServing,
          isOpen: window.isOpen
        };
      })
    );

    // Get recently skipped queues (last 10)
    const skippedQueues = await Queue.find({
      office: department, // Use 'office' field in database, value comes from route parameter
      status: 'skipped'
    })
    .sort({ skippedAt: -1 })
    .limit(10)
    .select('queueNumber skippedAt');

    // Get next overall queue number (earliest waiting queue across all windows)
    const nextOverallQueue = await Queue.findOne({
      office: department, // Use 'office' field in database, value comes from route parameter
      status: 'waiting'
    }).sort({ queuedAt: 1 });

    res.json({
      success: true,
      data: {
        windowData,
        skippedQueues: skippedQueues.map(q => q.queueNumber),
        nextQueueNumber: nextOverallQueue ? nextOverallQueue.queueNumber : 0,
        department,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching queue monitor data:', error);
    res.status(500).json({
      error: 'Failed to fetch queue monitor data',
      message: error.message
    });
  }
});

// GET /api/analytics/combined/:department - Get combined data for MIS Super Admin
router.get('/combined/:department', validateDepartment, validateTimeRange, async (req, res) => {
  try {
    const { department } = req.params;
    const { timeRange = '3months' } = req.query;
    
    // Get both pie chart and area chart data
    const [pieChartResponse, areaChartResponse, dashboardStatsResponse] = await Promise.all([
      // Simulate internal API calls
      new Promise(async (resolve) => {
        req.params.department = department;
        req.query.timeRange = timeRange;
        const mockRes = {
          json: (data) => resolve(data),
          status: () => mockRes
        };
        await router.stack.find(layer => layer.route.path === '/pie-chart/:department').route.stack[0].handle(req, mockRes);
      }),
      new Promise(async (resolve) => {
        req.params.department = department;
        req.query.timeRange = timeRange;
        const mockRes = {
          json: (data) => resolve(data),
          status: () => mockRes
        };
        await router.stack.find(layer => layer.route.path === '/area-chart/:department').route.stack[0].handle(req, mockRes);
      }),
      new Promise(async (resolve) => {
        req.params.department = department;
        const mockRes = {
          json: (data) => resolve(data),
          status: () => mockRes
        };
        await router.stack.find(layer => layer.route.path === '/dashboard-stats/:department').route.stack[0].handle(req, mockRes);
      })
    ]);
    
    res.json({
      success: true,
      department,
      timeRange,
      pieChart: pieChartResponse,
      areaChart: areaChartResponse,
      dashboardStats: dashboardStatsResponse,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error fetching combined analytics data:', error);
    res.status(500).json({
      error: 'Failed to fetch combined analytics data',
      message: error.message
    });
  }
});

// GET /api/analytics/active-sessions - Get currently active users
router.get('/active-sessions', async (req, res) => {
  try {
    // Get users who have logged in within the last 30 minutes
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const activeSessions = await AuditTrail.aggregate([
      {
        $match: {
          action: 'LOGIN',
          createdAt: { $gte: thirtyMinutesAgo }
        }
      },
      {
        $group: {
          _id: '$userId',
          userName: { $first: '$userName' },
          userRole: { $first: '$userRole' },
          lastActivity: { $max: '$createdAt' }
        }
      },
      {
        $sort: { lastActivity: -1 }
      }
    ]);

    // Enrich with user department information
    const enrichedSessions = await Promise.all(
      activeSessions.map(async (session) => {
        const user = await User.findById(session._id).select('department');
        return {
          userId: session._id,
          name: session.userName,
          role: session.userRole,
          department: user?.department || 'Unknown',
          lastActivity: session.lastActivity
        };
      })
    );

    res.json({
      success: true,
      data: enrichedSessions,
      count: enrichedSessions.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching active sessions:', error);
    res.status(500).json({
      error: 'Failed to fetch active sessions',
      message: error.message
    });
  }
});

// GET /api/analytics/queue-ratings-summary - Get queue ratings statistics
router.get('/queue-ratings-summary', async (req, res) => {
  try {
    // Count total queue entries with ratings
    const totalRatings = await Queue.countDocuments({
      rating: { $exists: true, $ne: null }
    });

    // Calculate average rating
    const ratingStats = await Queue.aggregate([
      {
        $match: {
          rating: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalRatings: { $sum: 1 }
        }
      }
    ]);

    const stats = ratingStats.length > 0 ? ratingStats[0] : {
      averageRating: 0,
      totalRatings: 0
    };

    res.json({
      success: true,
      data: {
        totalRatings: stats.totalRatings,
        averageRating: parseFloat((stats.averageRating || 0).toFixed(2)),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching queue ratings summary:', error);
    res.status(500).json({
      error: 'Failed to fetch queue ratings summary',
      message: error.message
    });
  }
});

// GET /api/analytics/queue-by-department - Get queue distribution by department
router.get('/queue-by-department', async (req, res) => {
  try {
    // Group all queues by department
    const departmentStats = await Queue.aggregate([
      {
        $group: {
          _id: '$office',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Format response
    const data = departmentStats.map(stat => ({
      department: stat._id === 'registrar' ? 'Registrar' : 'Admissions',
      departmentKey: stat._id,
      count: stat.count
    }));

    res.json({
      success: true,
      data,
      total: data.reduce((sum, item) => sum + item.count, 0),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching queue by department:', error);
    res.status(500).json({
      error: 'Failed to fetch queue by department',
      message: error.message
    });
  }
});

module.exports = router;
