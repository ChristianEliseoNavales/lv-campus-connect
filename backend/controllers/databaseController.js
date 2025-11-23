const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const { AuditService } = require('../middleware/auditMiddleware');

// Resource type mapping for audit trail (maps model names to valid AuditTrail enum values)
const resourceTypeMap = {
  user: 'User',
  queue: 'Queue',
  visitationform: 'Other', // VisitationForm is not a primary resource, use 'Other'
  window: 'Window',
  service: 'Service',
  settings: 'Settings',
  rating: 'Rating',
  bulletin: 'Bulletin',
  office: 'Other', // Office is not in enum, use 'Other'
  chart: 'Other' // Chart is not in enum, use 'Other'
};

// Helper function to build search query
const buildSearchQuery = (searchTerm, modelName) => {
  if (!searchTerm) return {};

  const searchFields = {
    user: ['name', 'email'],
    queue: ['queueNumber', 'role', 'office'],
    visitationform: ['customerName', 'contactNumber', 'email'],
    window: ['name', 'office'],
    service: ['name', 'office'],
    rating: ['customerName', 'feedback', 'ratingType'],
    bulletin: ['title', 'content', 'category'],
    audittrail: ['action', 'actionDescription', 'resourceType'],
    settings: ['systemName', 'systemVersion']
  };

  const fields = searchFields[modelName] || [];
  if (fields.length === 0) return {};

  return {
    $or: fields.map(field => ({
      [field]: { $regex: searchTerm, $options: 'i' }
    }))
  };
};

// GET /api/database/:model - Get all records for a model with pagination and search
async function getModelRecords(req, res, next) {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const searchTerm = req.query.search || '';
    const skip = (page - 1) * limit;

    // Build search query
    const searchQuery = buildSearchQuery(searchTerm, req.modelName);

    // Get total count
    const totalRecords = await req.Model.countDocuments(searchQuery);
    const totalPages = Math.ceil(totalRecords / limit);

    // Get records with pagination
    let query = req.Model.find(searchQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Populate references for certain models
    if (req.modelName === 'queue') {
      query = query.populate('serviceId windowId visitationFormId');
    } else if (req.modelName === 'window') {
      query = query.populate('serviceIds assignedAdmin');
    }

    const records = await query.exec();

    res.json({
      records,
      totalRecords,
      totalPages,
      currentPage: page,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    });

  } catch (error) {
    console.error(`Error fetching ${req.modelName} records:`, error);
    res.status(500).json({ 
      error: `Failed to fetch ${req.modelName} records`,
      details: error.message 
    });
  }
}

// GET /api/database/:model/:id - Get single record by ID
async function getModelRecordById(req, res, next) {
  try {
    const record = await req.Model.findById(req.params.id);
    
    if (!record) {
      return res.status(404).json({ 
        error: `${req.modelName} record not found` 
      });
    }

    res.json(record);

  } catch (error) {
    console.error(`Error fetching ${req.modelName} record:`, error);
    res.status(500).json({ 
      error: `Failed to fetch ${req.modelName} record`,
      details: error.message 
    });
  }
}

// POST /api/database/:model - Create new record
async function createModelRecord(req, res, next) {
  try {
    // Create new record
    const record = new req.Model(req.body);
    await record.save();

    // Log successful creation
    await AuditService.logCRUD({
      user: req.user,
      action: 'CREATE',
      resourceType: resourceTypeMap[req.modelName] || 'Other',
      resourceId: record._id,
      resourceName: record.name || record.email || record._id.toString(),
      req,
      success: true,
      newValues: record.toObject()
    });

    // Emit Socket.io event for bulletin creation
    if (req.modelName === 'bulletin') {
      const io = req.app.get('io');
      io.to('kiosk').emit('bulletin-updated', {
        type: 'bulletin-created',
        data: record
      });
      console.log('📡 Bulletin created event emitted to kiosk');
    }

    res.status(201).json(record);

  } catch (error) {
    console.error(`Error creating ${req.modelName} record:`, error);

    // Log failed creation
    await AuditService.logCRUD({
      user: req.user,
      action: 'CREATE',
      resourceType: resourceTypeMap[req.modelName] || 'Other',
      resourceName: req.body.name || req.body.email || 'Unknown',
      req,
      success: false,
      errorMessage: error.message
    });

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));

      return res.status(400).json({
        error: 'Validation failed',
        details: validationErrors
      });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        error: `Duplicate ${field}. This ${field} already exists.`
      });
    }

    res.status(500).json({
      error: `Failed to create ${req.modelName} record`,
      details: error.message
    });
  }
}

