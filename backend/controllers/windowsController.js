const { Window, Service, User } = require('../models');
const { AuditService } = require('../middleware/auditMiddleware');
const { CacheHelper } = require('../utils/cache');

// GET /api/windows - Get all windows
async function getAllWindows(req, res, next) {
  try {
    const windows = await Window.find()
      .populate('serviceIds', 'name')
      .populate('assignedAdmin', 'name email')
      .sort({ office: 1, name: 1 })
      .lean();

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
}

// GET /api/windows/:department - Get windows by office (department param for backward compatibility)
async function getWindowsByDepartment(req, res, next) {
  try {
    const { department } = req.params;

    // Validate office
    if (!['registrar', 'admissions'].includes(department)) {
      return res.status(400).json({ error: 'Invalid office' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Check if pagination is requested
    const usePagination = req.query.page !== undefined || req.query.limit !== undefined;

    let query = Window.find({ office: department })
      .populate('serviceIds', 'name')
      .populate('assignedAdmin', 'name email')
      .sort({ name: 1 });

    if (usePagination) {
      query = query.skip(skip).limit(limit);
    }

    const windows = await query.lean();
    const windowsData = windows.map(window => ({
      id: window._id,
      name: window.name,
      office: window.office,
      serviceIds: window.serviceIds,
      assignedAdmin: window.assignedAdmin,
      isOpen: window.isOpen,
      currentQueue: window.currentQueue,
      createdAt: window.createdAt,
      updatedAt: window.updatedAt
    }));

    if (usePagination) {
      const total = await Window.countDocuments({ office: department });
      res.json({
        data: windowsData,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } else {
      // Backward compatibility: return all windows if no pagination params
      if (process.env.NODE_ENV === 'development') {
        console.warn(`⚠️  GET /api/windows/${department} called without pagination. Consider using ?page=1&limit=50 for better performance.`);
      }
      res.json(windowsData);
    }
  } catch (error) {
    console.error('Error fetching office windows:', error);
    res.status(500).json({ error: error.message });
  }
}

// POST /api/windows - Create new window
async function createWindow(req, res, next) {
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

    // Update user's assignedWindows field and pageAccess if assignedAdmin is set
    if (assignedAdmin && adminUser) {
      console.log(`\n🔧 Assigning window "${newWindow.name}" (${newWindow._id}) to user ${adminUser.email}`);

      // Add window to assignedWindows array (support multiple windows)
      const currentAssignedWindows = adminUser.assignedWindows || [];
      console.log(`   Current assignedWindows:`, currentAssignedWindows.map(w => w.toString()));

      if (!currentAssignedWindows.some(w => w.toString() === newWindow._id.toString())) {
        await User.findByIdAndUpdate(assignedAdmin, {
          $addToSet: { assignedWindows: newWindow._id },
          assignedWindow: newWindow._id // Keep for backward compatibility
        });
        console.log(`   ✅ Added window ${newWindow._id} to assignedWindows array`);

        // Fetch updated user to verify
        const updatedUser = await User.findById(assignedAdmin).select('assignedWindows');
        console.log(`   Updated assignedWindows:`, updatedUser.assignedWindows.map(w => w.toString()));
      } else {
        console.log(`   ⚠️ Window ${newWindow._id} already in assignedWindows, skipping`);
      }

      // For Admin Staff roles, also update pageAccess to include the specific queue route
      if (adminUser.role && adminUser.role.includes('Admin Staff')) {
        const queueRoute = `/admin/${office}/queue/${newWindow._id}`;

        // Add the queue route to pageAccess if not already present
        if (!adminUser.pageAccess || !adminUser.pageAccess.includes(queueRoute)) {
          const updatedPageAccess = [...(adminUser.pageAccess || []), queueRoute];
          await User.findByIdAndUpdate(assignedAdmin, { pageAccess: updatedPageAccess });
          console.log(`   ✅ Added queue route ${queueRoute} to Admin Staff user ${adminUser.email}`);
        }
      }
    }

    // Populate the window for response
    await newWindow.populate('serviceIds', 'name');
    await newWindow.populate('assignedAdmin', 'name email');

    // Log successful window creation
    await AuditService.logCRUD({
      user: req.user,
      action: 'CREATE',
      resourceType: 'Window',
      resourceId: newWindow._id,
      resourceName: newWindow.name,
      department: office,
      req,
      success: true,
      newValues: {
        name: newWindow.name,
        office: newWindow.office,
        serviceIds: newWindow.serviceIds.map(s => s.name || s),
        assignedAdmin: newWindow.assignedAdmin?.email || null,
        isOpen: newWindow.isOpen
      }
    });

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

    // Emit user-specific event if assigned admin exists
    if (assignedAdmin) {
      io.emit('user-window-assignment-changed', {
        userId: assignedAdmin.toString(),
        type: 'window-assigned',
        windowId: newWindow._id.toString(),
        windowName: newWindow.name
      });
    }

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

    await AuditService.logCRUD({
      user: req.user,
      action: 'CREATE',
      resourceType: 'Window',
      resourceId: null,
      resourceName: req.body.name || 'Unknown',
      department: req.body.office || 'unknown',
      req,
      success: false,
      errorMessage: error.message
    });

    res.status(500).json({ error: error.message });
  }
}

// PUT /api/windows/:id - Update window
async function updateWindow(req, res, next) {
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

    // Track old values for audit logging
    const oldValues = {
      name: window.name,
      serviceIds: window.serviceIds,
      assignedAdmin: window.assignedAdmin
    };
    const oldAssignedAdmin = window.assignedAdmin;

    // Invalidate cache for this window's office before updating
    CacheHelper.invalidateWindows(window.office);

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

    // Update user's assignedWindows field and pageAccess if assignedAdmin changed
    if (assignedAdmin !== undefined) {
      const queueRoute = `/admin/${window.office}/queue/${id}`;

      // Remove window from old admin's assignedWindows if exists
      if (oldAssignedAdmin && oldAssignedAdmin.toString() !== (assignedAdmin || '').toString()) {
        const oldAdmin = await User.findById(oldAssignedAdmin);
        if (oldAdmin) {
          // Remove from assignedWindows array
          await User.findByIdAndUpdate(oldAssignedAdmin, {
            $pull: { assignedWindows: id }
          });

          // Update assignedWindow to the first remaining window or null
          const updatedOldAdmin = await User.findById(oldAssignedAdmin).populate('assignedWindows');
          const newAssignedWindow = updatedOldAdmin.assignedWindows && updatedOldAdmin.assignedWindows.length > 0
            ? updatedOldAdmin.assignedWindows[0]._id
            : null;
          await User.findByIdAndUpdate(oldAssignedAdmin, { assignedWindow: newAssignedWindow });

          // For Admin Staff, also remove the queue route from pageAccess
          if (oldAdmin.role && oldAdmin.role.includes('Admin Staff')) {
            const updatedPageAccess = (oldAdmin.pageAccess || []).filter(route => route !== queueRoute);
            await User.findByIdAndUpdate(oldAssignedAdmin, { pageAccess: updatedPageAccess });
            console.log(`✅ Removed queue route ${queueRoute} from Admin Staff user ${oldAdmin.email}`);
          }
        }
      }

      // Add window to new admin's assignedWindows if exists
      if (assignedAdmin) {
        const newAdmin = await User.findById(assignedAdmin);
        if (newAdmin) {
          // Add to assignedWindows array (support multiple windows)
          await User.findByIdAndUpdate(assignedAdmin, {
            $addToSet: { assignedWindows: id },
            assignedWindow: id // Keep for backward compatibility
          });

          // For Admin Staff, also add the queue route to pageAccess
          if (newAdmin.role && newAdmin.role.includes('Admin Staff')) {
            if (!newAdmin.pageAccess || !newAdmin.pageAccess.includes(queueRoute)) {
              const updatedPageAccess = [...(newAdmin.pageAccess || []), queueRoute];
              await User.findByIdAndUpdate(assignedAdmin, { pageAccess: updatedPageAccess });
              console.log(`   ✅ Added queue route ${queueRoute} to Admin Staff user ${newAdmin.email}`);
            }
          }
        }
      }
    }

    // Populate the window for response
    await window.populate('serviceIds', 'name');
    await window.populate('assignedAdmin', 'name email');

    // Log successful window update
    await AuditService.logCRUD({
      user: req.user,
      action: 'UPDATE',
      resourceType: 'Window',
      resourceId: window._id,
      resourceName: window.name,
      department: window.office,
      req,
      success: true,
      oldValues: {
        name: oldValues.name,
        serviceIds: oldValues.serviceIds,
        assignedAdmin: oldValues.assignedAdmin
      },
      newValues: {
        name: window.name,
        serviceIds: window.serviceIds.map(s => s.name || s),
        assignedAdmin: window.assignedAdmin?.email || null
      }
    });

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

    // Emit user-specific event if assigned admin changed
    if (assignedAdmin !== undefined) {
      // Notify old admin if exists
      if (oldAssignedAdmin && oldAssignedAdmin.toString() !== (assignedAdmin || '').toString()) {
        io.emit('user-window-assignment-changed', {
          userId: oldAssignedAdmin.toString(),
          type: 'window-unassigned',
          windowId: null,
          windowName: null
        });
      }

      // Notify new admin if exists
      if (assignedAdmin) {
        const socketPayload = {
          userId: assignedAdmin.toString(),
          type: 'window-assigned',
          windowId: window._id.toString(),
          windowName: window.name
        };
        console.log(`\n📡 Emitting user-window-assignment-changed event:`, socketPayload);
        io.emit('user-window-assignment-changed', socketPayload);
      }
    }

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

    await AuditService.logCRUD({
      user: req.user,
      action: 'UPDATE',
      resourceType: 'Window',
      resourceId: req.params.id,
      resourceName: req.body.name || 'Unknown',
      department: 'unknown',
      req,
      success: false,
      errorMessage: error.message
    });

    res.status(500).json({ error: error.message });
  }
}

// PATCH /api/windows/:id/toggle - Toggle window open status
async function toggleWindow(req, res, next) {
  try {
    const { id } = req.params;

    const window = await Window.findById(id);
    if (!window) {
      return res.status(404).json({ error: 'Window not found' });
    }

    // Track old value for audit logging
    const oldIsOpen = window.isOpen;

    // Invalidate cache for this window's office before toggling
    CacheHelper.invalidateWindows(window.office);

    // Toggle the isOpen status
    window.isOpen = !window.isOpen;
    await window.save();

    // Log successful window toggle
    await AuditService.logCRUD({
      user: req.user,
      action: 'UPDATE',
      resourceType: 'Window',
      resourceId: window._id,
      resourceName: window.name,
      department: window.office,
      req,
      success: true,
      oldValues: { isOpen: oldIsOpen },
      newValues: { isOpen: window.isOpen }
    });

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

    await AuditService.logCRUD({
      user: req.user,
      action: 'UPDATE',
      resourceType: 'Window',
      resourceId: req.params.id,
      resourceName: 'Unknown',
      department: 'unknown',
      req,
      success: false,
      errorMessage: error.message
    });

    res.status(500).json({ error: error.message });
  }
}

// DELETE /api/windows/:id - Delete window
async function deleteWindow(req, res, next) {
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

    // Invalidate cache for this window's office before deleting
    CacheHelper.invalidateWindows(window.office);

    // Remove window from assignedWindows and queue route from user if window had an assigned admin
    if (window.assignedAdmin) {
      const admin = await User.findById(window.assignedAdmin);
      if (admin) {
        // Remove from assignedWindows array
        await User.findByIdAndUpdate(window.assignedAdmin, {
          $pull: { assignedWindows: id }
        });

        // Update assignedWindow to the first remaining window or null
        const updatedAdmin = await User.findById(window.assignedAdmin).populate('assignedWindows');
        const newAssignedWindow = updatedAdmin.assignedWindows && updatedAdmin.assignedWindows.length > 0
          ? updatedAdmin.assignedWindows[0]._id
          : null;
        await User.findByIdAndUpdate(window.assignedAdmin, { assignedWindow: newAssignedWindow });

        // For Admin Staff, also remove the queue route from pageAccess
        if (admin.role && admin.role.includes('Admin Staff')) {
          const queueRoute = `/admin/${window.office}/queue/${id}`;
          const updatedPageAccess = (admin.pageAccess || []).filter(route => route !== queueRoute);
          await User.findByIdAndUpdate(window.assignedAdmin, { pageAccess: updatedPageAccess });
          console.log(`✅ Removed queue route ${queueRoute} from Admin Staff user ${admin.email}`);
        }
      }
    }

    await Window.findByIdAndDelete(id);

    // Log successful window deletion
    await AuditService.logCRUD({
      user: req.user,
      action: 'DELETE',
      resourceType: 'Window',
      resourceId: deletedWindow.id,
      resourceName: deletedWindow.name,
      department: deletedWindow.office,
      req,
      success: true,
      oldValues: {
        name: deletedWindow.name,
        office: deletedWindow.office,
        assignedAdmin: deletedWindow.assignedAdmin
      }
    });

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`admin-${deletedWindow.office}`).emit('windows-updated', {
      type: 'window-deleted',
      department: deletedWindow.office, // Keep 'department' for backward compatibility with frontend
      data: { id: deletedWindow.id }
    });

    // Emit user-specific event if window had assigned admin
    if (deletedWindow.assignedAdmin) {
      io.emit('user-window-assignment-changed', {
        userId: deletedWindow.assignedAdmin.toString(),
        type: 'window-unassigned',
        windowId: null,
        windowName: null
      });
    }

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

    await AuditService.logCRUD({
      user: req.user,
      action: 'DELETE',
      resourceType: 'Window',
      resourceId: req.params.id,
      resourceName: 'Unknown',
      department: 'unknown',
      req,
      success: false,
      errorMessage: error.message
    });

    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  getAllWindows,
  getWindowsByDepartment,
  createWindow,
  updateWindow,
  toggleWindow,
  deleteWindow
};


