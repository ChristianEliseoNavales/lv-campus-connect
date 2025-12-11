const express = require('express');
const router = express.Router();
const { query } = require('express-validator');
const { verifyToken, requireSuperAdmin, checkApiAccess } = require('../middleware/authMiddleware');
const databaseController = require('../controllers/databaseController');
const asyncHandler = require('../middleware/asyncHandler');

// Import all models for getModel middleware
const {
  User,
  Queue,
  VisitationForm,
  Window,
  Service,
  Settings,
  Rating,
  Bulletin,
  AuditTrail,
  Office,
  Chart,
  DocumentRequest
} = require('../models');

// Model mapping for dynamic access (used by getModel middleware)
const modelMap = {
  user: User,
  queue: Queue,
  visitationform: VisitationForm,
  window: Window,
  service: Service,
  settings: Settings,
  rating: Rating,
  bulletin: Bulletin,
  audittrail: AuditTrail,
  office: Office,
  chart: Chart,
  documentrequest: DocumentRequest
};

// Middleware to get model from params
const getModel = (req, res, next) => {
  const modelName = req.params.model?.toLowerCase();
  const Model = modelMap[modelName];

  if (!Model) {
    return res.status(400).json({
      error: `Invalid model: ${modelName}. Available models: ${Object.keys(modelMap).join(', ')}`
    });
  }

  req.Model = Model;
  req.modelName = modelName;
  next();
};

// GET /api/database/:model - Get all records for a model with pagination and search
router.get('/:model',
  verifyToken,
  checkApiAccess,
  getModel,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('search').optional().isString().withMessage('Search must be a string')
  ],
  asyncHandler(databaseController.getModelRecords)
);

// GET /api/database/:model/:id - Get single record by ID
router.get('/:model/:id',
  verifyToken,
  checkApiAccess,
  getModel,
  asyncHandler(databaseController.getModelRecordById)
);

// POST /api/database/:model - Create new record
router.post('/:model',
  verifyToken,
  checkApiAccess,
  getModel,
  asyncHandler(databaseController.createModelRecord)
);

// PUT /api/database/:model/:id - Update record by ID
router.put('/:model/:id',
  verifyToken,
  checkApiAccess,
  getModel,
  asyncHandler(databaseController.updateModelRecord)
);

// DELETE /api/database/:model/delete-all - Delete all records for a model (MUST BE BEFORE /:model/:id)
router.delete('/:model/delete-all',
  verifyToken,
  checkApiAccess,
  getModel,
  asyncHandler(databaseController.deleteAllModelRecords)
);

// DELETE /api/database/:model/:id - Delete single record by ID
router.delete('/:model/:id',
  verifyToken,
  checkApiAccess,
  getModel,
  asyncHandler(databaseController.deleteModelRecord)
);

module.exports = router;