// PUT /api/database/:model/:id - Update record by ID
async function updateModelRecord(req, res, next) {
  try {
    // Get old record for audit trail
    const oldRecord = await req.Model.findById(req.params.id);
    if (!oldRecord) {
      await AuditService.logCRUD({
        user: req.user,
        action: 'UPDATE',
        resourceType: resourceTypeMap[req.modelName] || 'Other',
        resourceId: req.params.id,
        req,
        success: false,
        errorMessage: `${req.modelName} record not found`
      });

      return res.status(404).json({
        error: `${req.modelName} record not found`
      });
    }

    const record = await req.Model.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );

    // Log successful update
    await AuditService.logCRUD({
      user: req.user,
      action: 'UPDATE',
      resourceType: resourceTypeMap[req.modelName] || 'Other',
      resourceId: record._id,
      resourceName: record.name || record.email || record._id.toString(),
      req,
      success: true,
      oldValues: oldRecord.toObject(),
      newValues: record.toObject()
    });

    // Emit Socket.io event for bulletin update
    if (req.modelName === 'bulletin') {
      const io = req.app.get('io');
      io.to('kiosk').emit('bulletin-updated', {
        type: 'bulletin-updated',
        data: record
      });
      console.log('📡 Bulletin updated event emitted to kiosk');
    }

    res.json(record);

  } catch (error) {
    console.error(`Error updating ${req.modelName} record:`, error);

    // Log failed update
    await AuditService.logCRUD({
      user: req.user,
      action: 'UPDATE',
      resourceType: resourceTypeMap[req.modelName] || 'Other',
      resourceId: req.params.id,
      req,
      success: false,
      errorMessage: error.message
    });

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));

      return res.status(400).json({
        error: 'Validation failed',
        details: validationErrors
      });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        error: `Duplicate ${field}. This ${field} already exists.`
      });
    }

    res.status(500).json({
      error: `Failed to update ${req.modelName} record`,
      details: error.message
    });
  }
}

