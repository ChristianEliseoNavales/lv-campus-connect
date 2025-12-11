const express = require('express');
const router = express.Router();
const { verifyToken, checkApiAccess } = require('../middleware/authMiddleware');
const analyticsController = require('../controllers/analyticsController');
const asyncHandler = require('../middleware/asyncHandler');

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
  const validRanges = ['year', '6months', '3months', '1month', 'all'];
  if (timeRange && !validRanges.includes(timeRange)) {
    return res.status(400).json({
      error: 'Invalid time range. Must be one of: year, 6months, 3months, 1month, all'
    });
  }
  next();
};

// GET /api/analytics/pie-chart/combined - Get combined service distribution for MIS Super Admin
router.get('/pie-chart/combined', verifyToken, checkApiAccess, asyncHandler(analyticsController.getCombinedPieChart));

// GET /api/analytics/pie-chart/:department - Get service distribution for pie chart
router.get('/pie-chart/:department', verifyToken, checkApiAccess, validateDepartment, asyncHandler(analyticsController.getPieChartByDepartment));

// GET /api/analytics/area-chart/:department - Get time series data for area chart
router.get('/area-chart/:department', verifyToken, checkApiAccess, validateDepartment, validateTimeRange, asyncHandler(analyticsController.getAreaChartByDepartment));

// GET /api/analytics/dashboard-stats/:department - Get dashboard statistics
router.get('/dashboard-stats/:department', verifyToken, checkApiAccess, validateDepartment, asyncHandler(analyticsController.getDashboardStats));

// GET /api/analytics/dashboard-table-data/:department - Get dashboard table data
router.get('/dashboard-table-data/:department', verifyToken, checkApiAccess, validateDepartment, asyncHandler(analyticsController.getDashboardTableData));

// GET /api/analytics/dashboard-complete/:department - Get complete dashboard data in one request
router.get('/dashboard-complete/:department', verifyToken, checkApiAccess, validateDepartment, asyncHandler(analyticsController.getCompleteDashboardData));

// GET /api/analytics/queue-monitor/:department - Get queue monitor data for real-time display
router.get('/queue-monitor/:department', verifyToken, checkApiAccess, validateDepartment, asyncHandler(analyticsController.getQueueMonitor));

// GET /api/analytics/combined/:department - Get combined data for MIS Super Admin
router.get('/combined/:department', verifyToken, checkApiAccess, validateDepartment, validateTimeRange, asyncHandler(analyticsController.getCombinedAnalytics));

// GET /api/analytics/active-sessions - Get currently active users
router.get('/active-sessions', verifyToken, checkApiAccess, asyncHandler(analyticsController.getActiveSessions));

// GET /api/analytics/queue-ratings-summary - Get queue ratings statistics
router.get('/queue-ratings-summary', verifyToken, checkApiAccess, asyncHandler(analyticsController.getQueueRatingsSummary));

// GET /api/analytics/queue-by-department - Get queue distribution by department
router.get('/queue-by-department', verifyToken, checkApiAccess, asyncHandler(analyticsController.getQueueByDepartment));

// GET /api/analytics/analytical-report/:role - Get comprehensive analytical report data
router.get('/analytical-report/:role', verifyToken, checkApiAccess, asyncHandler(analyticsController.getAnalyticalReport));

module.exports = router;
