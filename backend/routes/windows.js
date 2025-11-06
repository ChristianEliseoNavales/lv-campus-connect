const express = require('express');
const { Window, Service, User } = require('../models');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const router = express.Router();

// GET /api/windows - Get all windows
router.get('/', verifyToken, requireRole(['MIS Super Admin', 'MIS Admin', 'Registrar Admin', 'Registrar Admin Staff', 'Admissions Admin', 'Admissions Admin Staff']), async (req, res) => {
  try {
    const windows = await Window.find()
      .populate('serviceIds', 'name')
      .populate('assignedAdmin', 'name email')
      .sort({ office: 1, name: 1 });

    res.json(windows.map(window => ({
      id: window._id,
      name: window.name,
      office: window.office,
      serviceIds: window.serviceIds,
      assignedAdmin: window.assignedAdmin,
      isOpen: window.isOpen,
      currentQueue: window.currentQueue,
      createdAt: window.createdAt,
      updatedAt: window.updatedAt
    })));
  } catch (error) {
    console.error('Error fetching windows:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/windows/:department - Get windows by office (department param for backward compatibility)
router.get('/:department', verifyToken, requireRole(['MIS Super Admin', 'MIS Admin', 'Registrar Admin', 'Registrar Admin Staff', 'Admissions Admin', 'Admissions Admin Staff']), async (req, res) => {
  try {
    const { department } = req.params;

    // Validate office
    if (!['registrar', 'admissions'].includes(department)) {
      return res.status(400).json({ error: 'Invalid office' });
    }

    const windows = await Window.find({ office: department })
      .populate('serviceIds', 'name')
      .populate('assignedAdmin', 'name email')
      .sort({ name: 1 });

    res.json(windows.map(window => ({
      id: window._id,
      name: window.name,
      office: window.office,
      serviceIds: window.serviceIds,
      assignedAdmin: window.assignedAdmin,
      isOpen: window.isOpen,
      currentQueue: window.currentQueue,
      createdAt: window.createdAt,
      updatedAt: window.updatedAt
    })));
  } catch (error) {
    console.error('Error fetching office windows:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/windows - Create new window
router.post('/', verifyToken, requireRole(['MIS Super Admin', 'Registrar Admin', 'Admissions Admin']), async (req, res) => {
  try {
    const { name, office, serviceIds, assignedAdmin } = req.body;

    if (!name || !office || !serviceIds || !Array.isArray(serviceIds) || serviceIds.length === 0) {
      return res.status(400).json({
        error: 'Name, office, and at least one serviceId are required'
      });
    }

    // Validate office
    if (!['registrar', 'admissions'].includes(office)) {
      return res.status(400).json({ error: 'Invalid office' });
    }

    // Check if all services exist and belong to the same office
    const services = await Service.find({ _id: { $in: serviceIds } });
    if (services.length !== serviceIds.length) {
      return res.status(404).json({ error: 'One or more services not found' });
    }

    // Check if all services belong to the same office
    const invalidServices = services.filter(service => service.office !== office);
    if (invalidServices.length > 0) {
      return res.status(400).json({ error: 'All services must belong to the same office as the window' });
    }

    // Check for duplicate window names in the office (case-insensitive)
    const existingWindow = await Window.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      office
    });

    if (existingWindow) {
      return res.status(409).json({ error: 'Window with this name already exists in the office' });
    }

    // Validate assigned admin if provided
    let adminUser = null;
    if (assignedAdmin) {
      adminUser = await User.findById(assignedAdmin);
      if (!adminUser) {
        return res.status(404).json({ error: 'Assigned admin not found' });
      }
    }

    const newWindow = new Window({
      name: name.trim(),
      office,
      serviceIds,
      assignedAdmin: assignedAdmin || null,
      isOpen: false
    });

    await newWindow.save();

    // Update user's assignedWindow field if assignedAdmin is set
    if (assignedAdmin) {
      await User.findByIdAndUpdate(assignedAdmin, { assignedWindow: newWindow._id });
    }

    // Populate the window for response
    await newWindow.populate('serviceIds', 'name');
    await newWindow.populate('assignedAdmin', 'name email');

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`admin-${office}`).emit('windows-updated', {
      type: 'window-added',
      department: office, // Keep 'department' for backward compatibility with frontend
      data: {
        id: newWindow._id,
        name: newWindow.name,
        office: newWindow.office,
        serviceIds: newWindow.serviceIds,
        assignedAdmin: newWindow.assignedAdmin,
        isOpen: newWindow.isOpen
      }
    });

    // Also emit service visibility update since window assignments changed
    io.to('kiosk').emit('services-updated', {
      type: 'visibility-changed',
      department: office // Keep 'department' for backward compatibility with frontend
    });

    res.status(201).json({
      id: newWindow._id,
      name: newWindow.name,
      office: newWindow.office,
      serviceIds: newWindow.serviceIds,
      assignedAdmin: newWindow.assignedAdmin,
      isOpen: newWindow.isOpen,
      currentQueue: newWindow.currentQueue,
      createdAt: newWindow.createdAt,
      updatedAt: newWindow.updatedAt
    });
  } catch (error) {
    console.error('Error creating window:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/windows/:id - Update window
router.put('/:id', verifyToken, requireRole(['MIS Super Admin', 'Registrar Admin', 'Admissions Admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, serviceIds, assignedAdmin } = req.body;

    const window = await Window.findById(id);
    if (!window) {
      return res.status(404).json({ error: 'Window not found' });
    }

    // Check for duplicate window names in the office (case-insensitive)
    if (name && name.trim() !== window.name) {
      const existingWindow = await Window.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
        office: window.office,
        _id: { $ne: id }
      });

      if (existingWindow) {
        return res.status(409).json({ error: 'Window with this name already exists in the office' });
      }
    }

    // Validate services if provided
    if (serviceIds) {
      if (!Array.isArray(serviceIds)) {
        return res.status(400).json({ error: 'serviceIds must be an array' });
      }

      if (serviceIds.length > 0) {
        const services = await Service.find({ _id: { $in: serviceIds } });
        if (services.length !== serviceIds.length) {
          return res.status(404).json({ error: 'One or more services not found' });
        }

        const invalidServices = services.filter(service => service.office !== window.office);
        if (invalidServices.length > 0) {
          return res.status(400).json({ error: 'All services must belong to the same office as the window' });
        }
      }
    }

    // Track old assigned admin for cleanup
    const oldAssignedAdmin = window.assignedAdmin;

    // Validate assigned admin if provided
    if (assignedAdmin) {
      const adminUser = await User.findById(assignedAdmin);
      if (!adminUser) {
        return res.status(404).json({ error: 'Assigned admin not found' });
      }
    }

    // Update window data
    if (name) window.name = name.trim();
    if (serviceIds !== undefined) window.serviceIds = serviceIds;
    if (assignedAdmin !== undefined) window.assignedAdmin = assignedAdmin || null;

    await window.save();

    // Update user's assignedWindow field if assignedAdmin changed
    if (assignedAdmin !== undefined) {
      // Remove assignedWindow from old admin if exists
      if (oldAssignedAdmin && oldAssignedAdmin.toString() !== (assignedAdmin || '').toString()) {
        await User.findByIdAndUpdate(oldAssignedAdmin, { assignedWindow: null });
      }

      // Set assignedWindow for new admin if exists
      if (assignedAdmin) {
        await User.findByIdAndUpdate(assignedAdmin, { assignedWindow: id });
      }
    }

    // Populate the window for response
    await window.populate('serviceIds', 'name');
    await window.populate('assignedAdmin', 'name email');

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`admin-${window.office}`).emit('windows-updated', {
      type: 'window-updated',
      department: window.office, // Keep 'department' for backward compatibility with frontend
      data: {
        id: window._id,
        name: window.name,
        serviceIds: window.serviceIds,
        assignedAdmin: window.assignedAdmin,
        isOpen: window.isOpen
      }
    });

    // Also emit service visibility update since window assignments may have changed
    io.to('kiosk').emit('services-updated', {
      type: 'visibility-changed',
      department: window.office // Keep 'department' for backward compatibility with frontend
    });

    res.json({
      id: window._id,
      name: window.name,
      office: window.office,
      serviceIds: window.serviceIds,
      assignedAdmin: window.assignedAdmin,
      isOpen: window.isOpen,
      currentQueue: window.currentQueue,
      createdAt: window.createdAt,
      updatedAt: window.updatedAt
    });
  } catch (error) {
    console.error('Error updating window:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/windows/:id/toggle - Toggle window open status
router.patch('/:id/toggle', verifyToken, requireRole(['MIS Super Admin', 'Registrar Admin', 'Registrar Admin Staff', 'Admissions Admin', 'Admissions Admin Staff']), async (req, res) => {
  try {
    const { id } = req.params;

    const window = await Window.findById(id);
    if (!window) {
      return res.status(404).json({ error: 'Window not found' });
    }

    // Toggle the isOpen status
    window.isOpen = !window.isOpen;
    await window.save();

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`admin-${window.office}`).emit('windows-updated', {
      type: 'window-toggled',
      department: window.office, // Keep 'department' for backward compatibility with frontend
      data: {
        id: window._id,
        name: window.name,
        isOpen: window.isOpen
      }
    });

    // Also emit service visibility update since window visibility changed
    io.to('kiosk').emit('services-updated', {
      type: 'visibility-changed',
      department: window.office // Keep 'department' for backward compatibility with frontend
    });

    res.json({
      id: window._id,
      name: window.name,
      office: window.office,
      isOpen: window.isOpen,
      updatedAt: window.updatedAt
    });
  } catch (error) {
    console.error('Error toggling window:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/windows/:id - Delete window
router.delete('/:id', verifyToken, requireRole(['MIS Super Admin', 'Registrar Admin', 'Admissions Admin']), async (req, res) => {
  try {
    const { id } = req.params;

    const window = await Window.findById(id);
    if (!window) {
      return res.status(404).json({ error: 'Window not found' });
    }

    const deletedWindow = {
      id: window._id,
      name: window.name,
      office: window.office,
      assignedAdmin: window.assignedAdmin
    };

    // Remove assignedWindow from user if window had an assigned admin
    if (window.assignedAdmin) {
      await User.findByIdAndUpdate(window.assignedAdmin, { assignedWindow: null });
    }

    await Window.findByIdAndDelete(id);

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`admin-${deletedWindow.office}`).emit('windows-updated', {
      type: 'window-deleted',
      department: deletedWindow.office, // Keep 'department' for backward compatibility with frontend
      data: { id: deletedWindow.id }
    });

    // Also emit service visibility update since window was deleted
    io.to('kiosk').emit('services-updated', {
      type: 'visibility-changed',
      department: deletedWindow.office // Keep 'department' for backward compatibility with frontend
    });

    res.json({
      message: 'Window deleted successfully',
      window: deletedWindow
    });
  } catch (error) {
    console.error('Error deleting window:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
