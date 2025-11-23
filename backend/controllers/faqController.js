const { validationResult } = require('express-validator');
const FAQ = require('../models/FAQ');
const { AuditService } = require('../middleware/auditMiddleware');

// Helper function to emit FAQ updates to both admin and kiosk rooms
const emitFAQUpdate = (io, eventData) => {
  if (!io) return;
  try {
    // Emit to both rooms with the same data
    io.to('admin-shared-faq').emit('faq-updated', eventData);
    io.to('kiosk').emit('faq-updated', eventData);
  } catch (socketError) {
    console.error('Socket.io emit error:', socketError);
  }
};

// GET /api/faq - Get all FAQs (with optional filtering)
async function getFAQs(req, res, next) {
  try {
    const { status, search } = req.query;

    let query = {};

    // Office-based filtering:
    // - MIS users see ALL FAQs
    // - Other offices only see FAQs from their office
    const userOffice = req.user.office;
    if (userOffice !== 'MIS') {
      query.office = userOffice;
    }

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { question: { $regex: search, $options: 'i' } },
        { answer: { $regex: search, $options: 'i' } }
      ];
    }

    const faqs = await FAQ.find(query)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort({ office: 1, order: 1, createdAt: -1 });

    res.json({
      success: true,
      count: faqs.length,
      data: faqs
    });
  } catch (error) {
    console.error('Error fetching FAQs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch FAQs',
      message: error.message
    });
  }
}

// GET /api/faq/:id - Get single FAQ by ID
async function getFAQById(req, res, next) {
  try {
    const faq = await FAQ.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');
    
    if (!faq) {
      return res.status(404).json({
        success: false,
        error: 'FAQ not found'
      });
    }
    
    res.json({
      success: true,
      data: faq
    });
  } catch (error) {
    console.error('Error fetching FAQ:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch FAQ',
      message: error.message
    });
  }
}

// POST /api/faq - Create new FAQ
async function createFAQ(req, res, next) {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await AuditService.logCRUD({
        user: req.user,
        action: 'CREATE',
        resourceType: 'FAQ',
        resourceName: req.body.question?.substring(0, 50) || 'New FAQ',
        req,
        success: false,
        errorMessage: 'Validation failed'
      });

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const faqData = {
      ...req.body,
      createdBy: req.user.id || req.user._id
    };

    const faq = new FAQ(faqData);
    await faq.save();

    // Populate creator info
    await faq.populate('createdBy', 'name email');

    // Log successful creation
    await AuditService.logCRUD({
      user: req.user,
      action: 'CREATE',
      resourceType: 'FAQ',
      resourceId: faq._id,
      resourceName: faq.question.substring(0, 50),
      req,
      success: true,
      newValues: faq.toObject()
    });

    // Emit Socket.io event for real-time updates
    const io = req.app.get('io');
    emitFAQUpdate(io, {
      type: 'faq-created',
      data: faq
    });

    res.status(201).json({
      success: true,
      message: 'FAQ created successfully',
      data: faq
    });
  } catch (error) {
    console.error('Error creating FAQ:', error);
    
    await AuditService.logCRUD({
      user: req.user,
      action: 'CREATE',
      resourceType: 'FAQ',
      resourceName: req.body.question?.substring(0, 50) || 'New FAQ',
      req,
      success: false,
      errorMessage: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Failed to create FAQ',
      message: error.message
    });
  }
}

// PUT /api/faq/:id - Update FAQ
async function updateFAQ(req, res, next) {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await AuditService.logCRUD({
        user: req.user,
        action: 'UPDATE',
        resourceType: 'FAQ',
        resourceId: req.params.id,
        req,
        success: false,
        errorMessage: 'Validation failed'
      });

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    // Get old FAQ for audit trail
    const oldFAQ = await FAQ.findById(req.params.id);
    if (!oldFAQ) {
      await AuditService.logCRUD({
        user: req.user,
        action: 'UPDATE',
        resourceType: 'FAQ',
        resourceId: req.params.id,
        req,
        success: false,
        errorMessage: 'FAQ not found'
      });

      return res.status(404).json({
        success: false,
        error: 'FAQ not found'
      });
    }

    const updateData = {
      ...req.body,
      updatedBy: req.user.id || req.user._id
    };

    const faq = await FAQ.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    // Log successful update
    await AuditService.logCRUD({
      user: req.user,
      action: 'UPDATE',
      resourceType: 'FAQ',
      resourceId: faq._id,
      resourceName: faq.question.substring(0, 50),
      req,
      success: true,
      oldValues: oldFAQ.toObject(),
      newValues: faq.toObject()
    });

    // Emit Socket.io event for real-time updates
    const io = req.app.get('io');
    emitFAQUpdate(io, {
      type: 'faq-updated',
      data: faq
    });

    res.json({
      success: true,
      message: 'FAQ updated successfully',
      data: faq
    });
  } catch (error) {
    console.error('Error updating FAQ:', error);

    await AuditService.logCRUD({
      user: req.user,
      action: 'UPDATE',
      resourceType: 'FAQ',
      resourceId: req.params.id,
      req,
      success: false,
      errorMessage: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Failed to update FAQ',
      message: error.message
    });
  }
}

// DELETE /api/faq/:id - Delete FAQ
async function deleteFAQ(req, res, next) {
  try {
    const faq = await FAQ.findById(req.params.id);

    if (!faq) {
      await AuditService.logCRUD({
        user: req.user,
        action: 'DELETE',
        resourceType: 'FAQ',
        resourceId: req.params.id,
        req,
        success: false,
        errorMessage: 'FAQ not found'
      });

      return res.status(404).json({
        success: false,
        error: 'FAQ not found'
      });
    }

    const faqData = faq.toObject();
    await FAQ.findByIdAndDelete(req.params.id);

    // Log successful deletion
    await AuditService.logCRUD({
      user: req.user,
      action: 'DELETE',
      resourceType: 'FAQ',
      resourceId: req.params.id,
      resourceName: faqData.question.substring(0, 50),
      req,
      success: true,
      oldValues: faqData
    });

    // Emit Socket.io event for real-time updates
    const io = req.app.get('io');
    emitFAQUpdate(io, {
      type: 'faq-deleted',
      data: { id: req.params.id }
    });

    res.json({
      success: true,
      message: 'FAQ deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting FAQ:', error);

    await AuditService.logCRUD({
      user: req.user,
      action: 'DELETE',
      resourceType: 'FAQ',
      resourceId: req.params.id,
      req,
      success: false,
      errorMessage: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Failed to delete FAQ',
      message: error.message
    });
  }
}

module.exports = {
  getFAQs,
  getFAQById,
  createFAQ,
  updateFAQ,
  deleteFAQ
};