// DELETE /api/database/:model/delete-all - Delete all records for a model
async function deleteAllModelRecords(req, res, next) {
  try {
    console.log(`🗑️ DELETE ALL request for ${req.modelName}`);

    // If deleting all users, get user IDs before deletion to emit force-logout
    let userIdsToLogout = [];
    if (req.modelName === 'user') {
      const users = await req.Model.find({}).select('_id');
      userIdsToLogout = users.map(u => u._id.toString());
    }

    const result = await req.Model.deleteMany({});
    console.log(`✅ Successfully deleted ${result.deletedCount} ${req.modelName} records`);

    // Emit force-logout events for all deleted users
    if (req.modelName === 'user' && userIdsToLogout.length > 0) {
      const emitForceLogout = req.app.get('emitForceLogout');
      if (emitForceLogout) {
        userIdsToLogout.forEach(userId => {
          emitForceLogout(userId, 'Your account has been deleted. Please contact your administrator.');
        });
        console.log(`🚪 Force logout emitted for ${userIdsToLogout.length} deleted user(s)`);
      }
    }

    // Log bulk deletion
    await AuditService.logCRUD({
      user: req.user,
      action: 'DELETE',
      resourceType: resourceTypeMap[req.modelName] || 'Other',
      resourceName: `All ${req.modelName} records`,
      req,
      success: true,
      metadata: { deletedCount: result.deletedCount }
    });

    res.json({
      message: `All ${req.modelName} records deleted successfully`,
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error(`❌ Error deleting all ${req.modelName} records:`, error);

    // Log failed bulk deletion
    await AuditService.logCRUD({
      user: req.user,
      action: 'DELETE',
      resourceType: resourceTypeMap[req.modelName] || 'Other',
      resourceName: `All ${req.modelName} records`,
      req,
      success: false,
      errorMessage: error.message
    });

    res.status(500).json({
      error: `Failed to delete all ${req.modelName} records`,
      details: error.message
    });
  }
}

// DELETE /api/database/:model/:id - Delete single record by ID
async function deleteModelRecord(req, res, next) {
  try {
    console.log(`🗑️ DELETE request for ${req.modelName} with ID: ${req.params.id}`);

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.log(`❌ Invalid ObjectId format: ${req.params.id}`);

      await AuditService.logCRUD({
        user: req.user,
        action: 'DELETE',
        resourceType: resourceTypeMap[req.modelName] || 'Other',
        resourceId: req.params.id,
        req,
        success: false,
        errorMessage: `Invalid ID format for ${req.modelName} record`
      });

      return res.status(400).json({
        error: `Invalid ID format for ${req.modelName} record`
      });
    }

    const record = await req.Model.findByIdAndDelete(req.params.id);
    console.log(`🔍 Delete result for ${req.modelName}:`, record ? 'Found and deleted' : 'Not found');

    if (!record) {
      await AuditService.logCRUD({
        user: req.user,
        action: 'DELETE',
        resourceType: resourceTypeMap[req.modelName] || 'Other',
        resourceId: req.params.id,
        req,
        success: false,
        errorMessage: `${req.modelName} record not found`
      });

      return res.status(404).json({
        error: `${req.modelName} record not found`
      });
    }

    // Emit force-logout event if user is being deleted
    if (req.modelName === 'user') {
      const emitForceLogout = req.app.get('emitForceLogout');
      if (emitForceLogout) {
        // Convert user ID to string to match session tracking
        const userId = record._id.toString();
        emitForceLogout(userId, 'Your account has been deleted. Please contact your administrator.');
        console.log(`🚪 Force logout emitted for deleted user: ${userId}`);
      }
    }

    // Log successful deletion
    await AuditService.logCRUD({
      user: req.user,
      action: 'DELETE',
      resourceType: resourceTypeMap[req.modelName] || 'Other',
      resourceId: record._id,
      resourceName: record.name || record.email || record._id.toString(),
      req,
      success: true,
      oldValues: record.toObject()
    });

    // Emit Socket.io event for bulletin deletion
    if (req.modelName === 'bulletin') {
      const io = req.app.get('io');
      io.to('kiosk').emit('bulletin-updated', {
        type: 'bulletin-deleted',
        data: {
          id: record._id
        }
      });
      console.log('📡 Bulletin deleted event emitted to kiosk');
    }

    console.log(`✅ Successfully deleted ${req.modelName} record with ID: ${req.params.id}`);
    res.json({
      message: `${req.modelName} record deleted successfully`,
      deletedRecord: record
    });

  } catch (error) {
    console.error(`❌ Error deleting ${req.modelName} record:`, error);

    // Log failed deletion
    await AuditService.logCRUD({
      user: req.user,
      action: 'DELETE',
      resourceType: resourceTypeMap[req.modelName] || 'Other',
      resourceId: req.params.id,
      req,
      success: false,
      errorMessage: error.message
    });

    res.status(500).json({
      error: `Failed to delete ${req.modelName} record`,
      details: error.message
    });
  }
}

module.exports = {
  getModelRecords,
  getModelRecordById,
  createModelRecord,
  updateModelRecord,
  deleteAllModelRecords,
  deleteModelRecord
};


