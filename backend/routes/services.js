const express = require('express');
const { Service } = require('../models');
const { verifyToken, requireRole, checkApiAccess } = require('../middleware/authMiddleware');
const { AuditService } = require('../middleware/auditMiddleware');
const router = express.Router();

// GET /api/services - Get all services
router.get('/', verifyToken, checkApiAccess, async (req, res) => {
  try {
    const services = await Service.find().sort({ office: 1, name: 1 });
    res.json(services.map(service => ({
      id: service._id,
      name: service.name,
      office: service.office,
      isActive: service.isActive,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt
    })));
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/services/:department - Get services by office (department param for backward compatibility)
router.get('/:department', verifyToken, checkApiAccess, async (req, res) => {
  try {
    const { department } = req.params;

    // Validate office
    if (!['registrar', 'admissions'].includes(department)) {
      return res.status(400).json({ error: 'Invalid office' });
    }

    const services = await Service.find({ office: department }).sort({ name: 1 });
    res.json(services.map(service => ({
      id: service._id,
      name: service.name,
      office: service.office,
      isActive: service.isActive,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt
    })));
  } catch (error) {
    console.error('Error fetching office services:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/services/:department/active - Get active services by office (department param for backward compatibility)
router.get('/:department/active', verifyToken, checkApiAccess, async (req, res) => {
  try {
    const { department } = req.params;

    // Validate office
    if (!['registrar', 'admissions'].includes(department)) {
      return res.status(400).json({ error: 'Invalid office' });
    }

    const services = await Service.find({
      office: department,
      isActive: true
    }).sort({ name: 1 });

    res.json(services.map(service => ({
      id: service._id,
      name: service.name,
      office: service.office,
      isActive: service.isActive
    })));
  } catch (error) {
    console.error('Error fetching active services:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/services - Create new service
router.post('/', verifyToken, checkApiAccess, async (req, res) => {
  try {
    const { name, office } = req.body;

    if (!name || !office) {
      return res.status(400).json({ error: 'Name and office are required' });
    }

    // Validate office
    if (!['registrar', 'admissions'].includes(office)) {
      return res.status(400).json({ error: 'Invalid office' });
    }

    // Check if service name already exists in the office
    const existingService = await Service.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      office
    });

    if (existingService) {
      return res.status(409).json({ error: 'Service with this name already exists in the office' });
    }

    const newService = new Service({
      name: name.trim(),
      office,
      isActive: true
    });

    await newService.save();

    // Log successful service creation
    await AuditService.logCRUD({
      user: req.user,
      action: 'CREATE',
      resourceType: 'Service',
      resourceId: newService._id,
      resourceName: newService.name,
      department: office,
      req,
      success: true,
      newValues: {
        name: newService.name,
        office: newService.office,
        isActive: newService.isActive
      }
    });

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`admin-${office}`).emit('services-updated', {
      type: 'service-added',
      department: office, // Keep 'department' for backward compatibility with frontend
      data: {
        id: newService._id,
        name: newService.name,
        office: newService.office,
        isActive: newService.isActive
      }
    });

    res.status(201).json({
      id: newService._id,
      name: newService.name,
      office: newService.office,
      isActive: newService.isActive,
      createdAt: newService.createdAt,
      updatedAt: newService.updatedAt
    });
  } catch (error) {
    console.error('Error creating service:', error);

    await AuditService.logCRUD({
      user: req.user,
      action: 'CREATE',
      resourceType: 'Service',
      resourceId: null,
      resourceName: req.body.name || 'Unknown',
      department: req.body.office || 'unknown',
      req,
      success: false,
      errorMessage: error.message
    });

    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/services/:id/toggle - Toggle service active status
router.patch('/:id/toggle', verifyToken, checkApiAccess, async (req, res) => {
  try {
    const { id } = req.params;

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Track old value for audit logging
    const oldIsActive = service.isActive;

    // Toggle the isActive status
    service.isActive = !service.isActive;
    await service.save();

    // Log successful service toggle
    await AuditService.logCRUD({
      user: req.user,
      action: 'UPDATE',
      resourceType: 'Service',
      resourceId: service._id,
      resourceName: service.name,
      department: service.office,
      req,
      success: true,
      oldValues: { isActive: oldIsActive },
      newValues: { isActive: service.isActive }
    });

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`admin-${service.office}`).emit('services-updated', {
      type: 'service-toggled',
      department: service.office, // Keep 'department' for backward compatibility with frontend
      data: {
        id: service._id,
        name: service.name,
        isActive: service.isActive
      }
    });

    res.json({
      id: service._id,
      name: service.name,
      office: service.office,
      isActive: service.isActive,
      updatedAt: service.updatedAt
    });
  } catch (error) {
    console.error('Error toggling service:', error);

    await AuditService.logCRUD({
      user: req.user,
      action: 'UPDATE',
      resourceType: 'Service',
      resourceId: req.params.id,
      resourceName: 'Unknown',
      department: 'unknown',
      req,
      success: false,
      errorMessage: error.message
    });

    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/services/:id - Delete service
router.delete('/:id', verifyToken, checkApiAccess, async (req, res) => {
  try {
    const { id } = req.params;

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const deletedService = {
      id: service._id,
      name: service.name,
      office: service.office
    };

    await Service.findByIdAndDelete(id);

    // Log successful service deletion
    await AuditService.logCRUD({
      user: req.user,
      action: 'DELETE',
      resourceType: 'Service',
      resourceId: deletedService.id,
      resourceName: deletedService.name,
      department: deletedService.office,
      req,
      success: true,
      oldValues: {
        name: deletedService.name,
        office: deletedService.office
      }
    });

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`admin-${deletedService.office}`).emit('services-updated', {
      type: 'service-deleted',
      department: deletedService.office, // Keep 'department' for backward compatibility with frontend
      data: { id: deletedService.id }
    });

    res.json({
      message: 'Service deleted successfully',
      service: deletedService
    });
  } catch (error) {
    console.error('Error deleting service:', error);

    await AuditService.logCRUD({
      user: req.user,
      action: 'DELETE',
      resourceType: 'Service',
      resourceId: req.params.id,
      resourceName: 'Unknown',
      department: 'unknown',
      req,
      success: false,
      errorMessage: error.message
    });

    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
