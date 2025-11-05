const express = require('express');
const mongoose = require('mongoose');
const { Queue, VisitationForm, Service, Window, Settings, Rating } = require('../models');
const { AuditService } = require('../middleware/auditMiddleware');
const router = express.Router();

// GET /api/public/queue/:department - Get queue data for department
router.get('/queue/:department', async (req, res) => {
  try {
    const { department } = req.params;

    // Check if department queue system is enabled
    const settings = await Settings.getCurrentSettings();
    if (!settings?.officeSettings?.[department]?.isEnabled) {
      return res.json({
        isEnabled: false,
        message: `${department.charAt(0).toUpperCase() + department.slice(1)} office is currently closed`,
        currentNumber: 0,
        queue: [],
        windows: [],
        department,
        timestamp: new Date().toISOString()
      });
    }

    // Get department windows that are open
    const departmentWindows = await Window.find({
      office: department,
      isOpen: true
    }).populate('serviceIds', 'name');

    // Get department queues
    const departmentQueues = await Queue.find({
      office: department,
      status: 'waiting'
    }).sort({ queuedAt: 1 });

    // Calculate current serving numbers for each window
    const windowsWithCurrentNumbers = await Promise.all(
      departmentWindows.map(async (window) => {
        // Get current serving queue for this window
        const currentServing = await Queue.findOne({
          windowId: window._id.toString(),
          status: 'serving',
          isCurrentlyServing: true
        });

        return {
          id: window._id,
          name: window.name,
          department: window.office, // Keep 'department' key for backward compatibility with frontend
          serviceName: window.serviceIds && window.serviceIds.length > 0
            ? window.serviceIds.map(s => s.name).join(', ')
            : 'No services assigned',
          isOpen: window.isOpen,
          currentQueueNumber: currentServing ? currentServing.queueNumber : 0,
          nextQueueNumber: departmentQueues.find(q => q.windowId === window._id.toString())?.queueNumber || 0
        };
      })
    );

    res.json({
      isEnabled: true,
      currentNumber: Math.max(...windowsWithCurrentNumbers.map(w => w.currentNumber), 0),
      nextNumber: Math.min(...departmentQueues.map(q => q.queueNumber), 999),
      queue: departmentQueues.slice(0, 5), // Return first 5 in queue
      windows: windowsWithCurrentNumbers,
      department,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching queue data:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/public/services/:department - Get visible services for department
router.get('/services/:department', async (req, res) => {
  try {
    const { department } = req.params;

    // Check if department queue system is enabled
    const settings = await Settings.getCurrentSettings();
    if (!settings?.officeSettings?.[department]?.isEnabled) {
      return res.json({
        isEnabled: false,
        services: [],
        message: `${department.charAt(0).toUpperCase() + department.slice(1)} office is currently closed`
      });
    }

    // Get visible services based on window assignments and window visibility
    // A service is visible if:
    // 1. It's assigned to at least one window
    // 2. At least one of those windows has isOpen = true
    const visibleServices = await Window.getVisibleServices(department);

    res.json({
      isEnabled: true,
      services: visibleServices.map(service => ({
        id: service._id,
        name: service.name,
        department: service.office, // Keep 'department' key for backward compatibility with frontend
        category: service.category,
        description: service.description,
        estimatedProcessingTime: service.estimatedProcessingTime
      })),
      department,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/public/office-status/:department - Check if office is open
router.get('/office-status/:department', async (req, res) => {
  try {
    const { department } = req.params;
    const settings = await Settings.getCurrentSettings();

    const isEnabled = settings?.officeSettings?.[department]?.isEnabled || false;

    res.json({
      department,
      isEnabled,
      message: isEnabled
        ? `${department.charAt(0).toUpperCase() + department.slice(1)} office is open`
        : `${department.charAt(0).toUpperCase() + department.slice(1)} office is currently closed`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error checking office status:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/public/windows/:department - Get active windows for department
router.get('/windows/:department', async (req, res) => {
  try {
    const { department } = req.params;

    const windows = await Window.find({
      office: department,
      isOpen: true // Changed from isActive to isOpen to match Window model
    }).populate('serviceIds', 'name category');

    res.json({
      windows: windows.map(window => ({
        id: window._id,
        name: window.name,
        windowNumber: window.windowNumber,
        department: window.office, // Keep 'department' key for backward compatibility with frontend
        serviceIds: window.serviceIds, // Changed from serviceId to serviceIds array
        isOpen: window.isOpen
      })),
      department,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching windows:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/public/queue - Submit new queue entry
router.post('/queue', async (req, res) => {
  try {
    const {
      office, // Changed from 'department' to 'office' to match frontend and database schema
      service,
      role,
      studentStatus,
      isPriority,
      idNumber,
      customerName,
      contactNumber,
      email,
      address
    } = req.body;

    console.log('🚀 [BACKEND] Queue submission received for service:', service);
    console.log('📋 [BACKEND] Full request body:', JSON.stringify(req.body, null, 2));
    console.log('📋 [BACKEND] Request headers:', JSON.stringify(req.headers, null, 2));

    // Special logging for Enroll service
    if (service === 'Enroll') {
      console.log('🎓 [BACKEND] ENROLL SERVICE DETECTED!');
      console.log('🎓 [BACKEND] Student Status:', studentStatus);
      console.log('🎓 [BACKEND] Customer Name:', customerName);
      console.log('🎓 [BACKEND] Contact Number:', contactNumber);
      console.log('🎓 [BACKEND] Email:', email);
      console.log('🎓 [BACKEND] Address:', address);
    }

    // Validate required fields - special handling for Enroll service
    console.log('🔍 [BACKEND] Validating required fields...');
    console.log('🔍 [BACKEND] Field check:', {
      office: !!office,
      service: !!service,
      role: !!role,
      customerName: !!customerName,
      contactNumber: !!contactNumber,
      email: !!email
    });

    // For Enroll service, only validate core fields (not visitation form fields)
    if (service === 'Enroll') {
      console.log('🎓 [BACKEND] ENROLL SERVICE - Using relaxed validation (no form fields required)');
      if (!office || !service || !role) {
        console.log('❌ [BACKEND] ENROLL VALIDATION FAILED - Missing core fields!');
        console.log('❌ [BACKEND] Missing fields:', {
          office: !office ? 'MISSING' : 'OK',
          service: !service ? 'MISSING' : 'OK',
          role: !role ? 'MISSING' : 'OK'
        });
        return res.status(400).json({
          error: 'Missing required fields for Enroll service',
          required: ['office', 'service', 'role']
        });
      }
      console.log('✅ [BACKEND] Enroll service core fields validated');
    } else {
      // For all other services, require full visitation form fields
      console.log('📋 [BACKEND] REGULAR SERVICE - Using full validation (form fields required)');
      if (!office || !service || !role || !customerName || !contactNumber || !email) {
        console.log('❌ [BACKEND] VALIDATION FAILED - Missing required fields!');
        console.log('❌ [BACKEND] Missing fields:', {
          office: !office ? 'MISSING' : 'OK',
          service: !service ? 'MISSING' : 'OK',
          role: !role ? 'MISSING' : 'OK',
          customerName: !customerName ? 'MISSING' : 'OK',
          contactNumber: !contactNumber ? 'MISSING' : 'OK',
          email: !email ? 'MISSING' : 'OK'
        });
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['office', 'service', 'role', 'customerName', 'contactNumber', 'email']
        });
      }
      console.log('✅ [BACKEND] All required fields present for regular service');
    }

    // Validate office
    if (!['registrar', 'admissions'].includes(office)) {
      return res.status(400).json({
        error: 'Invalid office. Must be "registrar" or "admissions"'
      });
    }

    // Validate role
    if (!['Visitor', 'Student', 'Teacher', 'Alumni'].includes(role)) {
      return res.status(400).json({
        error: 'Invalid role. Must be one of: Visitor, Student, Teacher, Alumni'
      });
    }

    // Validate studentStatus for Enroll service
    if (service === 'Enroll' && (!studentStatus || !['incoming_new', 'continuing'].includes(studentStatus))) {
      return res.status(400).json({
        error: 'studentStatus is required for Enroll service and must be either "incoming_new" or "continuing"'
      });
    }

    // Check if office queue system is enabled
    const settings = await Settings.getCurrentSettings();
    if (!settings?.officeSettings?.[office]?.isEnabled) {
      return res.status(503).json({
        error: `${office.charAt(0).toUpperCase() + office.slice(1)} office is currently closed`
      });
    }

    // Find service by name
    const serviceObj = await Service.findOne({
      name: service,
      office: office,
      isActive: true
    });

    if (!serviceObj) {
      return res.status(404).json({
        error: 'Service not found or not available'
      });
    }

    console.log('🔍 Found service:', serviceObj.name, serviceObj._id);

    // Find window assigned to this queue
    let assignedWindow;

    // Priority queues ALWAYS go to the Priority Window
    if (isPriority) {
      console.log('⭐ Priority queue detected - assigning to Priority Window');
      assignedWindow = await Window.findOne({
        office: office,
        isOpen: true,
        name: 'Priority'
      }).populate('serviceIds', 'name');

      if (!assignedWindow) {
        console.error('❌ Priority Window not found or not open');
        return res.status(503).json({
          error: 'Priority Window is currently unavailable'
        });
      }
      console.log('✅ Assigned to Priority Window:', assignedWindow.name);
    } else {
      // Non-priority queues use service-based window assignment
      // IMPORTANT: Exclude Priority Window from non-priority queue assignment
      // Priority Window should ONLY receive queues with isPriority=true
      assignedWindow = await Window.findOne({
        office: office,
        isOpen: true,
        serviceIds: serviceObj._id,
        name: { $ne: 'Priority' } // Exclude Priority Window
      }).populate('serviceIds', 'name');

      if (!assignedWindow) {
        console.error('❌ No window assigned to service:', serviceObj.name);
        return res.status(503).json({
          error: 'Service is currently unavailable - no window assigned'
        });
      }
      console.log('🪟 Assigned to window:', assignedWindow.name);
    }

    // Create visitation form - skip for Enroll service
    let visitationForm = null;

    if (service === 'Enroll') {
      console.log('🎓 [BACKEND] ENROLL SERVICE - Skipping VisitationForm creation');
      console.log('🎓 [BACKEND] Enroll service does not require visitation form data');
    } else {
      console.log('📝 [BACKEND] Creating VisitationForm with data:', {
        customerName,
        contactNumber,
        email,
        address: address || '',
        idNumber: isPriority ? (idNumber || '') : ''
      });

      visitationForm = await VisitationForm.createForm({
        customerName,
        contactNumber,
        email,
        address: address || '',
        idNumber: isPriority ? (idNumber || '') : ''
      });

      console.log('✅ [BACKEND] VisitationForm created successfully:', visitationForm._id);
      console.log('✅ [BACKEND] VisitationForm data:', JSON.stringify(visitationForm, null, 2));
    }

    // Get next queue number
    const nextQueueNumber = await Queue.getNextQueueNumber(office);

    console.log('🔢 Next queue number:', nextQueueNumber);

    // Create queue entry with proper data types
    const queueData = {
      queueNumber: nextQueueNumber,
      office: office,
      serviceId: serviceObj._id.toString(), // Store service ObjectId as string for compatibility
      windowId: assignedWindow._id.toString(), // Store window ObjectId as string for compatibility
      role,
      studentStatus: service === 'Enroll' ? studentStatus : undefined,
      isPriority: Boolean(isPriority)
    };

    // Only add visitationFormId if visitationForm was created (not for Enroll service)
    if (visitationForm) {
      queueData.visitationFormId = visitationForm._id;
      console.log('📋 [BACKEND] Including visitationFormId in queue entry:', visitationForm._id);
    } else {
      console.log('🎓 [BACKEND] No visitationFormId for Enroll service - creating queue without form reference');
    }

    const queueEntry = new Queue(queueData);

    // Save to MongoDB
    console.log('💾 [BACKEND] Saving Queue entry to MongoDB...');
    console.log('💾 [BACKEND] Queue entry data before save:', JSON.stringify(queueEntry, null, 2));

    await queueEntry.save();

    console.log('✅ [BACKEND] Queue entry saved successfully to MongoDB!');
    console.log('✅ [BACKEND] Saved Queue ID:', queueEntry._id);
    console.log('✅ [BACKEND] Saved Queue Number:', queueEntry.queueNumber);
    console.log('✅ [BACKEND] Final saved Queue data:', JSON.stringify(queueEntry, null, 2));

    // Populate the queue entry for response
    await queueEntry.populate('visitationFormId');

    // Emit real-time update to admin dashboards
    const io = req.app.get('io');
    io.to(`admin-${office}`).emit('queue-updated', {
      type: 'queue-added',
      office,
      data: {
        id: queueEntry._id,
        queueNumber: queueEntry.queueNumber,
        customerName: visitationForm ? visitationForm.customerName : 'Enroll Service', // Handle null visitationForm for Enroll service
        role: queueEntry.role,
        service: serviceObj.name,
        status: queueEntry.status,
        isPriority: queueEntry.isPriority,
        queuedAt: queueEntry.queuedAt,
        windowId: assignedWindow._id,
        windowName: assignedWindow.name
      }
    });

    // Also emit to kiosk room for homepage updates
    io.to('kiosk').emit('queue-updated', {
      type: 'queue-added',
      office,
      data: {
        currentNumber: nextQueueNumber,
        nextNumber: nextQueueNumber + 1
      }
    });

    // Emit to queue-specific room for PortalQueue real-time updates
    io.to(`queue-${queueEntry._id}`).emit('queue-updated', {
      type: 'queue-status-updated',
      queueId: queueEntry._id,
      data: {
        queueNumber: queueEntry.queueNumber,
        status: queueEntry.status,
        office: queueEntry.office
      }
    });

    console.log('📡 Real-time updates sent');

    res.status(201).json({
      success: true,
      message: 'Queue entry created successfully',
      data: {
        queueId: queueEntry._id, // Add queue ID for rating submission
        queueNumber: queueEntry.queueNumber,
        office: queueEntry.office,
        service: serviceObj.name,
        role: queueEntry.role,
        isPriority: queueEntry.isPriority,
        estimatedWaitTime: queueEntry.estimatedWaitTime,
        queuedAt: queueEntry.queuedAt,
        windowId: assignedWindow._id,
        windowName: assignedWindow.name,
        qrCodeUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/portalqueue?queueId=${queueEntry._id}`
      }
    });

  } catch (error) {
    console.error('❌ Queue submission error:', error);
    res.status(500).json({
      error: 'Failed to create queue entry',
      message: error.message
    });
  }
});

// GET /api/public/queue-data/:department - Get queue data for admin interface
router.get('/queue-data/:department', async (req, res) => {
  try {
    const { department } = req.params;
    const { windowId, serviceId } = req.query; // Add query parameters for filtering

    // Build query for waiting queues
    const waitingQuery = {
      office: department,
      status: 'waiting'
    };

    // Add filtering by windowId if provided
    if (windowId) {
      waitingQuery.windowId = windowId;
    }

    // Add filtering by serviceId if provided
    if (serviceId) {
      waitingQuery.serviceId = serviceId;
    }

    console.log('🔍 Queue data query:', waitingQuery);

    // Get waiting queues with populated visitation forms
    const waitingQueues = await Queue.find(waitingQuery)
    .populate('visitationFormId')
    .sort({ queuedAt: 1 })
    .limit(20);

    // Build query for currently serving
    const servingQuery = {
      office: department,
      status: 'serving',
      isCurrentlyServing: true
    };

    // Add same filtering for currently serving
    if (windowId) {
      servingQuery.windowId = windowId;
    }
    if (serviceId) {
      servingQuery.serviceId = serviceId;
    }

    // Get currently serving queue
    const currentlyServing = await Queue.findOne(servingQuery).populate('visitationFormId');

    // Get skipped queues (apply same filtering)
    const skippedQuery = {
      office: department,
      status: 'skipped'
    };
    if (windowId) {
      skippedQuery.windowId = windowId;
    }
    if (serviceId) {
      skippedQuery.serviceId = serviceId;
    }

    const skippedQueues = await Queue.find(skippedQuery).sort({ queuedAt: 1 });

    // Format queue data for frontend with service lookup
    const formattedQueues = await Promise.all(
      waitingQueues.map(async (queue) => {
        // Find service by serviceId
        const service = await Service.findById(queue.serviceId);

        return {
          id: queue._id,
          number: queue.queueNumber,
          status: queue.status,
          name: queue.visitationFormId?.customerName || 'Unknown',
          role: queue.role,
          service: service ? service.name : 'Unknown Service',
          isPriority: queue.isPriority,
          queuedAt: queue.queuedAt,
          windowId: queue.windowId,
          serviceId: queue.serviceId
        };
      })
    );

    let currentServingData = null;
    if (currentlyServing) {
      const currentService = await Service.findById(currentlyServing.serviceId);

      // Debug logging for idNumber
      console.log('🔍 [BACKEND] currentlyServing object:', {
        queueNumber: currentlyServing.queueNumber,
        hasVisitationFormId: !!currentlyServing.visitationFormId,
        visitationFormId: currentlyServing.visitationFormId?._id,
        idNumberFromVisitationForm: currentlyServing.visitationFormId?.idNumber,
        idNumberDirect: currentlyServing.idNumber,
        isPriority: currentlyServing.isPriority
      });

      currentServingData = {
        number: currentlyServing.queueNumber,
        name: currentlyServing.visitationFormId?.customerName || 'Unknown',
        role: currentlyServing.role,
        purpose: currentService ? currentService.name : 'Unknown Service',
        windowId: currentlyServing.windowId,
        serviceId: currentlyServing.serviceId,
        idNumber: currentlyServing.visitationFormId?.idNumber || currentlyServing.idNumber || ''
      };

      console.log('🔍 [BACKEND] currentServingData being sent:', currentServingData);
    }

    console.log('📊 Filtered queue results:', {
      waitingCount: formattedQueues.length,
      currentlyServing: currentServingData?.number || 'None',
      skippedCount: skippedQueues.length,
      filters: { windowId, serviceId }
    });

    res.json({
      success: true,
      data: {
        waitingQueue: formattedQueues,
        currentlyServing: currentServingData,
        skippedQueue: skippedQueues.map(q => q.queueNumber),
        department,
        filters: { windowId, serviceId },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching queue data:', error);
    res.status(500).json({
      error: 'Failed to fetch queue data',
      message: error.message
    });
  }
});

// GET /api/public/queue-lookup/:id - Get queue details by ID for QR code scanning
router.get('/queue-lookup/:id', async (req, res) => {
  try {
    const { id } = req.params;

    console.log('🔍 Queue lookup request for ID:', id);

    // Validate ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Invalid queue ID format'
      });
    }

    // Find the queue entry with populated data
    const queueEntry = await Queue.findById(id)
      .populate('visitationFormId')
      .populate('serviceId');

    // Manually populate windowId since it's stored as String but we need ObjectId for population
    let windowData = null;
    if (queueEntry && queueEntry.windowId) {
      try {
        const Window = require('../models/Window');
        windowData = await Window.findById(queueEntry.windowId);
      } catch (err) {
        console.warn('⚠️ Could not populate window data:', err.message);
      }
    }

    if (!queueEntry) {
      return res.status(404).json({
        error: 'Queue not found'
      });
    }

    // Check if queue is still valid (not older than 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (queueEntry.createdAt < twentyFourHoursAgo) {
      return res.status(410).json({
        error: 'Queue has expired'
      });
    }

    // Get current serving number for the same window/department
    const currentServing = await Queue.getCurrentServingNumber(queueEntry.office, queueEntry.windowId);

    // Get next 2 upcoming queue numbers for the same window
    const upcomingQueues = await Queue.find({
      office: queueEntry.office,
      windowId: queueEntry.windowId,
      status: 'waiting',
      queueNumber: { $gt: currentServing }
    })
    .sort({ queueNumber: 1 })
    .limit(2)
    .select('queueNumber');

    const upcomingNumbers = upcomingQueues.map(q => q.queueNumber);

    // Get department location from settings
    const Settings = require('../models/Settings');
    const settings = await Settings.getCurrentSettings();
    const location = settings?.officeSettings?.[queueEntry.office]?.location || '';

    res.json({
      success: true,
      data: {
        queueId: queueEntry._id,
        queueNumber: queueEntry.queueNumber,
        department: queueEntry.office, // Keep 'department' key for backward compatibility with frontend
        service: queueEntry.serviceId?.name || 'Unknown Service',
        windowName: windowData?.name || 'Unknown Window',
        location: location,
        status: queueEntry.status,
        isPriority: queueEntry.isPriority,
        queuedAt: queueEntry.queuedAt,
        currentServing: currentServing,
        upcomingNumbers: upcomingNumbers,
        estimatedWaitTime: queueEntry.estimatedWaitTime
      }
    });

  } catch (error) {
    console.error('❌ Queue lookup error:', error);
    res.status(500).json({
      error: 'Failed to retrieve queue information',
      message: error.message
    });
  }
});

// POST /api/public/queue/:id/rating - Submit rating for a queue entry
router.post('/queue/:id/rating', async (req, res) => {
  try {
    const { id } = req.params;
    const { rating } = req.body;

    console.log('📝 Rating submission received:', { queueId: id, rating });

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        error: 'Invalid rating. Must be between 1 and 5'
      });
    }

    // Find and update the queue entry with population
    const queueEntry = await Queue.findById(id).populate('visitationFormId');

    if (!queueEntry) {
      return res.status(404).json({
        error: 'Queue entry not found'
      });
    }

    // Update the rating in queue entry
    queueEntry.rating = rating;
    await queueEntry.save();

    // Create a Rating document for the Ratings page
    try {
      const ratingData = {
        rating: rating,
        ratingType: 'overall_experience', // Default rating type for queue submissions
        queueId: queueEntry._id,
        customerName: queueEntry.visitationFormId?.customerName || 'Anonymous Customer',
        customerRole: queueEntry.role,
        office: queueEntry.office,
        status: 'approved' // Auto-approve queue ratings
      };

      // Add customer email if available
      if (queueEntry.visitationFormId?.email) {
        ratingData.customerEmail = queueEntry.visitationFormId.email;
      }

      const ratingDocument = new Rating(ratingData);
      await ratingDocument.save();

      console.log('📊 Rating document created for Ratings page:', ratingDocument._id);
    } catch (ratingDocError) {
      // Log error but don't fail the main rating submission
      console.error('⚠️ Failed to create Rating document (queue rating still saved):', ratingDocError);
    }

    console.log('⭐ Rating updated successfully:', { queueId: id, rating });

    res.json({
      success: true,
      message: 'Rating submitted successfully',
      data: {
        queueId: queueEntry._id,
        queueNumber: queueEntry.queueNumber,
        rating: queueEntry.rating,
        department: queueEntry.office // Keep 'department' key for backward compatibility with frontend
      }
    });

  } catch (error) {
    console.error('❌ Rating submission error:', error);
    res.status(500).json({
      error: 'Failed to submit rating',
      message: error.message
    });
  }
});

// ==========================================
// QUEUE MANAGEMENT ENDPOINTS FOR ADMIN
// ==========================================

// POST /api/public/queue/next - Call next queue number for a window
router.post('/queue/next', async (req, res) => {
  try {
    const { windowId, adminId } = req.body;
    const io = req.app.get('io');

    console.log('🔄 NEXT queue request:', { windowId, adminId });

    // Validate required fields
    if (!windowId) {
      await AuditService.logQueue({
        user: req.user,
        action: 'QUEUE_CALL',
        queueId: null,
        queueNumber: null,
        department: 'unknown',
        req,
        success: false,
        errorMessage: 'Window ID is required'
      });

      return res.status(400).json({
        error: 'Window ID is required'
      });
    }

    // Get window information to determine department
    const window = await Window.findById(windowId);

    if (!window) {
      await AuditService.logQueue({
        user: req.user,
        action: 'QUEUE_CALL',
        queueId: null,
        queueNumber: null,
        department: 'unknown',
        req,
        success: false,
        errorMessage: 'Window not found',
        metadata: { windowId }
      });

      return res.status(404).json({
        error: 'Window not found'
      });
    }

    // Check if window is open
    if (!window.isOpen) {
      await AuditService.logQueue({
        user: req.user,
        action: 'QUEUE_CALL',
        queueId: null,
        queueNumber: null,
        department: window.office, // Keep 'department' key for backward compatibility
        req,
        success: false,
        errorMessage: 'Window is currently closed',
        metadata: { windowId, windowName: window.name }
      });

      return res.status(400).json({
        error: 'Window is currently closed'
      });
    }

    // Find the next waiting queue for this specific window
    const serviceIds = window.serviceIds.map(s => s._id ? s._id.toString() : s.toString());

    // Priority Window should ONLY serve priority queues (isPriority=true)
    // Regular windows should ONLY serve non-priority queues (isPriority=false)
    const isPriorityWindow = window.name === 'Priority';

    console.log('🔍 [NEXT QUEUE] Window details:', {
      windowId,
      windowName: window.name,
      isPriorityWindow,
      serviceIds
    });

    // IMPORTANT: Filter by windowId to ensure each window only calls its own assigned queues
    const queryFilter = {
      office: window.office,
      windowId: windowId, // Only get queues assigned to THIS window
      serviceId: { $in: serviceIds },
      status: 'waiting',
      isPriority: isPriorityWindow // Priority Window gets isPriority=true, others get isPriority=false
    };

    console.log('🔍 [NEXT QUEUE] Query filter:', JSON.stringify(queryFilter, null, 2));

    const nextQueue = await Queue.findOne(queryFilter).sort({ queuedAt: 1 }).populate('visitationFormId');

    console.log('🔍 [NEXT QUEUE] Found queue:', nextQueue ? {
      queueNumber: nextQueue.queueNumber,
      windowId: nextQueue.windowId,
      isPriority: nextQueue.isPriority,
      serviceId: nextQueue.serviceId
    } : 'No queue found');

    // Mark current serving queue as completed (if any) - do this BEFORE checking for next queue
    await Queue.updateMany(
      {
        windowId: windowId,
        isCurrentlyServing: true,
        status: 'serving'
      },
      {
        status: 'completed',
        isCurrentlyServing: false,
        completedAt: new Date()
      }
    );

    if (!nextQueue) {
      await AuditService.logQueue({
        user: req.user,
        action: 'QUEUE_CALL',
        queueId: null,
        queueNumber: null,
        department: window.office, // Keep 'department' key for backward compatibility
        req,
        success: true, // Changed to true since we successfully completed the current queue
        errorMessage: 'No more queues waiting',
        metadata: { windowId, windowName: window.name, serviceIds }
      });

      // Emit real-time updates to clear the current serving
      io.to(`admin-${window.office}`).emit('queue-updated', {
        type: 'no-more-queues',
        department: window.office,
        windowId,
        data: {
          message: 'No more queues waiting'
        }
      });

      return res.json({
        success: true,
        message: 'No more queues waiting',
        data: {
          queueNumber: null,
          customerName: null,
          windowName: window.name,
          noMoreQueues: true
        }
      });
    }

    // Mark the next queue as serving
    await nextQueue.markAsServing(windowId, adminId);

    console.log('✅ Queue marked as serving:', {
      queueNumber: nextQueue.queueNumber,
      windowId,
      customerName: nextQueue.visitationFormId?.customerName
    });

    // Log queue call action
    await AuditService.logQueue({
      user: req.user,
      action: 'QUEUE_CALL',
      queueId: nextQueue._id,
      queueNumber: nextQueue.queueNumber,
      department: window.office, // Keep 'department' key for backward compatibility
      req,
      success: true,
      metadata: {
        windowId,
        windowName: window.name,
        customerName: nextQueue.visitationFormId?.customerName,
        serviceId: nextQueue.serviceId
      }
    });

    // Emit real-time updates
    io.to(`admin-${window.office}`).emit('queue-updated', {
      type: 'next-called',
      department: window.office, // Keep 'department' key for backward compatibility with frontend
      windowId,
      data: {
        queueNumber: nextQueue.queueNumber,
        customerName: nextQueue.visitationFormId?.customerName,
        service: nextQueue.serviceId,
        role: nextQueue.role,
        idNumber: nextQueue.visitationFormId?.idNumber || nextQueue.idNumber || ''
      }
    });

    // Also emit to kiosk room for public display updates
    io.to('kiosk').emit('queue-updated', {
      type: 'next-called',
      department: window.office, // Keep 'department' key for backward compatibility with frontend
      windowId,
      data: {
        queueNumber: nextQueue.queueNumber,
        windowName: window.name
      }
    });

    // Emit to queue-specific room for PortalQueue real-time updates
    io.to(`queue-${nextQueue._id}`).emit('queue-updated', {
      type: 'queue-status-updated',
      queueId: nextQueue._id,
      data: {
        queueNumber: nextQueue.queueNumber,
        status: 'serving',
        department: window.office // Keep 'department' key for backward compatibility with frontend
      }
    });

    res.json({
      success: true,
      message: 'Next queue called successfully',
      data: {
        queueNumber: nextQueue.queueNumber,
        customerName: nextQueue.visitationFormId?.customerName,
        windowName: window.name,
        announcement: `Queue number ${String(nextQueue.queueNumber).padStart(2, '0')} please proceed to ${window.name}`
      }
    });

  } catch (error) {
    console.error('❌ NEXT queue error:', error);
    res.status(500).json({
      error: 'Failed to call next queue',
      message: error.message
    });
  }
});

// POST /api/public/queue/recall - Recall current serving queue number
router.post('/queue/recall', async (req, res) => {
  try {
    const { windowId } = req.body;
    const io = req.app.get('io');

    console.log('🔄 RECALL queue request:', { windowId });

    if (!windowId) {
      return res.status(400).json({
        error: 'Window ID is required'
      });
    }

    // Get window information
    const window = await Window.findById(windowId);

    if (!window) {
      return res.status(404).json({
        error: 'Window not found'
      });
    }

    // Find currently serving queue for this window
    const currentQueue = await Queue.findOne({
      windowId: windowId,
      isCurrentlyServing: true,
      status: 'serving'
    }).populate('visitationFormId');

    if (!currentQueue) {
      return res.status(404).json({
        error: 'No queue currently being served at this window'
      });
    }

    console.log('🔊 Recalling queue:', {
      queueNumber: currentQueue.queueNumber,
      windowName: window.name
    });

    // Emit real-time updates to admin dashboards
    io.to(`admin-${window.office}`).emit('queue-updated', {
      type: 'queue-recalled',
      department: window.office, // Keep 'department' key for backward compatibility with frontend
      windowId,
      data: {
        queueNumber: currentQueue.queueNumber,
        customerName: currentQueue.visitationFormId?.customerName,
        windowName: window.name
      }
    });

    // Also emit to kiosk room for public display updates
    io.to('kiosk').emit('queue-updated', {
      type: 'queue-recalled',
      department: window.office, // Keep 'department' key for backward compatibility with frontend
      windowId,
      data: {
        queueNumber: currentQueue.queueNumber,
        windowName: window.name
      }
    });

    res.json({
      success: true,
      message: 'Queue recalled successfully',
      data: {
        queueNumber: currentQueue.queueNumber,
        customerName: currentQueue.visitationFormId?.customerName,
        windowName: window.name,
        announcement: `Queue number ${String(currentQueue.queueNumber).padStart(2, '0')} please proceed to ${window.name}`
      }
    });

  } catch (error) {
    console.error('❌ RECALL queue error:', error);
    res.status(500).json({
      error: 'Failed to recall queue',
      message: error.message
    });
  }
});

// POST /api/public/queue/stop - Toggle window serving status (pause/resume)
router.post('/queue/stop', async (req, res) => {
  try {
    const { windowId, action } = req.body; // action: 'pause' or 'resume'
    const io = req.app.get('io');

    console.log('🛑 STOP/RESUME queue request:', { windowId, action });

    if (!windowId || !action) {
      return res.status(400).json({
        error: 'Window ID and action (pause/resume) are required'
      });
    }

    // Get window information
    const window = await Window.findById(windowId);

    if (!window) {
      return res.status(404).json({
        error: 'Window not found'
      });
    }

    // Update window serving status
    const isServing = action === 'resume';
    window.isServing = isServing;
    await window.save();

    // Emit real-time updates
    io.to(`admin-${window.office}`).emit('window-status-updated', {
      type: 'serving-status-changed',
      department: window.office, // Keep 'department' key for backward compatibility with frontend
      windowId,
      data: {
        windowName: window.name,
        isServing,
        action
      }
    });

    res.json({
      success: true,
      message: `Window ${action === 'pause' ? 'paused' : 'resumed'} successfully`,
      data: {
        windowName: window.name,
        isServing,
        action
      }
    });

  } catch (error) {
    console.error('❌ STOP/RESUME queue error:', error);
    res.status(500).json({
      error: 'Failed to update window status',
      message: error.message
    });
  }
});

// POST /api/public/queue/previous - Go back to previously served queue
router.post('/queue/previous', async (req, res) => {
  try {
    const { windowId, adminId } = req.body;
    const io = req.app.get('io');

    console.log('⏮️ PREVIOUS queue request:', { windowId, adminId });

    if (!windowId) {
      return res.status(400).json({
        error: 'Window ID is required'
      });
    }

    // Get window information
    const window = await Window.findById(windowId);

    if (!window) {
      return res.status(404).json({
        error: 'Window not found'
      });
    }

    // Find the most recently completed queue for this window
    const previousQueue = await Queue.findOne({
      windowId: windowId,
      status: 'completed'
    }).sort({ completedAt: -1 }).populate('visitationFormId');

    if (!previousQueue) {
      return res.status(404).json({
        error: 'No previously served queue found for this window'
      });
    }

    // Mark current serving queue as waiting (if any)
    await Queue.updateMany(
      {
        windowId: windowId,
        isCurrentlyServing: true,
        status: 'serving'
      },
      {
        status: 'waiting',
        isCurrentlyServing: false,
        calledAt: null
      }
    );

    // Mark the previous queue as serving again
    await previousQueue.markAsServing(windowId, adminId);

    console.log('✅ Previous queue recalled:', {
      queueNumber: previousQueue.queueNumber,
      windowName: window.name
    });

    // Emit real-time updates
    io.to(`admin-${window.office}`).emit('queue-updated', {
      type: 'previous-recalled',
      department: window.office, // Keep 'department' key for backward compatibility with frontend
      windowId,
      data: {
        queueNumber: previousQueue.queueNumber,
        customerName: previousQueue.visitationFormId?.customerName,
        role: previousQueue.role,
        idNumber: previousQueue.visitationFormId?.idNumber || previousQueue.idNumber || ''
      }
    });

    res.json({
      success: true,
      message: 'Previous queue recalled successfully',
      data: {
        queueNumber: previousQueue.queueNumber,
        customerName: previousQueue.visitationFormId?.customerName,
        windowName: window.name,
        announcement: `Queue number ${String(previousQueue.queueNumber).padStart(2, '0')} please return to ${window.name}`
      }
    });

  } catch (error) {
    console.error('❌ PREVIOUS queue error:', error);
    res.status(500).json({
      error: 'Failed to recall previous queue',
      message: error.message
    });
  }
});

// POST /api/public/queue/transfer - Transfer current queue to another window
router.post('/queue/transfer', async (req, res) => {
  try {
    const { fromWindowId, toWindowId, adminId } = req.body;
    const io = req.app.get('io');

    console.log('🔄 TRANSFER queue request:', { fromWindowId, toWindowId, adminId });

    if (!fromWindowId || !toWindowId) {
      return res.status(400).json({
        error: 'Both source and destination window IDs are required'
      });
    }

    if (fromWindowId === toWindowId) {
      return res.status(400).json({
        error: 'Cannot transfer to the same window'
      });
    }

    // Get window information
    const [fromWindow, toWindow] = await Promise.all([
      Window.findById(fromWindowId),
      Window.findById(toWindowId)
    ]);

    if (!fromWindow || !toWindow) {
      return res.status(404).json({
        error: 'One or both windows not found'
      });
    }

    // Check if both windows are in the same department
    if (fromWindow.office !== toWindow.office) {
      return res.status(400).json({
        error: 'Cannot transfer between different departments'
      });
    }

    // Check if destination window is open
    if (!toWindow.isOpen) {
      return res.status(400).json({
        error: 'Destination window is currently closed'
      });
    }

    // Find currently serving queue at source window
    const currentQueue = await Queue.findOne({
      windowId: fromWindowId,
      isCurrentlyServing: true,
      status: 'serving'
    }).populate('visitationFormId');

    if (!currentQueue) {
      return res.status(404).json({
        error: 'No queue currently being served at source window'
      });
    }

    // Transfer the queue to destination window as "waiting" status
    // This allows it to follow the normal queue order at the destination
    currentQueue.windowId = toWindowId;
    currentQueue.status = 'waiting';
    currentQueue.isCurrentlyServing = false;
    currentQueue.calledAt = null; // Reset calledAt since it's now waiting again

    // Update isPriority flag based on destination window type
    // Priority Window requires isPriority=true, regular windows require isPriority=false
    const isDestinationPriorityWindow = toWindow.name === 'Priority';
    currentQueue.isPriority = isDestinationPriorityWindow;

    // Set processedBy (now accepts any type)
    if (adminId) {
      currentQueue.processedBy = adminId;
    }

    await currentQueue.save();

    console.log('✅ Queue transferred:', {
      queueNumber: currentQueue.queueNumber,
      from: fromWindow.name,
      to: toWindow.name,
      isPriority: currentQueue.isPriority,
      status: currentQueue.status,
      windowId: currentQueue.windowId
    });

    // Emit real-time updates
    io.to(`admin-${fromWindow.office}`).emit('queue-updated', {
      type: 'queue-transferred',
      department: fromWindow.office, // Keep 'department' key for backward compatibility with frontend
      data: {
        queueNumber: currentQueue.queueNumber,
        fromWindowId,
        toWindowId,
        fromWindowName: fromWindow.name,
        toWindowName: toWindow.name,
        customerName: currentQueue.visitationFormId?.customerName,
        role: currentQueue.role,
        idNumber: currentQueue.visitationFormId?.idNumber || currentQueue.idNumber || '',
        status: 'waiting' // Queue is now waiting at destination window
      }
    });

    // Also emit to kiosk room for public display updates
    io.to('kiosk').emit('queue-updated', {
      type: 'queue-transferred',
      department: fromWindow.office, // Keep 'department' key for backward compatibility with frontend
      data: {
        queueNumber: currentQueue.queueNumber,
        toWindowName: toWindow.name,
        status: 'waiting'
      }
    });

    res.json({
      success: true,
      message: 'Queue transferred successfully',
      data: {
        queueNumber: currentQueue.queueNumber,
        customerName: currentQueue.visitationFormId?.customerName,
        fromWindowName: fromWindow.name,
        toWindowName: toWindow.name,
        status: 'waiting'
      }
    });

  } catch (error) {
    console.error('❌ TRANSFER queue error:', error);
    res.status(500).json({
      error: 'Failed to transfer queue',
      message: error.message
    });
  }
});

// POST /api/public/queue/skip - Skip current queue and call next
router.post('/queue/skip', async (req, res) => {
  try {
    const { windowId, adminId } = req.body;
    const io = req.app.get('io');

    console.log('⏭️ SKIP queue request:', { windowId, adminId });

    if (!windowId) {
      return res.status(400).json({
        error: 'Window ID is required'
      });
    }

    // Get window information
    const window = await Window.findById(windowId);

    if (!window) {
      return res.status(404).json({
        error: 'Window not found'
      });
    }

    // Find currently serving queue
    const currentQueue = await Queue.findOne({
      windowId: windowId,
      isCurrentlyServing: true,
      status: 'serving'
    }).populate('visitationFormId');

    if (!currentQueue) {
      return res.status(404).json({
        error: 'No queue currently being served at this window'
      });
    }

    // Mark current queue as skipped
    currentQueue.status = 'skipped';
    currentQueue.isCurrentlyServing = false;
    currentQueue.skippedAt = new Date();
    await currentQueue.save();

    // Find and call next queue for this specific window
    const serviceIds = window.serviceIds.map(s => s._id ? s._id.toString() : s.toString());

    // Priority Window should ONLY serve priority queues (isPriority=true)
    // Regular windows should ONLY serve non-priority queues (isPriority=false)
    const isPriorityWindow = window.name === 'Priority';

    // IMPORTANT: Filter by windowId to ensure each window only calls its own assigned queues
    const nextQueue = await Queue.findOne({
      office: window.office,
      windowId: windowId, // Only get queues assigned to THIS window
      serviceId: { $in: serviceIds },
      status: 'waiting',
      isPriority: isPriorityWindow // Priority Window gets isPriority=true, others get isPriority=false
    }).sort({ queuedAt: 1 }).populate('visitationFormId');

    let nextQueueData = null;
    if (nextQueue) {
      await nextQueue.markAsServing(windowId, adminId);
      nextQueueData = {
        queueNumber: nextQueue.queueNumber,
        customerName: nextQueue.visitationFormId?.customerName,
        role: nextQueue.role,
        idNumber: nextQueue.visitationFormId?.idNumber || nextQueue.idNumber || ''
      };
    }

    console.log('✅ Queue skipped and next called:', {
      skippedQueue: currentQueue.queueNumber,
      nextQueue: nextQueueData?.queueNumber || 'None'
    });

    // Emit real-time updates
    io.to(`admin-${window.office}`).emit('queue-updated', {
      type: 'queue-skipped',
      department: window.office, // Keep 'department' key for backward compatibility with frontend
      windowId,
      data: {
        skippedQueue: currentQueue.queueNumber,
        nextQueue: nextQueueData
      }
    });

    res.json({
      success: true,
      message: 'Queue skipped successfully',
      data: {
        skippedQueue: {
          queueNumber: currentQueue.queueNumber,
          customerName: currentQueue.visitationFormId?.customerName
        },
        nextQueue: nextQueueData,
        windowName: window.name,
        announcement: nextQueueData ?
          `Queue number ${String(nextQueueData.queueNumber).padStart(2, '0')} please proceed to ${window.name}` :
          'No more queues waiting'
      }
    });

  } catch (error) {
    console.error('❌ SKIP queue error:', error);
    res.status(500).json({
      error: 'Failed to skip queue',
      message: error.message
    });
  }
});

// POST /api/public/queue/requeue-all - Re-queue all skipped queues for a window/service
router.post('/queue/requeue-all', async (req, res) => {
  try {
    const { windowId, adminId } = req.body;
    const io = req.app.get('io');

    console.log('🔄 RE-QUEUE ALL request:', { windowId, adminId });

    if (!windowId) {
      return res.status(400).json({
        error: 'Window ID is required'
      });
    }

    // Get window information
    const window = await Window.findById(windowId);

    if (!window) {
      return res.status(404).json({
        error: 'Window not found'
      });
    }

    // Find all skipped queues for any of this window's services
    const serviceIds = window.serviceIds.map(s => s._id ? s._id.toString() : s.toString());
    const skippedQueues = await Queue.find({
      office: window.office,
      serviceId: { $in: serviceIds },
      status: 'skipped'
    }).sort({ skippedAt: 1 }); // Order by when they were skipped (earliest first)

    if (skippedQueues.length === 0) {
      return res.status(404).json({
        error: 'No skipped queues found for this service'
      });
    }

    const currentTime = new Date();
    const requeuedCount = skippedQueues.length;

    // Update all skipped queues to waiting status with new timestamps
    // This places them at the end of the current waiting queue
    await Queue.updateMany(
      {
        office: window.office,
        serviceId: { $in: serviceIds },
        status: 'skipped'
      },
      {
        status: 'waiting',
        queuedAt: currentTime, // Set new timestamp to place at end of queue
        skippedAt: null // Clear the skipped timestamp
      }
    );

    console.log('✅ Re-queued all skipped queues:', {
      count: requeuedCount,
      department: window.office, // Keep 'department' key for backward compatibility
      services: window.serviceIds.map(s => s.name || s).join(', ')
    });

    // Emit real-time updates
    io.to(`admin-${window.office}`).emit('queue-updated', {
      type: 'queue-requeued-all',
      department: window.office, // Keep 'department' key for backward compatibility with frontend
      windowId,
      data: {
        requeuedCount,
        windowName: window.name,
        serviceName: window.serviceIds && window.serviceIds.length > 0
          ? window.serviceIds.map(s => s.name || s).join(', ')
          : 'No services assigned'
      }
    });

    // Also emit to kiosk room for public display updates
    io.to('kiosk').emit('queue-updated', {
      type: 'queue-requeued-all',
      department: window.office, // Keep 'department' key for backward compatibility with frontend
      data: {
        requeuedCount
      }
    });

    res.json({
      success: true,
      message: `${requeuedCount} queue${requeuedCount > 1 ? 's' : ''} re-queued successfully`,
      data: {
        requeuedCount,
        windowName: window.name,
        serviceName: window.serviceIds && window.serviceIds.length > 0
          ? window.serviceIds.map(s => s.name || s).join(', ')
          : 'No services assigned',
        department: window.office // Keep 'department' key for backward compatibility with frontend
      }
    });

  } catch (error) {
    console.error('❌ RE-QUEUE ALL error:', error);
    res.status(500).json({
      error: 'Failed to re-queue skipped queues',
      message: error.message
    });
  }
});

// GET /api/public/queue/windows/:department - Get available windows for transfer
router.get('/queue/windows/:department', async (req, res) => {
  try {
    const { department } = req.params;

    console.log('🪟 Fetching windows for transfer:', { department });

    const windows = await Window.find({
      office: department, // Use 'office' field to match Window model schema
      isOpen: true
    }).select('_id name serviceIds').populate('serviceIds', 'name');

    res.json({
      success: true,
      data: windows.map(window => ({
        id: window._id,
        name: window.name,
        serviceName: window.serviceIds && window.serviceIds.length > 0
          ? window.serviceIds.map(s => s.name).join(', ')
          : 'No services assigned'
      }))
    });

  } catch (error) {
    console.error('❌ Error fetching windows:', error);
    res.status(500).json({
      error: 'Failed to fetch windows',
      message: error.message
    });
  }
});

module.exports = router;
