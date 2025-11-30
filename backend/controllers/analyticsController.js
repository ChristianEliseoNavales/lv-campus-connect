const { Queue, Service, Window, User, AuditTrail, Rating } = require('../models');
const sessionService = require('../services/sessionService');

// Helper function to get date range based on time filter
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
      // Last 3 months from current month
      startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      break;
    case '6months':
      // Last 6 months from current month
      startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      break;
    case 'year':
      // Last 12 months from current month
      startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      break;
    case 'all':
    default:
      // All time - no start date filter (will return all data)
      startDate = null;
      break;
  }

  return { startDate, endDate };
};

// GET /api/analytics/pie-chart/combined - Get combined service distribution for MIS Super Admin
async function getCombinedPieChart(req, res, next) {
  try {
    const { timeRange = 'all' } = req.query;

    // Get date range
    const { startDate } = getDateRange(timeRange);

    // Build match stage for aggregation (both departments)
    const matchStage = {
      status: { $in: ['completed', 'cancelled', 'skipped', 'no-show'] } // Only historical data
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
    }).select('name office').lean();

    // Create service lookup map
    const serviceMap = {};
    services.forEach(service => {
      serviceMap[service._id.toString()] = {
        name: service.name,
        department: service.office // Map 'office' field to 'department' for frontend compatibility
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
}

// Helper function to get pie chart data (extracted for reuse)
async function getPieChartData(department, timeRange = 'all') {
  // Get date range
  const { startDate } = getDateRange(timeRange);

  // Build match stage for aggregation
  const matchStage = {
    office: department,
    status: { $in: ['completed', 'cancelled', 'skipped', 'no-show'] }
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
    { $limit: 4 }
  ]);

  // Get service details
  const serviceIds = serviceStats.map(stat => stat._id);
  const services = await Service.find({
    _id: { $in: serviceIds },
    office: department
  }).select('name').lean();

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

  return {
    success: true,
    data: chartData,
    total,
    department,
    timeRange,
    timestamp: new Date().toISOString()
  };
}

// GET /api/analytics/pie-chart/:department - Get service distribution for pie chart
async function getPieChartByDepartment(req, res, next) {
  try {
    const { department } = req.params;
    const { timeRange = 'all' } = req.query;
    const result = await getPieChartData(department, timeRange);
    res.json(result);
  } catch (error) {
    console.error('Error fetching pie chart data:', error);
    res.status(500).json({
      error: 'Failed to fetch pie chart data',
      message: error.message
    });
  }
}

// Helper function to get area chart data (extracted for reuse)
async function getAreaChartData(department, timeRange = '3months') {
  // Get date range
  const { startDate } = getDateRange(timeRange);

  // Build match stage for aggregation
  const matchStage = {
    office: department,
    status: { $in: ['completed', 'cancelled', 'skipped', 'no-show'] }
  };

  if (startDate) {
    matchStage.queuedAt = { $gte: startDate };
  }

  // Choose aggregation based on time range
  let chartData;
  let aggregationStats;

  if (timeRange === '1month') {
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

    chartData = aggregationStats.map(stat => {
      const date = new Date(stat._id.year, stat._id.month - 1, stat._id.day);
      return {
        date: date.toISOString().split('T')[0],
        month: stat._id.day.toString(),
        day: stat._id.day,
        count: stat.count,
        department
      };
    });
  } else {
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

    chartData = aggregationStats.map(stat => {
      const date = new Date(stat._id.year, stat._id.month - 1, 1);
      return {
        date: date.toISOString().split('T')[0],
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        count: stat.count,
        department
      };
    });
  }

  return {
    success: true,
    data: chartData,
    department,
    timeRange,
    aggregationType: timeRange === '1month' ? 'daily' : 'monthly',
    totalEntries: chartData.length,
    totalQueues: aggregationStats.reduce((sum, stat) => sum + stat.count, 0),
    timestamp: new Date().toISOString()
  };
}

// GET /api/analytics/area-chart/:department - Get time series data for area chart
async function getAreaChartByDepartment(req, res, next) {
  try {
    const { department } = req.params;
    const { timeRange = '3months' } = req.query;
    const result = await getAreaChartData(department, timeRange);
    res.json(result);
  } catch (error) {
    console.error('Error fetching area chart data:', error);
    res.status(500).json({
      error: 'Failed to fetch area chart data',
      message: error.message
    });
  }
}

// Helper function to get dashboard stats (extracted for reuse)
async function getDashboardStatsData(department) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Get today's stats, active windows, and total queues in parallel
  const [todayStats, activeWindows, totalQueues] = await Promise.all([
    Queue.aggregate([
      {
        $match: {
          office: department,
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
    ]),
    Window.countDocuments({
      office: department,
      isOpen: true
    }),
    Queue.countDocuments({
      office: department,
      status: { $in: ['completed', 'cancelled', 'skipped', 'no-show'] }
    })
  ]);

  const stats = todayStats.length > 0 ? todayStats[0] : {
    totalToday: 0,
    completedToday: 0,
    waitingToday: 0,
    servingToday: 0
  };

  return {
    success: true,
    data: {
      ...stats,
      activeWindows,
      totalQueues,
      department,
      lastUpdated: new Date().toISOString()
    }
  };
}

// GET /api/analytics/dashboard-stats/:department - Get dashboard statistics
async function getDashboardStats(req, res, next) {
  try {
    const { department } = req.params;
    const result = await getDashboardStatsData(department);
    res.json(result);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      error: 'Failed to fetch dashboard stats',
      message: error.message
    });
  }
}

// GET /api/analytics/dashboard-table-data/:department - Get dashboard table data
async function getDashboardTableData(req, res, next) {
  try {
    const { department } = req.params;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Get all windows for the department
    const windows = await Window.find({
      office: department, // Use 'office' field in database, value comes from route parameter
      isOpen: true
    }).sort({ name: 1 }).select('_id name').lean();

    if (windows.length === 0) {
      return res.json({
        success: true,
        data: {
          windows: [],
          todayVisits: 0,
          averageTurnaroundTime: '0 mins',
          department,
          lastUpdated: new Date().toISOString()
        }
      });
    }

    const windowIds = windows.map(w => w._id);

    // Single aggregation to get all window queue data at once (eliminates N+1 queries)
    const queueDataByWindow = await Queue.aggregate([
      {
        $match: {
          windowId: { $in: windowIds },
          status: { $in: ['serving', 'waiting'] }
        }
      },
      {
        $group: {
          _id: '$windowId',
          // Get current serving queue (highest queue number with serving status and isCurrentlyServing)
          currentServing: {
            $max: {
              $cond: [
                { $and: [{ $eq: ['$status', 'serving'] }, { $eq: ['$isCurrentlyServing', true] }] },
                '$queueNumber',
                0
              ]
            }
          },
          // Get next waiting queue (lowest queue number with waiting status, sorted by queuedAt)
          nextWaiting: {
            $min: {
              $cond: [
                { $eq: ['$status', 'waiting'] },
                '$queueNumber',
                null
              ]
            }
          },
          // Store queuedAt for proper sorting of waiting queues
          waitingQueues: {
            $push: {
              $cond: [
                { $eq: ['$status', 'waiting'] },
                { queueNumber: '$queueNumber', queuedAt: '$queuedAt' },
                null
              ]
            }
          }
        }
      }
    ]);

    // Create a map for quick lookup
    const queueDataMap = new Map();
    queueDataByWindow.forEach(item => {
      // Filter out null values and sort by queuedAt to get the actual next waiting
      const validWaitingQueues = item.waitingQueues.filter(q => q !== null);
      if (validWaitingQueues.length > 0) {
        validWaitingQueues.sort((a, b) => new Date(a.queuedAt) - new Date(b.queuedAt));
        item.nextWaiting = validWaitingQueues[0].queueNumber;
      }
      queueDataMap.set(item._id.toString(), item);
    });

    // Map windows to their queue data
    const windowData = windows.map(window => {
      const queueData = queueDataMap.get(window._id.toString());
      return {
        windowName: window.name,
        currentServingNumber: queueData?.currentServing || 0,
        incomingNumber: queueData?.nextWaiting || 0
      };
    });

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
    }).select('queuedAt completedAt').lean();

    let averageTurnaroundTime = '0 mins';
    if (completedQueues.length > 0) {
      const totalTurnaroundMs = completedQueues.reduce((total, queue) => {
        const turnaroundMs = new Date(queue.completedAt) - new Date(queue.queuedAt);
        return total + turnaroundMs;
      }, 0);

      const averageTurnaroundMs = totalTurnaroundMs / completedQueues.length;
      const averageTurnaroundMins = Math.round(averageTurnaroundMs / (1000 * 60));

      // Format time in human-readable format
      if (averageTurnaroundMins < 60) {
        // Less than 60 minutes: display as "X mins"
        averageTurnaroundTime = `${averageTurnaroundMins} ${averageTurnaroundMins === 1 ? 'min' : 'mins'}`;
      } else if (averageTurnaroundMins < 1440) {
        // Less than 24 hours: display as "X hrs and Y mins"
        const hours = Math.floor(averageTurnaroundMins / 60);
        const mins = averageTurnaroundMins % 60;
        if (mins === 0) {
          averageTurnaroundTime = `${hours} ${hours === 1 ? 'hr' : 'hrs'}`;
        } else {
          averageTurnaroundTime = `${hours} ${hours === 1 ? 'hr' : 'hrs'} and ${mins} ${mins === 1 ? 'min' : 'mins'}`;
        }
      } else {
        // 24+ hours: display as "X days, Y hrs and Z mins"
        const days = Math.floor(averageTurnaroundMins / 1440);
        const remainingMins = averageTurnaroundMins % 1440;
        const hours = Math.floor(remainingMins / 60);
        const mins = remainingMins % 60;

        let timeStr = `${days} ${days === 1 ? 'day' : 'days'}`;
        if (hours > 0) {
          timeStr += `, ${hours} ${hours === 1 ? 'hr' : 'hrs'}`;
        }
        if (mins > 0) {
          timeStr += ` and ${mins} ${mins === 1 ? 'min' : 'mins'}`;
        }
        averageTurnaroundTime = timeStr;
      }
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
}

// GET /api/analytics/dashboard-complete/:department - Get complete dashboard data in one request
async function getCompleteDashboardData(req, res, next) {
  try {
    const { department } = req.params;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Get all windows for the department
    const windows = await Window.find({
      office: department,
      isOpen: true
    }).sort({ name: 1 }).select('_id name').lean();

    if (windows.length === 0) {
      return res.json({
        success: true,
        data: {
          windows: [],
          stats: {
            totalToday: 0,
            completedToday: 0,
            waitingToday: 0,
            servingToday: 0,
            activeWindows: 0,
            totalQueues: 0
          },
          tableData: {
            windows: [],
            todayVisits: 0,
            averageTurnaroundTime: '0 mins'
          },
          department,
          lastUpdated: new Date().toISOString()
        }
      });
    }

    const windowIds = windows.map(w => w._id);

    // Parallel execution of independent queries
    const [
      todayStatsResult,
      activeWindowsCount,
      totalQueuesCount,
      queueDataByWindow,
      todayVisitsCount,
      completedQueuesForTurnaround
    ] = await Promise.all([
      // Today's stats aggregation
      Queue.aggregate([
        {
          $match: {
            office: department,
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
      ]),
      // Active windows count
      Window.countDocuments({
        office: department,
        isOpen: true
      }),
      // Total historical queues
      Queue.countDocuments({
        office: department,
        status: { $in: ['completed', 'cancelled', 'skipped', 'no-show'] }
      }),
      // Window queue data aggregation (reused from getDashboardTableData)
      Queue.aggregate([
        {
          $match: {
            windowId: { $in: windowIds },
            status: { $in: ['serving', 'waiting'] }
          }
        },
        {
          $group: {
            _id: '$windowId',
            currentServing: {
              $max: {
                $cond: [
                  { $and: [{ $eq: ['$status', 'serving'] }, { $eq: ['$isCurrentlyServing', true] }] },
                  '$queueNumber',
                  0
                ]
              }
            },
            nextWaiting: {
              $min: {
                $cond: [
                  { $eq: ['$status', 'waiting'] },
                  '$queueNumber',
                  null
                ]
              }
            },
            waitingQueues: {
              $push: {
                $cond: [
                  { $eq: ['$status', 'waiting'] },
                  { queueNumber: '$queueNumber', queuedAt: '$queuedAt' },
                  null
                ]
              }
            }
          }
        }
      ]),
      // Today's visits count
      Queue.countDocuments({
        office: department,
        queuedAt: { $gte: today }
      }),
      // Completed queues for turnaround time calculation
      Queue.find({
        office: department,
        status: 'completed',
        queuedAt: { $exists: true },
        completedAt: { $exists: true }
      }).select('queuedAt completedAt').lean()
    ]);

    // Process stats
    const todayStats = todayStatsResult.length > 0 ? todayStatsResult[0] : {
      totalToday: 0,
      completedToday: 0,
      waitingToday: 0,
      servingToday: 0
    };

    // Process window queue data
    const queueDataMap = new Map();
    queueDataByWindow.forEach(item => {
      const validWaitingQueues = item.waitingQueues.filter(q => q !== null);
      if (validWaitingQueues.length > 0) {
        validWaitingQueues.sort((a, b) => new Date(a.queuedAt) - new Date(b.queuedAt));
        item.nextWaiting = validWaitingQueues[0].queueNumber;
      }
      queueDataMap.set(item._id.toString(), item);
    });

    const windowData = windows.map(window => {
      const queueData = queueDataMap.get(window._id.toString());
      return {
        windowName: window.name,
        currentServingNumber: queueData?.currentServing || 0,
        incomingNumber: queueData?.nextWaiting || 0
      };
    });

    // Calculate average turnaround time
    let averageTurnaroundTime = '0 mins';
    if (completedQueuesForTurnaround.length > 0) {
      const totalTurnaroundMs = completedQueuesForTurnaround.reduce((total, queue) => {
        const turnaroundMs = new Date(queue.completedAt) - new Date(queue.queuedAt);
        return total + turnaroundMs;
      }, 0);

      const averageTurnaroundMs = totalTurnaroundMs / completedQueuesForTurnaround.length;
      const averageTurnaroundMins = Math.round(averageTurnaroundMs / (1000 * 60));

      if (averageTurnaroundMins < 60) {
        averageTurnaroundTime = `${averageTurnaroundMins} ${averageTurnaroundMins === 1 ? 'min' : 'mins'}`;
      } else if (averageTurnaroundMins < 1440) {
        const hours = Math.floor(averageTurnaroundMins / 60);
        const mins = averageTurnaroundMins % 60;
        if (mins === 0) {
          averageTurnaroundTime = `${hours} ${hours === 1 ? 'hr' : 'hrs'}`;
        } else {
          averageTurnaroundTime = `${hours} ${hours === 1 ? 'hr' : 'hrs'} and ${mins} ${mins === 1 ? 'min' : 'mins'}`;
        }
      } else {
        const days = Math.floor(averageTurnaroundMins / 1440);
        const remainingMins = averageTurnaroundMins % 1440;
        const hours = Math.floor(remainingMins / 60);
        const mins = remainingMins % 60;

        let timeStr = `${days} ${days === 1 ? 'day' : 'days'}`;
        if (hours > 0) {
          timeStr += `, ${hours} ${hours === 1 ? 'hr' : 'hrs'}`;
        }
        if (mins > 0) {
          timeStr += ` and ${mins} ${mins === 1 ? 'min' : 'mins'}`;
        }
        averageTurnaroundTime = timeStr;
      }
    }

    res.json({
      success: true,
      data: {
        windows: windows.map(w => ({ _id: w._id, name: w.name })),
        stats: {
          ...todayStats,
          activeWindows: activeWindowsCount,
          totalQueues: totalQueuesCount
        },
        tableData: {
          windows: windowData,
          todayVisits: todayVisitsCount,
          averageTurnaroundTime
        },
        department,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching complete dashboard data:', error);
    res.status(500).json({
      error: 'Failed to fetch complete dashboard data',
      message: error.message
    });
  }
}

// GET /api/analytics/queue-monitor/:department - Get queue monitor data for real-time display
async function getQueueMonitor(req, res, next) {
  try {
    const { department } = req.params;

    // Use single aggregation pipeline to get all window data with queue information at once
    // This eliminates N+1 queries (3 queries per window) and replaces with single aggregation
    const windowDataWithQueues = await Window.aggregate([
      // Match all windows for the department
      {
        $match: {
          office: department
        }
      },
      // Sort by name
      {
        $sort: { name: 1 }
      },
      // Lookup current serving queue for each window
      {
        $lookup: {
          from: 'queues',
          let: { windowId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$windowId', '$$windowId'] },
                    { $eq: ['$status', 'serving'] },
                    { $eq: ['$isCurrentlyServing', true] }
                  ]
                }
              }
            },
            {
              $limit: 1
            },
            {
              $project: {
                queueNumber: 1
              }
            }
          ],
          as: 'currentServing'
        }
      },
      // Lookup next waiting queue for each window (for backward compatibility)
      {
        $lookup: {
          from: 'queues',
          let: { windowId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$windowId', '$$windowId'] },
                    { $eq: ['$status', 'waiting'] }
                  ]
                }
              }
            },
            {
              $sort: { queuedAt: 1 }
            },
            {
              $limit: 1
            },
            {
              $project: {
                queueNumber: 1
              }
            }
          ],
          as: 'nextWaiting'
        }
      },
      // Lookup all waiting queues for each window
      {
        $lookup: {
          from: 'queues',
          let: { windowId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$windowId', '$$windowId'] },
                    { $eq: ['$status', 'waiting'] }
                  ]
                }
              }
            },
            {
              $sort: { queuedAt: 1 }
            },
            {
              $project: {
                queueNumber: 1
              }
            }
          ],
          as: 'allWaitingQueues'
        }
      },
      // Project to match expected format
      {
        $project: {
          windowId: { $toString: '$_id' },
          windowName: '$name',
          currentServingNumber: {
            $ifNull: [
              { $arrayElemAt: ['$currentServing.queueNumber', 0] },
              0
            ]
          },
          incomingNumber: {
            $ifNull: [
              { $arrayElemAt: ['$nextWaiting.queueNumber', 0] },
              0
            ]
          },
          incomingQueues: {
            $map: {
              input: '$allWaitingQueues',
              as: 'queue',
              in: '$$queue.queueNumber'
            }
          },
          isServing: '$isServing',
          isOpen: '$isOpen'
        }
      }
    ]);

    // Get recently skipped queues and next overall queue in parallel
    const [skippedQueues, nextOverallQueue] = await Promise.all([
      // Get recently skipped queues (last 10)
      Queue.find({
        office: department,
        status: 'skipped'
      })
        .sort({ skippedAt: -1 })
        .limit(10)
        .select('queueNumber skippedAt')
        .lean(),
      // Get next overall queue number (earliest waiting queue across all windows)
      Queue.findOne({
        office: department,
        status: 'waiting'
      })
        .sort({ queuedAt: 1 })
        .select('queueNumber')
        .lean()
    ]);

    res.json({
      success: true,
      data: {
        windowData: windowDataWithQueues,
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
}

// GET /api/analytics/combined/:department - Get combined data for MIS Super Admin
async function getCombinedAnalytics(req, res, next) {
  try {
    const { department } = req.params;
    const { timeRange = '3months' } = req.query;

    // Call helper functions directly instead of using mock request/response pattern
    // This is more efficient and cleaner
    const [pieChartResponse, areaChartResponse, dashboardStatsResponse] = await Promise.all([
      getPieChartData(department, timeRange),
      getAreaChartData(department, timeRange),
      getDashboardStatsData(department)
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
}

// GET /api/analytics/active-sessions - Get currently active users
async function getActiveSessions(req, res, next) {
  try {
    // Get active sessions from Socket.io session tracking
    const activeSessions = sessionService.getActiveSessions();

    if (activeSessions.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0,
        timestamp: new Date().toISOString()
      });
    }

    // Batch query all users at once (eliminates N+1 queries)
    const userIds = activeSessions.map(s => s.userId);
    const users = await User.find({ _id: { $in: userIds } })
      .select('_id name email role office lastLogin')
      .lean();

    // Create a map for quick lookup
    const userMap = new Map();
    users.forEach(user => {
      userMap.set(user._id.toString(), user);
    });

    // Enrich sessions with user information
    const enrichedSessions = activeSessions
      .map(session => {
        const user = userMap.get(session.userId.toString());
        if (!user) {
          // User not found in database, skip this session
          return null;
        }
        return {
          userId: session.userId,
          name: user.name || 'Unknown',
          email: user.email || 'Unknown',
          role: user.role || 'Unknown',
          office: user.office || 'Unknown',
          sessionCount: session.sessionCount,
          lastActivity: user.lastLogin || new Date()
        };
      })
      .filter(session => session !== null);

    // Filter out null values (users not found in database)
    const validSessions = enrichedSessions;

    // Sort by lastActivity (most recent first)
    validSessions.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));

    res.json({
      success: true,
      data: validSessions,
      count: validSessions.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching active sessions:', error);
    res.status(500).json({
      error: 'Failed to fetch active sessions',
      message: error.message
    });
  }
}

// GET /api/analytics/queue-ratings-summary - Get queue ratings statistics
async function getQueueRatingsSummary(req, res, next) {
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
}

// GET /api/analytics/queue-by-department - Get queue distribution by department
async function getQueueByDepartment(req, res, next) {
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
}

// GET /api/analytics/analytical-report/:role - Get comprehensive analytical report data
async function getAnalyticalReport(req, res, next) {
  try {
    const { role } = req.params;
    const validRoles = ['MIS Super Admin', 'Registrar Admin', 'Admissions Admin'];

    if (!validRoles.includes(role)) {
      return res.status(400).json({
        error: 'Invalid role. Must be MIS Super Admin, Registrar Admin, or Admissions Admin'
      });
    }

    const reportData = {};

    // Extract date range from query parameters
    console.log('📅 Analytical Report - Query Params:', {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      allParams: req.query
    });

    let startDate, endDate;
    if (req.query.startDate && req.query.endDate) {
      // Parse ISO strings with timezone offset (e.g., "2024-10-01T00:00:00+08:00")
      startDate = new Date(req.query.startDate);
      endDate = new Date(req.query.endDate);

      console.log('✅ Using provided date range (Philippine Time):', {
        startDateReceived: req.query.startDate,
        endDateReceived: req.query.endDate,
        startDateParsed: startDate.toISOString(),
        endDateParsed: endDate.toISOString(),
        startDateLocal: startDate.toLocaleString('en-US', { timeZone: 'Asia/Manila' }),
        endDateLocal: endDate.toLocaleString('en-US', { timeZone: 'Asia/Manila' })
      });

      // Validate dates
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({
          error: 'Invalid date format. Please provide valid ISO date strings.'
        });
      }

      if (startDate > endDate) {
        return res.status(400).json({
          error: 'Start date must be before end date.'
        });
      }
    } else {
      // Default to last year if no date range provided (Philippine timezone)
      const now = new Date();
      const phNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));

      endDate = new Date(phNow);
      endDate.setHours(23, 59, 59, 999);

      startDate = new Date(phNow);
      startDate.setFullYear(phNow.getFullYear() - 1);
      startDate.setHours(0, 0, 0, 0);

      console.log('⚠️ No date range provided, using default (last year in Philippine Time):', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        startDateLocal: startDate.toLocaleString('en-US', { timeZone: 'Asia/Manila' }),
        endDateLocal: endDate.toLocaleString('en-US', { timeZone: 'Asia/Manila' })
      });
    }

    // Determine department filter based on role
    const departmentFilter = role === 'Registrar Admin' ? 'registrar' :
                            role === 'Admissions Admin' ? 'admissions' : null;

    if (role === 'MIS Super Admin') {
      // MIS Super Admin: Combined data from both departments

      // 1. Most Visited Office
      console.log('🏢 Most Visited Office Query - Date Range:', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      const departmentStats = await Queue.aggregate([
        { $match: {
          status: { $in: ['completed', 'cancelled', 'skipped', 'no-show'] },
          queuedAt: { $gte: startDate, $lte: endDate }
        } },
        { $group: { _id: '$office', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);

      console.log('📊 Department Stats Result:', JSON.stringify(departmentStats, null, 2));

      reportData.mostVisitedOffice = departmentStats.map(stat => ({
        department: stat._id === 'registrar' ? "Registrar's Office" : 'Admissions Office',
        departmentKey: stat._id,
        count: stat.count
      }));

      // 2. Service Distribution Overall (combined)
      console.log('📋 Service Distribution Query - Date Range:', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      const serviceDistribution = await Queue.aggregate([
        { $match: {
          status: { $in: ['completed', 'cancelled', 'skipped', 'no-show'] },
          queuedAt: { $gte: startDate, $lte: endDate }
        } },
        { $group: { _id: '$serviceId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);

      console.log('📊 Service Distribution Result:', JSON.stringify(serviceDistribution, null, 2));

      const serviceIds = serviceDistribution.map(s => s._id);
      const services = await Service.find({ _id: { $in: serviceIds } }).select('name').lean();
      const serviceMap = services.reduce((map, s) => {
        map[s._id.toString()] = s.name;
        return map;
      }, {});

      reportData.serviceDistribution = serviceDistribution.map(s => ({
        service: serviceMap[s._id] || 'Unknown',
        count: s.count
      }));

      // 3. Kiosk Total Ratings
      console.log('🔍 Rating Query - Date Range:', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        startDateLocal: startDate.toLocaleString('en-US', { timeZone: 'Asia/Manila' }),
        endDateLocal: endDate.toLocaleString('en-US', { timeZone: 'Asia/Manila' })
      });

      // First, let's check total ratings without date filter for comparison
      const totalRatingsCount = await Rating.countDocuments({});
      console.log('📊 Total Ratings in DB (no filter):', totalRatingsCount);

      // Check sample rating documents to verify createdAt field
      const sampleRatings = await Rating.find({}).limit(3).select('rating createdAt');
      console.log('📝 Sample Rating Documents:', JSON.stringify(sampleRatings, null, 2));

      const ratingStats = await Rating.aggregate([
        { $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        } },
        { $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalRatings: { $sum: 1 },
          rating1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
          rating2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
          rating3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
          rating4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
          rating5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } }
        }}
      ]);

      console.log('📈 Rating Stats Result:', JSON.stringify(ratingStats, null, 2));

      reportData.kioskRatings = ratingStats.length > 0 ? ratingStats[0] : {
        averageRating: 0,
        totalRatings: 0,
        rating1: 0,
        rating2: 0,
        rating3: 0,
        rating4: 0,
        rating5: 0
      };

      console.log('✅ Final Kiosk Ratings Data:', reportData.kioskRatings);

      // 4. Total Number of Visitors Overall
      console.log('👥 Total Visitors Query - Date Range:', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      reportData.totalVisitors = await Queue.countDocuments({
        status: { $in: ['completed', 'cancelled', 'skipped', 'no-show'] },
        queuedAt: { $gte: startDate, $lte: endDate }
      });

      console.log('📊 Total Visitors Result:', reportData.totalVisitors);

      // 5. Visitor Breakdown by Role
      console.log('👤 Visitor Breakdown by Role Query - Date Range:', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      const roleBreakdown = await Queue.aggregate([
        { $match: {
          status: { $in: ['completed', 'cancelled', 'skipped', 'no-show'] },
          queuedAt: { $gte: startDate, $lte: endDate }
        } },
        { $group: { _id: '$role', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);

      console.log('📊 Role Breakdown Result:', JSON.stringify(roleBreakdown, null, 2));

      reportData.visitorsByRole = roleBreakdown.map(r => ({
        role: r._id,
        count: r.count
      }));

      // 6. Priority Status Distribution
      console.log('⭐ Priority Visitors Query - Date Range:', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      const priorityStats = await Queue.aggregate([
        { $match: {
          status: { $in: ['completed', 'cancelled', 'skipped', 'no-show'] },
          isPriority: true,
          queuedAt: { $gte: startDate, $lte: endDate }
        }},
        { $lookup: {
          from: 'visitationforms',
          localField: 'visitationFormId',
          foreignField: '_id',
          as: 'visitationForm'
        }},
        { $unwind: { path: '$visitationForm', preserveNullAndEmptyArrays: true } },
        { $group: {
          _id: null,
          totalPriority: { $sum: 1 }
        }}
      ]);

      console.log('📊 Priority Stats Result:', JSON.stringify(priorityStats, null, 2));

      reportData.priorityVisitors = priorityStats.length > 0 ? priorityStats[0].totalPriority : 0;

      console.log('✅ Priority Visitors Count:', reportData.priorityVisitors);

      // 7. Temporal Trends (monthly aggregation for the selected date range)
      const temporalTrends = await Queue.aggregate([
        { $match: {
          status: { $in: ['completed', 'cancelled', 'skipped', 'no-show'] },
          queuedAt: { $gte: startDate, $lte: endDate }
        }},
        { $group: {
          _id: {
            year: { $year: '$queuedAt' },
            month: { $month: '$queuedAt' },
            office: '$office'
          },
          count: { $sum: 1 }
        }},
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);

      reportData.temporalTrends = temporalTrends;

      // 8. Department Comparison Metrics - Parallelize both queries for better performance
      const [registrarStats, admissionsStats] = await Promise.all([
        Queue.aggregate([
          { $match: {
            office: 'registrar',
            status: 'completed',
            queuedAt: { $gte: startDate, $lte: endDate }
          } },
          { $group: {
            _id: null,
            totalCompleted: { $sum: 1 },
            avgTurnaround: {
              $avg: {
                $subtract: ['$completedAt', '$queuedAt']
              }
            }
          }}
        ]),
        Queue.aggregate([
          { $match: {
            office: 'admissions',
            status: 'completed',
            queuedAt: { $gte: startDate, $lte: endDate }
          } },
          { $group: {
            _id: null,
            totalCompleted: { $sum: 1 },
            avgTurnaround: {
              $avg: {
                $subtract: ['$completedAt', '$queuedAt']
              }
            }
          }}
        ])
      ]);

      reportData.departmentComparison = {
        registrar: registrarStats.length > 0 ? {
          totalCompleted: registrarStats[0].totalCompleted,
          avgTurnaroundMinutes: Math.round(registrarStats[0].avgTurnaround / 60000)
        } : { totalCompleted: 0, avgTurnaroundMinutes: 0 },
        admissions: admissionsStats.length > 0 ? {
          totalCompleted: admissionsStats[0].totalCompleted,
          avgTurnaroundMinutes: Math.round(admissionsStats[0].avgTurnaround / 60000)
        } : { totalCompleted: 0, avgTurnaroundMinutes: 0 }
      };

    } else {
      // Registrar/Admissions Admin: Department-specific data
      console.log(`📊 ${role} - Department Filter:`, departmentFilter);
      console.log('📅 Date Range:', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      // 1. Total Visits
      reportData.totalVisits = await Queue.countDocuments({
        office: departmentFilter,
        status: { $in: ['completed', 'cancelled', 'skipped', 'no-show'] },
        queuedAt: { $gte: startDate, $lte: endDate }
      });

      console.log('✅ Total Visits:', reportData.totalVisits);

      // 2. Average Turnaround Time
      const turnaroundStats = await Queue.aggregate([
        { $match: {
          office: departmentFilter,
          status: 'completed',
          completedAt: { $exists: true },
          queuedAt: { $exists: true, $gte: startDate, $lte: endDate }
        }},
        { $group: {
          _id: null,
          avgTurnaround: {
            $avg: {
              $subtract: ['$completedAt', '$queuedAt']
            }
          }
        }}
      ]);

      console.log('⏱️ Turnaround Stats Result:', JSON.stringify(turnaroundStats, null, 2));

      reportData.avgTurnaroundMinutes = turnaroundStats.length > 0 ?
        Math.round(turnaroundStats[0].avgTurnaround / 60000) : 0;

      console.log('✅ Avg Turnaround Minutes:', reportData.avgTurnaroundMinutes);

      // 3. Service Distribution
      const serviceDistribution = await Queue.aggregate([
        { $match: {
          office: departmentFilter,
          status: { $in: ['completed', 'cancelled', 'skipped', 'no-show'] },
          queuedAt: { $gte: startDate, $lte: endDate }
        }},
        { $group: { _id: '$serviceId', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);

      console.log('📋 Service Distribution Result:', JSON.stringify(serviceDistribution, null, 2));

      const serviceIds = serviceDistribution.map(s => s._id);
      const services = await Service.find({ _id: { $in: serviceIds } }).select('name').lean();
      const serviceMap = services.reduce((map, s) => {
        map[s._id.toString()] = s.name;
        return map;
      }, {});

      reportData.serviceDistribution = serviceDistribution.map(s => ({
        service: serviceMap[s._id] || 'Unknown',
        count: s.count
      }));

      console.log('✅ Service Distribution Mapped:', reportData.serviceDistribution);

      // 4. Visitor Breakdown by Role
      const roleBreakdown = await Queue.aggregate([
        { $match: {
          office: departmentFilter,
          status: { $in: ['completed', 'cancelled', 'skipped', 'no-show'] },
          queuedAt: { $gte: startDate, $lte: endDate }
        }},
        { $group: { _id: '$role', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);

      console.log('👤 Role Breakdown Result:', JSON.stringify(roleBreakdown, null, 2));

      reportData.visitorsByRole = roleBreakdown.map(r => ({
        role: r._id,
        count: r.count
      }));

      console.log('✅ Visitors by Role Mapped:', reportData.visitorsByRole);

      // 5. Peak Hours/Days Analysis
      const peakHours = await Queue.aggregate([
        { $match: {
          office: departmentFilter,
          status: { $in: ['completed', 'cancelled', 'skipped', 'no-show'] },
          queuedAt: { $gte: startDate, $lte: endDate }
        }},
        { $group: {
          _id: { $hour: '$queuedAt' },
          count: { $sum: 1 }
        }},
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]);

      console.log('⏰ Peak Hours Result:', JSON.stringify(peakHours, null, 2));

      reportData.peakHours = peakHours.map(h => ({
        hour: h._id,
        count: h.count
      }));

      const peakDays = await Queue.aggregate([
        { $match: {
          office: departmentFilter,
          status: { $in: ['completed', 'cancelled', 'skipped', 'no-show'] },
          queuedAt: { $gte: startDate, $lte: endDate }
        }},
        { $group: {
          _id: { $dayOfWeek: '$queuedAt' },
          count: { $sum: 1 }
        }},
        { $sort: { count: -1 } }
      ]);

      console.log('📅 Peak Days Result:', JSON.stringify(peakDays, null, 2));

      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      reportData.peakDays = peakDays.map(d => ({
        day: dayNames[d._id - 1],
        count: d.count
      }));

      console.log('✅ Peak Hours/Days Mapped:', {
        peakHours: reportData.peakHours,
        peakDays: reportData.peakDays
      });

      // 6. Monthly Trends
      const monthlyTrends = await Queue.aggregate([
        { $match: {
          office: departmentFilter,
          status: { $in: ['completed', 'cancelled', 'skipped', 'no-show'] },
          queuedAt: { $gte: startDate, $lte: endDate }
        }},
        { $group: {
          _id: {
            year: { $year: '$queuedAt' },
            month: { $month: '$queuedAt' }
          },
          count: { $sum: 1 }
        }},
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);

      console.log('📈 Monthly Trends Result:', JSON.stringify(monthlyTrends, null, 2));

      reportData.monthlyTrends = monthlyTrends;

      console.log('✅ Monthly Trends Assigned');

      // 7. Window Performance
      const windowPerformance = await Queue.aggregate([
        { $match: {
          office: departmentFilter,
          status: 'completed',
          queuedAt: { $gte: startDate, $lte: endDate }
        }},
        { $group: {
          _id: '$windowId',
          totalServed: { $sum: 1 },
          avgTurnaround: {
            $avg: {
              $subtract: ['$completedAt', '$queuedAt']
            }
          }
        }},
        { $sort: { totalServed: -1 } }
      ]);

      console.log('🪟 Window Performance Result:', JSON.stringify(windowPerformance, null, 2));

      const windowIds = windowPerformance.map(w => w._id);
      const windows = await Window.find({ _id: { $in: windowIds } }).select('name').lean();
      const windowMap = windows.reduce((map, w) => {
        map[w._id.toString()] = w.name;
        return map;
      }, {});

      reportData.windowPerformance = windowPerformance.map(w => ({
        window: windowMap[w._id] || 'Unknown',
        totalServed: w.totalServed,
        avgTurnaroundMinutes: Math.round(w.avgTurnaround / 60000)
      }));

      console.log('✅ Window Performance Mapped:', reportData.windowPerformance);

      // 8. Monthly Breakdown - Optimized with single aggregation instead of 7+ queries per month
      // Use a single aggregation pipeline to get all monthly metrics at once
      const monthlyMetricsAggregation = await Queue.aggregate([
        {
          $match: {
            office: departmentFilter,
            queuedAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$queuedAt' },
              month: { $month: '$queuedAt' }
            },
            // Total visits (all historical statuses)
            totalVisits: {
              $sum: {
                $cond: [
                  { $in: ['$status', ['completed', 'cancelled', 'skipped', 'no-show']] },
                  1,
                  0
                ]
              }
            },
            // Average turnaround (only completed with timestamps)
            avgTurnaround: {
              $avg: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$status', 'completed'] },
                      { $ifNull: ['$completedAt', false] },
                      { $ifNull: ['$queuedAt', false] }
                    ]
                  },
                  { $subtract: ['$completedAt', '$queuedAt'] },
                  null
                ]
              }
            },
            // Service distribution (array of serviceId and count)
            serviceDistribution: {
              $push: {
                $cond: [
                  { $in: ['$status', ['completed', 'cancelled', 'skipped', 'no-show']] },
                  '$serviceId',
                  '$$REMOVE'
                ]
              }
            },
            // Role breakdown (array of role and count)
            roleBreakdown: {
              $push: {
                $cond: [
                  { $in: ['$status', ['completed', 'cancelled', 'skipped', 'no-show']] },
                  '$role',
                  '$$REMOVE'
                ]
              }
            },
            // Peak hours (array of hour and queuedAt)
            peakHours: {
              $push: {
                $cond: [
                  { $in: ['$status', ['completed', 'cancelled', 'skipped', 'no-show']] },
                  { hour: { $hour: '$queuedAt' }, queuedAt: '$queuedAt' },
                  '$$REMOVE'
                ]
              }
            },
            // Peak days (array of dayOfWeek and queuedAt)
            peakDays: {
              $push: {
                $cond: [
                  { $in: ['$status', ['completed', 'cancelled', 'skipped', 'no-show']] },
                  { dayOfWeek: { $dayOfWeek: '$queuedAt' }, queuedAt: '$queuedAt' },
                  '$$REMOVE'
                ]
              }
            },
            // Window performance (array of windowId, completedAt, queuedAt)
            windowPerformance: {
              $push: {
                $cond: [
                  { $eq: ['$status', 'completed'] },
                  {
                    windowId: '$windowId',
                    completedAt: '$completedAt',
                    queuedAt: '$queuedAt'
                  },
                  '$$REMOVE'
                ]
              }
            }
          }
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1 }
        }
      ]);

      // Process aggregation results and organize by month
      const monthlyBreakdown = [];
      // dayNames is already declared earlier in this function scope

      // Get all unique serviceIds and windowIds for batch fetching
      const allServiceIds = new Set();
      const allWindowIds = new Set();
      monthlyMetricsAggregation.forEach(month => {
        month.serviceDistribution?.forEach(sid => {
          if (sid) allServiceIds.add(sid);
        });
        month.windowPerformance?.forEach(wp => {
          if (wp?.windowId) allWindowIds.add(wp.windowId);
        });
      });

      // Batch fetch all services and windows once
      const [allServices, allWindows] = await Promise.all([
        Service.find({ _id: { $in: Array.from(allServiceIds) } }).select('name').lean(),
        Window.find({ _id: { $in: Array.from(allWindowIds) } }).select('name').lean()
      ]);

      const monthlyServiceMap = new Map();
      allServices.forEach(s => {
        monthlyServiceMap.set(s._id.toString(), s.name);
      });

      const monthlyWindowMap = new Map();
      allWindows.forEach(w => {
        monthlyWindowMap.set(w._id.toString(), w.name);
      });

      // Process each month's data
      for (const monthData of monthlyMetricsAggregation) {
        const year = monthData._id.year;
        const month = monthData._id.month;
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
        const effectiveEnd = monthEnd > endDate ? endDate : monthEnd;
        const effectiveStart = monthStart < startDate ? startDate : monthStart;

        const processedMonth = {
          year,
          month,
          monthName: monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          dateRange: {
            start: effectiveStart.toISOString(),
            end: effectiveEnd.toISOString()
          },
          totalVisits: monthData.totalVisits || 0,
          avgTurnaroundMinutes: monthData.avgTurnaround
            ? Math.round(monthData.avgTurnaround / 60000)
            : 0
        };

        // Process service distribution
        const serviceCounts = new Map();
        monthData.serviceDistribution?.forEach(sid => {
          if (sid) {
            const count = serviceCounts.get(sid.toString()) || 0;
            serviceCounts.set(sid.toString(), count + 1);
          }
        });
        processedMonth.serviceDistribution = Array.from(serviceCounts.entries())
          .map(([sid, count]) => ({
            service: monthlyServiceMap.get(sid) || 'Unknown',
            count
          }))
          .sort((a, b) => b.count - a.count);

        // Process role breakdown
        const roleCounts = new Map();
        monthData.roleBreakdown?.forEach(role => {
          if (role) {
            const count = roleCounts.get(role) || 0;
            roleCounts.set(role, count + 1);
          }
        });
        processedMonth.visitorsByRole = Array.from(roleCounts.entries())
          .map(([role, count]) => ({ role, count }))
          .sort((a, b) => b.count - a.count);

        // Process peak hours
        const hourCounts = new Map();
        monthData.peakHours?.forEach(h => {
          if (h?.hour !== undefined) {
            const count = hourCounts.get(h.hour) || 0;
            hourCounts.set(h.hour, count + 1);
          }
        });
        processedMonth.peakHours = Array.from(hourCounts.entries())
          .map(([hour, count]) => ({ hour: parseInt(hour), count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        // Process peak days
        const dayCounts = new Map();
        monthData.peakDays?.forEach(d => {
          if (d?.dayOfWeek !== undefined) {
            const count = dayCounts.get(d.dayOfWeek) || 0;
            dayCounts.set(d.dayOfWeek, count + 1);
          }
        });
        processedMonth.peakDays = Array.from(dayCounts.entries())
          .map(([dayOfWeek, count]) => ({
            day: dayNames[parseInt(dayOfWeek) - 1],
            count
          }))
          .sort((a, b) => b.count - a.count);

        // Process window performance
        const windowStats = new Map();
        monthData.windowPerformance?.forEach(wp => {
          if (wp?.windowId && wp.completedAt && wp.queuedAt) {
            const wid = wp.windowId.toString();
            const existing = windowStats.get(wid) || { totalServed: 0, totalTurnaround: 0 };
            existing.totalServed += 1;
            existing.totalTurnaround += (new Date(wp.completedAt) - new Date(wp.queuedAt));
            windowStats.set(wid, existing);
          }
        });
        processedMonth.windowPerformance = Array.from(windowStats.entries())
          .map(([wid, stats]) => ({
            window: monthlyWindowMap.get(wid) || 'Unknown',
            totalServed: stats.totalServed,
            avgTurnaroundMinutes: Math.round((stats.totalTurnaround / stats.totalServed) / 60000)
          }))
          .sort((a, b) => b.totalServed - a.totalServed);

        monthlyBreakdown.push(processedMonth);
      }

      reportData.monthlyBreakdown = monthlyBreakdown;
      console.log('✅ Monthly Breakdown Generated:', monthlyBreakdown.length, 'months');
    }

    // Add metadata with Philippine timezone formatting
    const formatPhilippineDate = (date) => {
      return new Date(date).toLocaleDateString('en-US', {
        timeZone: 'Asia/Manila',
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    };

    reportData.metadata = {
      role,
      department: departmentFilter,
      reportPeriod: `${formatPhilippineDate(startDate)} - ${formatPhilippineDate(endDate)}`,
      generatedAt: new Date().toISOString(),
      dateRangeStart: startDate.toISOString(),
      dateRangeEnd: endDate.toISOString()
    };

    res.json({
      success: true,
      data: reportData
    });

  } catch (error) {
    console.error('Error fetching analytical report data:', error);
    res.status(500).json({
      error: 'Failed to fetch analytical report data',
      message: error.message
    });
  }
}

module.exports = {
  getCombinedPieChart,
  getPieChartByDepartment,
  getAreaChartByDepartment,
  getDashboardStats,
  getDashboardTableData,
  getCompleteDashboardData,
  getQueueMonitor,
  getCombinedAnalytics,
  getActiveSessions,
  getQueueRatingsSummary,
  getQueueByDepartment,
  getAnalyticalReport
};

