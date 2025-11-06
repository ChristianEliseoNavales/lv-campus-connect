const express = require('express');
const { Service } = require('../models');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const router = express.Router();

// GET /api/services - Get all services
router.get('/', verifyToken, requireRole(['MIS Super Admin', 'MIS Admin', 'Registrar Admin', 'Registrar Admin Staff', 'Admissions Admin', 'Admissions Admin Staff']), async (req, res) => {
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
router.get('/:department', verifyToken, requireRole(['MIS Super Admin', 'MIS Admin', 'Registrar Admin', 'Registrar Admin Staff', 'Admissions Admin', 'Admissions Admin Staff']), async (req, res) => {
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
router.get('/:department/active', verifyToken, requireRole(['MIS Super Admin', 'MIS Admin', 'Registrar Admin', 'Registrar Admin Staff', 'Admissions Admin', 'Admissions Admin Staff']), async (req, res) => {
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
router.post('/', verifyToken, requireRole(['MIS Super Admin', 'Registrar Admin', 'Admissions Admin']), async (req, res) => {
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
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/services/:id/toggle - Toggle service active status
router.patch('/:id/toggle', verifyToken, requireRole(['MIS Super Admin', 'Registrar Admin', 'Admissions Admin']), async (req, res) => {
  try {
    const { id } = req.params;

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Toggle the isActive status
    service.isActive = !service.isActive;
    await service.save();

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
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/services/:id - Delete service
router.delete('/:id', verifyToken, requireRole(['MIS Super Admin', 'Registrar Admin', 'Admissions Admin']), async (req, res) => {
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
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
