const mongoose = require('mongoose');
const { Queue, VisitationForm, Service, Window, Settings, Rating, DocumentRequest } = require('../models');
const { AuditService } = require('../middleware/auditMiddleware');
const { log: logger } = require('../utils/logger');
const { generateTransactionNo } = require('../utils/transactionNoGenerator');

/**
 * Helper function to get display customer name for queue entries
 * Handles special case for Enroll service without visitation form
 * @param {Object} queueEntry - Queue entry object (should be populated with visitationFormId)
 * @param {Object} serviceObj - Service object (optional, will be fetched if not provided)
 * @param {boolean} skipQueryIfNotFound - If true, don't query database when serviceObj is undefined (prevents N+1 queries when services were batch-fetched)
 * @returns {Promise<string>} Display customer name
 */
async function getDisplayCustomerName(queueEntry, serviceObj = null, skipQueryIfNotFound = false) {
  // If visitation form exists, use the customer name from it
  if (queueEntry.visitationFormId?.customerName) {
    return queueEntry.visitationFormId.customerName;
  }

  // For Enroll service without visitation form, use office-specific labels
  // Only fetch service if not provided AND serviceId exists AND we're not skipping queries
  if (!serviceObj && queueEntry.serviceId && !skipQueryIfNotFound) {
    // Query database only if services weren't batch-fetched (skipQueryIfNotFound = false)
    serviceObj = await Service.findById(queueEntry.serviceId).lean();
  }

  // If serviceObj is still null/undefined, return fallback
  // This handles cases where service was deleted, doesn't exist, or wasn't in batch-fetched map
  if (!serviceObj) {
    return 'Anonymous Customer';
  }

  if (serviceObj.name === 'Enroll') {
    if (queueEntry.office === 'registrar') {
      return 'Enrollee'; // Continuing students in Registrar's Office
    } else if (queueEntry.office === 'admissions') {
      return 'New Student'; // Incoming new students in Admissions Office
    }
  }

  // Fallback for other cases
  return 'Anonymous Customer';
}

// GET /api/public/queue/:department - Get queue data for department
exports.getQueueData = async (req, res, next) => {
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

    // Get department queues (still needed for nextQueueNumber calculation)
    const departmentQueues = await Queue.find({
      office: department,
      status: 'waiting'
    }).sort({ queuedAt: 1 }).lean();

    // Use aggregation pipeline to fetch windows with current serving queues in a single query
    const windowsWithCurrentNumbers = await Window.aggregate([
      // Match open windows for the department
      {
        $match: {
          office: department,
          isOpen: true
        }
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
              $limit: 1 // Only need the first (and only) current serving queue
            }
          ],
          as: 'currentServing'
        }
      },
      // Lookup services for serviceIds array
      {
        $lookup: {
          from: 'services',
          localField: 'serviceIds',
          foreignField: '_id',
          as: 'services'
        }
      },
      // Transform to match the expected response format
      {
        $project: {
          id: '$_id',
          name: 1,
          department: '$office', // Keep 'department' key for backward compatibility with frontend
          isOpen: 1,
          currentQueueNumber: {
            $ifNull: [
              { $arrayElemAt: ['$currentServing.queueNumber', 0] },
              0
            ]
          },
          services: {
            $map: {
              input: '$services',
              as: 'service',
              in: '$$service.name'
            }
          }
        }
      }
    ]);

    // Transform aggregation result to match exact response format
    const transformedWindows = windowsWithCurrentNumbers.map((window) => {
      // Find next queue number from departmentQueues
      // window.id is already an ObjectId from aggregation, compare directly
      const windowIdForComparison = window.id instanceof mongoose.Types.ObjectId
        ? window.id
        : new mongoose.Types.ObjectId(window.id);
      const nextQueue = departmentQueues.find(q => {
        if (!q.windowId) return false;
        // Both should be ObjectIds now, compare using equals() or string comparison
        if (q.windowId instanceof mongoose.Types.ObjectId && windowIdForComparison instanceof mongoose.Types.ObjectId) {
          return q.windowId.equals(windowIdForComparison);
        }
        return q.windowId.toString() === windowIdForComparison.toString();
      });

      return {
        id: window.id,
        name: window.name,
        department: window.department,
        serviceName: window.services && window.services.length > 0
          ? window.services.join(', ')
          : 'No services assigned',
        isOpen: window.isOpen,
        currentQueueNumber: window.currentQueueNumber,
        nextQueueNumber: nextQueue ? nextQueue.queueNumber : 0
      };
    });

    res.json({
      isEnabled: true,
      currentNumber: transformedWindows.length > 0
        ? Math.max(...transformedWindows.map(w => w.currentQueueNumber), 0)
        : 0,
      nextNumber: departmentQueues.length > 0
        ? Math.min(...departmentQueues.map(q => q.queueNumber), 999)
        : 999,
      queue: departmentQueues.slice(0, 5), // Return first 5 in queue
      windows: transformedWindows,
      department,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching queue data:', error);
    res.status(500).json({ error: error.message });
  }
};

// GET /api/public/services/:department - Get visible services for department
exports.getServices = async (req, res, next) => {
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
};

// GET /api/public/office-status/:department - Check if office is open
exports.getOfficeStatus = async (req, res, next) => {
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
};

// GET /api/public/location/:department - Get department location
exports.getLocation = async (req, res, next) => {
  try {
    const { department } = req.params;

    // Validate department
    if (!['registrar', 'admissions'].includes(department)) {
      return res.status(400).json({ error: 'Invalid department' });
    }

    // Get current settings
    const settings = await Settings.getCurrentSettings();

    // Ensure office settings exist
    if (!settings.officeSettings || !settings.officeSettings[department]) {
      return res.json({ location: '' });
    }

    res.json({
      location: settings.officeSettings[department].location || '',
      department,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching location:', error);
    res.status(500).json({ error: error.message });
  }
};

// GET /api/public/windows/:department - Get active windows for department
exports.getWindows = async (req, res, next) => {
  try {
    const { department } = req.params;

    const windows = await Window.find({
      office: department,
      isOpen: true // Changed from isActive to isOpen to match Window model
    }).populate('serviceIds', 'name category').lean();

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
};

// POST /api/public/queue - Submit new queue entry
exports.submitQueue = async (req, res, next) => {
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

    logger('🚀 [BACKEND] Queue submission received for service:', service);
    logger('📋 [BACKEND] Full request body:', JSON.stringify(req.body, null, 2));
    logger('📋 [BACKEND] Request headers:', JSON.stringify(req.headers, null, 2));

    // Special logging for Enroll service
    if (service === 'Enroll') {
      logger('🎓 [BACKEND] ENROLL SERVICE DETECTED!');
      logger('🎓 [BACKEND] Student Status:', studentStatus);
      logger('🎓 [BACKEND] Customer Name:', customerName);
      logger('🎓 [BACKEND] Contact Number:', contactNumber);
      logger('🎓 [BACKEND] Email:', email);
      logger('🎓 [BACKEND] Address:', address);
    }

    // Validate required fields - special handling for Enroll and Document Claim services
    logger('🔍 [BACKEND] Validating required fields...');
    logger('🔍 [BACKEND] Field check:', {
      office: !!office,
      service: !!service,
      role: !!role,
      customerName: !!customerName,
      contactNumber: !!contactNumber,
      email: !!email,
      transactionNo: !!req.body.transactionNo
    });

    // For Enroll service, only validate core fields (not visitation form fields)
    if (service === 'Enroll') {
      logger('🎓 [BACKEND] ENROLL SERVICE - Using relaxed validation (no form fields required)');
      if (!office || !service || !role) {
        logger('❌ [BACKEND] ENROLL VALIDATION FAILED - Missing core fields!');
        logger('❌ [BACKEND] Missing fields:', {
          office: !office ? 'MISSING' : 'OK',
          service: !service ? 'MISSING' : 'OK',
          role: !role ? 'MISSING' : 'OK'
        });
        return res.status(400).json({
          error: 'Missing required fields for Enroll service',
          required: ['office', 'service', 'role']
        });
      }
      logger('✅ [BACKEND] Enroll service core fields validated');
    } else if (service === 'Document Claim') {
      // For Document Claim service, only validate core fields + transactionNo (not visitation form fields)
      logger('📋 [BACKEND] DOCUMENT CLAIM SERVICE - Using relaxed validation (no form fields required)');
      const { transactionNo } = req.body;
      if (!office || !service || !role || !transactionNo) {
        logger('❌ [BACKEND] DOCUMENT CLAIM VALIDATION FAILED - Missing core fields!');
        logger('❌ [BACKEND] Missing fields:', {
          office: !office ? 'MISSING' : 'OK',
          service: !service ? 'MISSING' : 'OK',
          role: !role ? 'MISSING' : 'OK',
          transactionNo: !transactionNo ? 'MISSING' : 'OK'
        });
        return res.status(400).json({
          error: 'Missing required fields for Document Claim service',
          required: ['office', 'service', 'role', 'transactionNo']
        });
      }
      logger('✅ [BACKEND] Document Claim service core fields validated');
    } else {
      // For all other services, require full visitation form fields
      logger('📋 [BACKEND] REGULAR SERVICE - Using full validation (form fields required)');
      if (!office || !service || !role || !customerName || !contactNumber || !email) {
        logger('❌ [BACKEND] VALIDATION FAILED - Missing required fields!');
        logger('❌ [BACKEND] Missing fields:', {
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
      logger('✅ [BACKEND] All required fields present for regular service');
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
    }).lean();

    if (!serviceObj) {
      return res.status(404).json({
        error: 'Service not found or not available'
      });
    }

    logger('🔍 Found service:', serviceObj.name, serviceObj._id);

    // Special handling for Document Request service
    if (service === 'Document Request') {
      logger('📄 [BACKEND] DOCUMENT REQUEST SERVICE DETECTED!');

      // Validate required fields for Document Request
      const {
        name,
        lastSYAttended,
        programGradeStrand,
        contactNumber,
        emailAddress,
        request
      } = req.body;

      if (!name || !lastSYAttended || !programGradeStrand || !contactNumber || !emailAddress || !request) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields for Document Request',
          required: ['name', 'lastSYAttended', 'programGradeStrand', 'contactNumber', 'emailAddress', 'request']
        });
      }

      // Validate request is an array with at least one item
      if (!Array.isArray(request) || request.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'At least one request type must be selected'
        });
      }

      // Generate unique transaction number
      const transactionNo = await generateTransactionNo();

      // Create document request
      const documentRequest = new DocumentRequest({
        transactionNo,
        name: name.trim(),
        lastSYAttended: lastSYAttended.trim(),
        programGradeStrand: programGradeStrand.trim(),
        contactNumber: contactNumber.trim(),
        emailAddress: emailAddress.trim().toLowerCase(),
        request: request,
        status: 'pending'
      });

      await documentRequest.save();

      logger('✅ [BACKEND] Document Request created successfully:', documentRequest.transactionNo);

      // Return success response (no queue entry created)
      return res.json({
        success: true,
        data: {
          transactionNo: documentRequest.transactionNo,
          message: 'Document request submitted successfully. Please wait for email notification regarding the status of your request.'
        }
      });
    }

    // Special handling for Document Claim service
    if (service === 'Document Claim') {
      logger('📋 [BACKEND] DOCUMENT CLAIM SERVICE DETECTED!');

      const { transactionNo } = req.body;

      if (!transactionNo) {
        return res.status(400).json({
          success: false,
          error: 'Transaction number is required for Document Claim service'
        });
      }

      // Validate transaction number format
      if (!/^TR\d{6}-\d{3}$/.test(transactionNo.trim().toUpperCase())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid transaction number format. Expected format: TR######-###'
        });
      }

      // Lookup document request
      const documentRequest = await DocumentRequest.findByTransactionNo(transactionNo.trim().toUpperCase());

      if (!documentRequest || documentRequest.status !== 'approved') {
        return res.status(400).json({
          success: false,
          error: 'Invalid Transaction Number. The Transaction Number you entered may be rejected or does not exist.'
        });
      }

      // Check if this transaction number is already queued (prevent duplicates)
      // Use .select('_id').lean() to minimize data transfer for existence check
      const existingQueue = await Queue.findOne({
        transactionNo: transactionNo.trim().toUpperCase(),
        status: { $in: ['waiting', 'serving', 'completed'] } // Check active and completed queues
      }).select('_id').lean();

      if (existingQueue) {
        return res.status(400).json({
          success: false,
          error: 'Transaction Number is already in queue or has been completed. Please wait for your turn or contact the office if you need assistance.'
        });
      }

      logger('✅ [BACKEND] Document Request found and approved:', documentRequest.transactionNo);
      logger('✅ [BACKEND] No duplicate queue found for transaction number:', transactionNo.trim().toUpperCase());

      // Use customer info from DocumentRequest
      const customerName = documentRequest.name;
      const contactNumberFromRequest = documentRequest.contactNumber;
      const emailFromRequest = documentRequest.emailAddress;

      // Override the request body with DocumentRequest data for queue creation
      req.body.customerName = customerName;
      req.body.contactNumber = contactNumberFromRequest;
      req.body.email = emailFromRequest;
      req.body.address = ''; // No address for Document Claim

      // Continue with normal queue creation flow, but we'll add transactionNo reference
      logger('📋 [BACKEND] Proceeding with queue creation for Document Claim');
    }

    // Find window assigned to this queue
    let assignedWindow;

    // Priority queues ALWAYS go to the Priority Window
    if (isPriority) {
      logger('⭐ Priority queue detected - assigning to Priority Window');
      assignedWindow = await Window.findOne({
        office: office,
        isOpen: true,
        name: 'Priority'
      }).populate('serviceIds', 'name').lean();

      if (!assignedWindow) {
        console.error('❌ Priority Window not found or not open');
        return res.status(503).json({
          error: 'Priority Window is currently unavailable'
        });
      }
      logger('✅ Assigned to Priority Window:', assignedWindow.name);
    } else {
      // Non-priority queues use service-based window assignment
      // IMPORTANT: Exclude Priority Window from non-priority queue assignment
      // Priority Window should ONLY receive queues with isPriority=true
      assignedWindow = await Window.findOne({
        office: office,
        isOpen: true,
        serviceIds: serviceObj._id,
        name: { $ne: 'Priority' } // Exclude Priority Window
      }).populate('serviceIds', 'name').lean();

      if (!assignedWindow) {
        console.error('❌ No window assigned to service:', serviceObj.name);
        return res.status(503).json({
          error: 'Service is currently unavailable - no window assigned'
        });
      }
      logger('🪟 Assigned to window:', assignedWindow.name);
    }

    // Create visitation form - skip for Enroll service
    let visitationForm = null;

    if (service === 'Enroll') {
      logger('🎓 [BACKEND] ENROLL SERVICE - Skipping VisitationForm creation');
      logger('🎓 [BACKEND] Enroll service does not require visitation form data');
    } else {
      // For Document Claim, customer info is populated from DocumentRequest in req.body
      // Re-extract from req.body to get the populated values
      const formCustomerName = service === 'Document Claim' ? req.body.customerName : customerName;
      const formContactNumber = service === 'Document Claim' ? req.body.contactNumber : contactNumber;
      const formEmail = service === 'Document Claim' ? req.body.email : email;
      const formAddress = service === 'Document Claim' ? (req.body.address || '') : (address || '');

      logger('📝 [BACKEND] Creating VisitationForm with data:', {
        customerName: formCustomerName,
        contactNumber: formContactNumber,
        email: formEmail,
        address: formAddress,
        idNumber: isPriority ? (idNumber || '') : ''
      });

      visitationForm = await VisitationForm.createForm({
        customerName: formCustomerName,
        contactNumber: formContactNumber,
        email: formEmail,
        address: formAddress,
        idNumber: isPriority ? (idNumber || '') : ''
      });

      logger('✅ [BACKEND] VisitationForm created successfully:', visitationForm._id);
      logger('✅ [BACKEND] VisitationForm data:', JSON.stringify(visitationForm, null, 2));
    }

    // Get next queue number
    const nextQueueNumber = await Queue.getNextQueueNumber(office);

    logger('🔢 Next queue number:', nextQueueNumber);

    // Create queue entry with proper data types
    const queueData = {
      queueNumber: nextQueueNumber,
      office: office,
      serviceId: serviceObj._id, // Store as ObjectId
      windowId: assignedWindow._id, // Store as ObjectId
      role,
      studentStatus: service === 'Enroll' ? studentStatus : undefined,
      isPriority: Boolean(isPriority)
    };

    // Generate transaction number for all queue entries
    // For Document Claim, use the provided transactionNo from DocumentRequest
    // For all other services, generate a new unique transaction number
    if (service === 'Document Claim') {
      const { transactionNo } = req.body;
      if (transactionNo) {
        queueData.transactionNo = transactionNo.trim().toUpperCase();
        logger('📋 [BACKEND] Using DocumentRequest transactionNo in queue entry:', queueData.transactionNo);
      }
    } else {
      // Generate unique transaction number for all other services
      try {
        const transactionNo = await generateTransactionNo();
        queueData.transactionNo = transactionNo;
        logger('📋 [BACKEND] Generated transactionNo for queue entry:', queueData.transactionNo);
      } catch (error) {
        logger('⚠️ [BACKEND] Failed to generate transaction number:', error.message);
        // Continue without transaction number if generation fails (non-critical)
      }
    }

    // Only add visitationFormId if visitationForm was created (not for Enroll or Document Claim services)
    if (visitationForm) {
      queueData.visitationFormId = visitationForm._id;
      logger('📋 [BACKEND] Including visitationFormId in queue entry:', visitationForm._id);
    } else {
      if (service === 'Enroll') {
        logger('🎓 [BACKEND] No visitationFormId for Enroll service - creating queue without form reference');
      } else if (service === 'Document Claim') {
        logger('📋 [BACKEND] No visitationFormId for Document Claim service - using DocumentRequest data');
      }
    }

    const queueEntry = new Queue(queueData);

    // Save to MongoDB
    logger('💾 [BACKEND] Saving Queue entry to MongoDB...');
    logger('💾 [BACKEND] Queue entry data before save:', JSON.stringify(queueEntry, null, 2));

    await queueEntry.save();

    logger('✅ [BACKEND] Queue entry saved successfully to MongoDB!');
    logger('✅ [BACKEND] Saved Queue ID:', queueEntry._id);
    logger('✅ [BACKEND] Saved Queue Number:', queueEntry.queueNumber);
    logger('✅ [BACKEND] Final saved Queue data:', JSON.stringify(queueEntry, null, 2));

    // Populate the queue entry for response
    await queueEntry.populate('visitationFormId');

    // Determine customer name for display using helper function
    const displayCustomerName = await getDisplayCustomerName(queueEntry, serviceObj);
    logger('👤 [BACKEND] Display customer name:', displayCustomerName);

    // Emit real-time update to admin dashboards
    const io = req.app.get('io');
    io.to(`admin-${office}`).emit('queue-updated', {
      type: 'queue-added',
      office,
      data: {
        id: queueEntry._id,
        queueNumber: queueEntry.queueNumber,
        customerName: displayCustomerName,
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

    logger('📡 Real-time updates sent');

    res.status(201).json({
      success: true,
      message: 'Queue entry created successfully',
      data: {
        queueId: queueEntry._id, // Add queue ID for rating submission
        queueNumber: queueEntry.queueNumber,
        transactionNo: queueEntry.transactionNo, // Include transaction number
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
};

// GET /api/public/queue-data/:department - Get queue data for admin interface
exports.getQueueDataForAdmin = async (req, res, next) => {
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

    logger('🔍 Queue data query:', waitingQuery);

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

    // Parallelize all three Queue queries for better performance
    const [waitingQueues, currentlyServing, skippedQueues] = await Promise.all([
      // Get waiting queues with populated visitation forms
      Queue.find(waitingQuery)
        .populate('visitationFormId')
        .sort({ queuedAt: 1 })
        .limit(20)
        .lean(),
      // Get currently serving queue
      Queue.findOne(servingQuery).populate('visitationFormId').lean(),
      // Get skipped queues
      Queue.find(skippedQuery).sort({ queuedAt: 1 }).lean()
    ]);

    // Extract unique serviceIds from all queues to batch fetch services (fixes N+1 problem)
    const serviceIds = new Set();
    waitingQueues.forEach(queue => {
      if (queue.serviceId) serviceIds.add(queue.serviceId);
    });
    if (currentlyServing?.serviceId) {
      serviceIds.add(currentlyServing.serviceId);
    }

    // Batch fetch all services at once
    const services = await Service.find({ _id: { $in: Array.from(serviceIds) } }).lean();
    const serviceMap = new Map();
    services.forEach(service => {
      serviceMap.set(service._id.toString(), service);
    });

    // Filter out Special Request queues - exclude queues where service has isSpecialRequest: true
    const filteredWaitingQueues = waitingQueues.filter(queue => {
      const service = serviceMap.get(queue.serviceId?.toString());
      return !service || !service.isSpecialRequest;
    });

    // Filter currently serving if it's a Special Request
    let filteredCurrentlyServing = currentlyServing;
    if (currentlyServing) {
      const currentService = serviceMap.get(currentlyServing.serviceId?.toString());
      if (currentService && currentService.isSpecialRequest) {
        filteredCurrentlyServing = null;
      }
    }

    // Filter skipped queues
    const skippedServiceIds = new Set();
    skippedQueues.forEach(queue => {
      if (queue.serviceId) skippedServiceIds.add(queue.serviceId);
    });
    const skippedServices = await Service.find({ _id: { $in: Array.from(skippedServiceIds) } }).lean();
    const skippedServiceMap = new Map();
    skippedServices.forEach(service => {
      skippedServiceMap.set(service._id.toString(), service);
    });
    const filteredSkippedQueues = skippedQueues.filter(queue => {
      const service = skippedServiceMap.get(queue.serviceId?.toString());
      return !service || !service.isSpecialRequest;
    });

    // Format queue data for frontend with service lookup using the service map
    const formattedQueues = await Promise.all(
      filteredWaitingQueues.map(async (queue) => {
        // Get service from map (O(1) lookup instead of database query)
        const service = serviceMap.get(queue.serviceId?.toString());

        // Get display customer name using helper function
        // Pass skipQueryIfNotFound=true since services were batch-fetched (prevents N+1 queries)
        const displayCustomerName = await getDisplayCustomerName(queue, service, true);

        return {
          id: queue._id,
          number: queue.queueNumber,
          status: queue.status,
          name: displayCustomerName,
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
    if (filteredCurrentlyServing) {
      // Get service from map (O(1) lookup instead of database query)
      const currentService = serviceMap.get(filteredCurrentlyServing.serviceId?.toString());

      // Get display customer name using helper function
      // Pass skipQueryIfNotFound=true since services were batch-fetched (prevents N+1 queries)
      const displayCustomerName = await getDisplayCustomerName(filteredCurrentlyServing, currentService, true);

      // Debug logging for idNumber
      logger('🔍 [BACKEND] currentlyServing object:', {
        queueNumber: currentlyServing.queueNumber,
        hasVisitationFormId: !!currentlyServing.visitationFormId,
        visitationFormId: currentlyServing.visitationFormId?._id,
        idNumberFromVisitationForm: currentlyServing.visitationFormId?.idNumber,
        idNumberDirect: currentlyServing.idNumber,
        isPriority: currentlyServing.isPriority,
        displayCustomerName
      });

      currentServingData = {
        number: filteredCurrentlyServing.queueNumber,
        name: displayCustomerName,
        role: filteredCurrentlyServing.role,
        purpose: currentService ? currentService.name : 'Unknown Service',
        windowId: filteredCurrentlyServing.windowId,
        serviceId: filteredCurrentlyServing.serviceId,
        transactionNo: filteredCurrentlyServing.transactionNo || '',
        idNumber: filteredCurrentlyServing.visitationFormId?.idNumber || filteredCurrentlyServing.idNumber || ''
      };

      logger('🔍 [BACKEND] currentServingData being sent:', currentServingData);
    }

    logger('📊 Filtered queue results:', {
      waitingCount: formattedQueues.length,
      currentlyServing: currentServingData?.number || 'None',
      skippedCount: filteredSkippedQueues.length,
      filters: { windowId, serviceId }
    });

    res.json({
      success: true,
      data: {
        waitingQueue: formattedQueues,
        currentlyServing: currentServingData,
        skippedQueue: filteredSkippedQueues.map(q => q.queueNumber),
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
};

// GET /api/public/queue-lookup/:id - Get queue details by ID for QR code scanning
exports.getQueueLookup = async (req, res, next) => {
  try {
    const { id } = req.params;

    logger('🔍 Queue lookup request for ID:', id);

    // Validate ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Invalid queue ID format'
      });
    }

    // Find the queue entry with populated data
    const queueEntry = await Queue.findById(id)
      .populate('visitationFormId')
      .populate('serviceId')
      .populate('windowId')
      .lean();

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
    .select('queueNumber')
    .lean();

    const upcomingNumbers = upcomingQueues.map(q => q.queueNumber);

    // Get department location from settings
    const settings = await Settings.getCurrentSettings();
    const location = settings?.officeSettings?.[queueEntry.office]?.location || '';

    res.json({
      success: true,
      data: {
        queueId: queueEntry._id,
        queueNumber: queueEntry.queueNumber,
        transactionNo: queueEntry.transactionNo, // Include transaction number
        department: queueEntry.office, // Keep 'department' key for backward compatibility with frontend
        service: queueEntry.serviceId?.name || 'Unknown Service',
        windowName: queueEntry.windowId?.name || 'Unknown Window',
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
};

// POST /api/public/queue/:id/rating - Submit rating for a queue entry
exports.submitQueueRating = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rating } = req.body;

    logger('📝 Rating submission received:', { queueId: id, rating });

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        error: 'Invalid rating. Must be between 1 and 5'
      });
    }

    // Find and update the queue entry with population
    const queueEntry = await Queue.findById(id).populate('visitationFormId'); // Cannot use .lean() - needs instance methods

    if (!queueEntry) {
      return res.status(404).json({
        error: 'Queue entry not found'
      });
    }

    // Update the rating in queue entry
    queueEntry.rating = rating;
    await queueEntry.save();

    // Determine customer name for rating using helper function
    const ratingCustomerName = await getDisplayCustomerName(queueEntry);

    // Create a Rating document for the Ratings page
    try {
      const ratingData = {
        rating: rating,
        ratingType: 'overall_experience', // Default rating type for queue submissions
        queueId: queueEntry._id,
        customerName: ratingCustomerName,
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

      logger('📊 Rating document created for Ratings page:', ratingDocument._id);
    } catch (ratingDocError) {
      // Log error but don't fail the main rating submission
      console.error('⚠️ Failed to create Rating document (queue rating still saved):', ratingDocError);
    }

    logger('⭐ Rating updated successfully:', { queueId: id, rating });

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
};

// POST /api/public/queue/next - Call next queue number for a window
exports.callNextQueue = async (req, res, next) => {
  try {
    const { windowId, adminId } = req.body;
    const io = req.app.get('io');

    logger('🔄 NEXT queue request:', { windowId, adminId });

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
    const window = await Window.findById(windowId).lean();

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
        department: window.office,
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
    const serviceIds = window.serviceIds.map(s => s._id ? s._id : s);

    // Priority Window should ONLY serve priority queues (isPriority=true)
    // Regular windows should ONLY serve non-priority queues (isPriority=false)
    const isPriorityWindow = window.name === 'Priority';

    logger('🔍 [NEXT QUEUE] Window details:', {
      windowId,
      windowName: window.name,
      isPriorityWindow,
      serviceIds
    });

    // IMPORTANT: Filter by windowId to ensure each window only calls its own assigned queues
    // First, try to find queues with matching services (normal flow)
    const queryFilterWithService = {
      office: window.office,
      windowId: windowId,
      serviceId: { $in: serviceIds },
      status: 'waiting',
      isPriority: isPriorityWindow
    };

    logger('🔍 [NEXT QUEUE] Query filter (with service):', JSON.stringify(queryFilterWithService, null, 2));

    let nextQueue = await Queue.findOne(queryFilterWithService).sort({ queuedAt: 1 }).populate('visitationFormId');

    // If no queue found with matching service, check for transferred queues (without service filter)
    if (!nextQueue) {
      const queryFilterWithoutService = {
        office: window.office,
        windowId: windowId,
        status: 'waiting',
        isPriority: isPriorityWindow
      };

      logger('🔍 [NEXT QUEUE] No queue with matching service, checking for transferred queues...');
      logger('🔍 [NEXT QUEUE] Query filter (without service):', JSON.stringify(queryFilterWithoutService, null, 2));

      nextQueue = await Queue.findOne(queryFilterWithoutService).sort({ queuedAt: 1 }).populate('visitationFormId');
    }

    logger('🔍 [NEXT QUEUE] Found queue:', nextQueue ? {
      queueNumber: nextQueue.queueNumber,
      windowId: nextQueue.windowId,
      isPriority: nextQueue.isPriority,
      serviceId: nextQueue.serviceId,
      isTransferred: nextQueue.serviceId && !serviceIds.some(sid =>
        (sid instanceof mongoose.Types.ObjectId && nextQueue.serviceId instanceof mongoose.Types.ObjectId && sid.equals(nextQueue.serviceId)) ||
        (sid.toString() === nextQueue.serviceId.toString())
      )
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
        department: window.office,
        req,
        success: true,
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

    // Get display customer name using helper function
    const displayCustomerName = await getDisplayCustomerName(nextQueue);

    logger('✅ Queue marked as serving:', {
      queueNumber: nextQueue.queueNumber,
      windowId,
      customerName: displayCustomerName
    });

    // Log queue call action
    await AuditService.logQueue({
      user: req.user,
      action: 'QUEUE_CALL',
      queueId: nextQueue._id,
      queueNumber: nextQueue.queueNumber,
      department: window.office,
      req,
      success: true,
      metadata: {
        windowId,
        windowName: window.name,
        customerName: displayCustomerName,
        serviceId: nextQueue.serviceId
      }
    });

    // Emit real-time updates
    io.to(`admin-${window.office}`).emit('queue-updated', {
      type: 'next-called',
      department: window.office,
      windowId,
      data: {
        queueNumber: nextQueue.queueNumber,
        customerName: displayCustomerName,
        service: nextQueue.serviceId,
        role: nextQueue.role,
        idNumber: nextQueue.visitationFormId?.idNumber || nextQueue.idNumber || ''
      }
    });

    // Also emit to kiosk room for public display updates
    io.to('kiosk').emit('queue-updated', {
      type: 'next-called',
      department: window.office,
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
        department: window.office
      }
    });

    res.json({
      success: true,
      message: 'Next queue called successfully',
      data: {
        queueNumber: nextQueue.queueNumber,
        customerName: displayCustomerName,
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
};

// POST /api/public/queue/recall - Recall current serving queue number
exports.recallQueue = async (req, res, next) => {
  try {
    const { windowId } = req.body;
    const io = req.app.get('io');

    logger('🔄 RECALL queue request:', { windowId });

    if (!windowId) {
      return res.status(400).json({
        error: 'Window ID is required'
      });
    }

    // Get window information
    const window = await Window.findById(windowId).lean();

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
    }).populate('visitationFormId').lean();

    if (!currentQueue) {
      await AuditService.logQueue({
        user: req.user,
        action: 'QUEUE_RECALL',
        queueId: null,
        queueNumber: null,
        department: window.office,
        req,
        success: false,
        errorMessage: 'No queue currently being served at this window'
      });

      return res.status(404).json({
        error: 'No queue currently being served at this window'
      });
    }

    logger('🔊 Recalling queue:', {
      queueNumber: currentQueue.queueNumber,
      windowName: window.name
    });

    // Log successful recall
    await AuditService.logQueue({
      user: req.user,
      action: 'QUEUE_RECALL',
      queueId: currentQueue._id,
      queueNumber: currentQueue.queueNumber,
      department: window.office,
      req,
      success: true,
      metadata: {
        windowId: window._id,
        windowName: window.name
      }
    });

    // Emit real-time updates to admin dashboards
    io.to(`admin-${window.office}`).emit('queue-updated', {
      type: 'queue-recalled',
      department: window.office,
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
      department: window.office,
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

    await AuditService.logQueue({
      user: req.user,
      action: 'QUEUE_RECALL',
      queueId: null,
      queueNumber: null,
      department: 'unknown',
      req,
      success: false,
      errorMessage: error.message
    });

    res.status(500).json({
      error: 'Failed to recall queue',
      message: error.message
    });
  }
};

// POST /api/public/queue/stop - Toggle window serving status (pause/resume)
exports.toggleWindowServing = async (req, res, next) => {
  try {
    const { windowId, action } = req.body;
    const io = req.app.get('io');

    logger('🛑 STOP/RESUME queue request:', { windowId, action });

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
      department: window.office,
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
};

// POST /api/public/queue/previous - Go back to previously served queue
exports.recallPreviousQueue = async (req, res, next) => {
  try {
    const { windowId, adminId } = req.body;
    const io = req.app.get('io');

    logger('⏮️ PREVIOUS queue request:', { windowId, adminId });

    if (!windowId) {
      return res.status(400).json({
        error: 'Window ID is required'
      });
    }

    // Get window information
    const window = await Window.findById(windowId).lean();

    if (!window) {
      return res.status(404).json({
        error: 'Window not found'
      });
    }

    // Calculate today's date range (00:00:00 to 23:59:59.999)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Find the most recently completed queue for this window (completed today only)
    const previousQueue = await Queue.findOne({
      windowId: windowId,
      status: 'completed',
      completedAt: { $gte: today, $lt: tomorrow }
    }).sort({ completedAt: -1 }).populate('visitationFormId');

    if (!previousQueue) {
      await AuditService.logQueue({
        user: req.user,
        action: 'QUEUE_PREVIOUS',
        queueId: null,
        queueNumber: null,
        department: window.office,
        req,
        success: false,
        errorMessage: 'No previously served queue found for this window',
        metadata: {
          windowId: window._id,
          windowName: window.name
        }
      });

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

    logger('✅ Previous queue recalled:', {
      queueNumber: previousQueue.queueNumber,
      windowName: window.name
    });

    // Log successful previous operation
    await AuditService.logQueue({
      user: req.user,
      action: 'QUEUE_PREVIOUS',
      queueId: previousQueue._id,
      queueNumber: previousQueue.queueNumber,
      department: window.office,
      req,
      success: true,
      metadata: {
        windowId: window._id,
        windowName: window.name
      }
    });

    // Emit real-time updates
    io.to(`admin-${window.office}`).emit('queue-updated', {
      type: 'previous-recalled',
      department: window.office,
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

    await AuditService.logQueue({
      user: req.user,
      action: 'QUEUE_PREVIOUS',
      queueId: null,
      queueNumber: null,
      department: 'unknown',
      req,
      success: false,
      errorMessage: error.message
    });

    res.status(500).json({
      error: 'Failed to recall previous queue',
      message: error.message
    });
  }
};

// POST /api/public/queue/transfer - Transfer current queue to another window
exports.transferQueue = async (req, res, next) => {
  try {
    const { fromWindowId, toWindowId, adminId } = req.body;
    const io = req.app.get('io');

    logger('🔄 TRANSFER queue request:', { fromWindowId, toWindowId, adminId });

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
      await AuditService.logQueue({
        user: req.user,
        action: 'QUEUE_TRANSFER',
        queueId: null,
        queueNumber: null,
        department: fromWindow.office,
        req,
        success: false,
        errorMessage: 'No queue currently being served at source window'
      });

      return res.status(404).json({
        error: 'No queue currently being served at source window'
      });
    }

    // Transfer the queue to destination window as "waiting" status
    currentQueue.windowId = toWindowId;
    currentQueue.status = 'waiting';
    currentQueue.isCurrentlyServing = false;
    currentQueue.calledAt = null;

    // Update isPriority flag based on destination window type
    const isDestinationPriorityWindow = toWindow.name === 'Priority';
    currentQueue.isPriority = isDestinationPriorityWindow;

    // Set processedBy (now accepts any type)
    if (adminId) {
      currentQueue.processedBy = adminId;
    }

    await currentQueue.save();

    logger('✅ Queue transferred:', {
      queueNumber: currentQueue.queueNumber,
      from: fromWindow.name,
      to: toWindow.name,
      isPriority: currentQueue.isPriority,
      status: currentQueue.status,
      windowId: currentQueue.windowId,
      serviceId: currentQueue.serviceId
    });

    // Log successful transfer
    await AuditService.logQueue({
      user: req.user,
      action: 'QUEUE_TRANSFER',
      queueId: currentQueue._id,
      queueNumber: currentQueue.queueNumber,
      department: fromWindow.office,
      req,
      success: true,
      metadata: {
        fromWindowId: fromWindow._id,
        fromWindowName: fromWindow.name,
        toWindowId: toWindow._id,
        toWindowName: toWindow.name
      }
    });

    // Emit real-time updates
    io.to(`admin-${fromWindow.office}`).emit('queue-updated', {
      type: 'queue-transferred',
      department: fromWindow.office,
      data: {
        queueNumber: currentQueue.queueNumber,
        fromWindowId,
        toWindowId,
        fromWindowName: fromWindow.name,
        toWindowName: toWindow.name,
        customerName: currentQueue.visitationFormId?.customerName,
        role: currentQueue.role,
        idNumber: currentQueue.visitationFormId?.idNumber || currentQueue.idNumber || '',
        status: 'waiting'
      }
    });

    // Also emit to kiosk room for public display updates
    io.to('kiosk').emit('queue-updated', {
      type: 'queue-transferred',
      department: fromWindow.office,
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

    await AuditService.logQueue({
      user: req.user,
      action: 'QUEUE_TRANSFER',
      queueId: null,
      queueNumber: null,
      department: 'unknown',
      req,
      success: false,
      errorMessage: error.message
    });

    res.status(500).json({
      error: 'Failed to transfer queue',
      message: error.message
    });
  }
};

// POST /api/public/queue/skip - Skip current queue and call next
exports.skipQueue = async (req, res, next) => {
  try {
    const { windowId, adminId } = req.body;
    const io = req.app.get('io');

    logger('⏭️ SKIP queue request:', { windowId, adminId });

    if (!windowId) {
      return res.status(400).json({
        error: 'Window ID is required'
      });
    }

    // Get window information
    const window = await Window.findById(windowId).lean();

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
      await AuditService.logQueue({
        user: req.user,
        action: 'QUEUE_SKIP',
        queueId: null,
        queueNumber: null,
        department: window.office,
        req,
        success: false,
        errorMessage: 'No queue currently being served at this window'
      });

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
    const serviceIds = window.serviceIds.map(s => s._id ? s._id : s);
    const isPriorityWindow = window.name === 'Priority';

    // IMPORTANT: Filter by windowId to ensure each window only calls its own assigned queues
    const nextQueue = await Queue.findOne({
      office: window.office,
      windowId: windowId,
      serviceId: { $in: serviceIds },
      status: 'waiting',
      isPriority: isPriorityWindow
    }).sort({ queuedAt: 1 }).populate('visitationFormId');

    let nextQueueData = null;
    if (nextQueue) {
      await nextQueue.markAsServing(windowId, adminId);
      const displayCustomerName = await getDisplayCustomerName(nextQueue);
      nextQueueData = {
        queueNumber: nextQueue.queueNumber,
        customerName: displayCustomerName,
        role: nextQueue.role,
        idNumber: nextQueue.visitationFormId?.idNumber || nextQueue.idNumber || ''
      };
    }

    logger('✅ Queue skipped and next called:', {
      skippedQueue: currentQueue.queueNumber,
      nextQueue: nextQueueData?.queueNumber || 'None'
    });

    // Log successful skip
    await AuditService.logQueue({
      user: req.user,
      action: 'QUEUE_SKIP',
      queueId: currentQueue._id,
      queueNumber: currentQueue.queueNumber,
      department: window.office,
      req,
      success: true,
      metadata: {
        windowId: window._id,
        windowName: window.name,
        nextQueueNumber: nextQueueData?.queueNumber || null
      }
    });

    // Emit real-time updates
    io.to(`admin-${window.office}`).emit('queue-updated', {
      type: 'queue-skipped',
      department: window.office,
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

    await AuditService.logQueue({
      user: req.user,
      action: 'QUEUE_SKIP',
      queueId: null,
      queueNumber: null,
      department: 'unknown',
      req,
      success: false,
      errorMessage: error.message
    });

    res.status(500).json({
      error: 'Failed to skip queue',
      message: error.message
    });
  }
};

// POST /api/public/queue/requeue-all - Re-queue all skipped queues for a window/service
exports.requeueAllSkipped = async (req, res, next) => {
  try {
    const { windowId, adminId } = req.body;
    const io = req.app.get('io');

    logger('🔄 RE-QUEUE ALL request:', { windowId, adminId });

    if (!windowId) {
      return res.status(400).json({
        error: 'Window ID is required'
      });
    }

    // Get window information
    const window = await Window.findById(windowId).populate('serviceIds', 'name').lean();

    if (!window) {
      return res.status(404).json({
        error: 'Window not found'
      });
    }

    // Get today's date boundaries to filter only today's skipped queues
    const { getPhilippineDayBoundaries, getPhilippineDateString } = require('../utils/philippineTimezone');
    const todayString = getPhilippineDateString();
    const { startOfDay } = getPhilippineDayBoundaries(todayString);

    // Find all skipped queues for any of this window's services from TODAY only
    const serviceIds = (window.serviceIds && Array.isArray(window.serviceIds) && window.serviceIds.length > 0)
      ? window.serviceIds.map(s => {
          return s._id ? s._id : s;
        })
      : [];

    if (serviceIds.length === 0) {
      return res.status(400).json({
        error: 'Window has no services assigned'
      });
    }
    const skippedQueues = await Queue.find({
      office: window.office,
      serviceId: { $in: serviceIds },
      status: 'skipped',
      skippedAt: { $gte: startOfDay }
    }).sort({ skippedAt: 1 }).lean();

    if (skippedQueues.length === 0) {
      await AuditService.logQueue({
        user: req.user,
        action: 'QUEUE_REQUEUE_ALL',
        queueId: window._id,
        queueNumber: null,
        department: window.office,
        req,
        success: false,
        errorMessage: 'No skipped queues from today found for this service'
      });

      return res.status(404).json({
        error: 'No skipped queues from today found for this service'
      });
    }

    const currentTime = new Date();
    const requeuedCount = skippedQueues.length;

    // Update all skipped queues from TODAY to waiting status with new timestamps
    await Queue.updateMany(
      {
        office: window.office,
        serviceId: { $in: serviceIds },
        status: 'skipped',
        skippedAt: { $gte: startOfDay }
      },
      {
        status: 'waiting',
        queuedAt: currentTime,
        skippedAt: null
      }
    );

    logger('✅ Re-queued all skipped queues:', {
      count: requeuedCount,
      department: window.office,
      services: window.serviceIds.map(s => s.name || s).join(', ')
    });

    // Log successful requeue-all
    await AuditService.logQueue({
      user: req.user,
      action: 'QUEUE_REQUEUE_ALL',
      queueId: window._id,
      queueNumber: null,
      department: window.office,
      req,
      success: true,
      metadata: {
        windowId: window._id,
        windowName: window.name,
        requeuedCount
      }
    });

    // Emit real-time updates
    io.to(`admin-${window.office}`).emit('queue-updated', {
      type: 'queue-requeued-all',
      department: window.office,
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
      department: window.office,
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
        department: window.office
      }
    });

  } catch (error) {
    console.error('❌ RE-QUEUE ALL error:', error);

    await AuditService.logQueue({
      user: req.user,
      action: 'QUEUE_REQUEUE_ALL',
      queueId: req.body.windowId || null,
      queueNumber: null,
      department: 'unknown',
      req,
      success: false,
      errorMessage: error.message
    });

    res.status(500).json({
      error: 'Failed to re-queue skipped queues',
      message: error.message
    });
  }
};

// POST /api/public/queue/requeue-selected - Re-queue selected skipped queue numbers
exports.requeueSelectedSkipped = async (req, res, next) => {
  try {
    const { windowId, adminId, queueNumbers } = req.body;
    const io = req.app.get('io');

    logger('🔄 RE-QUEUE SELECTED request:', { windowId, adminId, queueNumbers });

    if (!windowId) {
      return res.status(400).json({
        error: 'Window ID is required'
      });
    }

    if (!queueNumbers || !Array.isArray(queueNumbers) || queueNumbers.length === 0) {
      return res.status(400).json({
        error: 'Queue numbers array is required and must not be empty'
      });
    }

    // Get window information
    const window = await Window.findById(windowId).populate('serviceIds', 'name').lean();

    if (!window) {
      return res.status(404).json({
        error: 'Window not found'
      });
    }

    // Get today's date boundaries to filter only today's skipped queues
    const { getPhilippineDayBoundaries, getPhilippineDateString } = require('../utils/philippineTimezone');
    const todayString = getPhilippineDateString();
    const { startOfDay } = getPhilippineDayBoundaries(todayString);

    // Find selected skipped queues for this window's services from TODAY only
    const serviceIds = (window.serviceIds && Array.isArray(window.serviceIds) && window.serviceIds.length > 0)
      ? window.serviceIds.map(s => {
          return s._id ? s._id : s;
        })
      : [];

    if (serviceIds.length === 0) {
      return res.status(400).json({
        error: 'Window has no services assigned'
      });
    }
    const skippedQueues = await Queue.find({
      office: window.office,
      serviceId: { $in: serviceIds },
      status: 'skipped',
      queueNumber: { $in: queueNumbers },
      skippedAt: { $gte: startOfDay }
    }).sort({ skippedAt: 1 }).lean();

    if (skippedQueues.length === 0) {
      await AuditService.logQueue({
        user: req.user,
        action: 'QUEUE_REQUEUE_SELECTED',
        queueId: window._id,
        queueNumber: null,
        department: window.office,
        req,
        success: false,
        errorMessage: 'No matching skipped queues from today found'
      });

      return res.status(404).json({
        error: 'No matching skipped queues from today found'
      });
    }

    const currentTime = new Date();
    const requeuedCount = skippedQueues.length;

    // Update selected skipped queues to waiting status with new timestamps
    await Queue.updateMany(
      {
        office: window.office,
        serviceId: { $in: serviceIds },
        status: 'skipped',
        queueNumber: { $in: queueNumbers },
        skippedAt: { $gte: startOfDay }
      },
      {
        status: 'waiting',
        queuedAt: currentTime,
        skippedAt: null
      }
    );

    logger('✅ Re-queued selected skipped queues:', {
      count: requeuedCount,
      queueNumbers,
      department: window.office,
      services: window.serviceIds.map(s => s.name || s).join(', ')
    });

    // Log successful requeue-selected
    await AuditService.logQueue({
      user: req.user,
      action: 'QUEUE_REQUEUE_SELECTED',
      queueId: window._id,
      queueNumber: null,
      department: window.office,
      req,
      success: true,
      metadata: {
        windowId: window._id,
        windowName: window.name,
        requeuedCount,
        queueNumbers
      }
    });

    // Emit real-time updates
    io.to(`admin-${window.office}`).emit('queue-updated', {
      type: 'queue-requeued-selected',
      department: window.office,
      windowId,
      data: {
        requeuedCount,
        queueNumbers,
        windowName: window.name,
        serviceName: window.serviceIds && window.serviceIds.length > 0
          ? window.serviceIds.map(s => s.name || s).join(', ')
          : 'No services assigned'
      }
    });

    // Also emit to kiosk room for public display updates
    io.to('kiosk').emit('queue-updated', {
      type: 'queue-requeued-selected',
      department: window.office,
      data: {
        requeuedCount,
        queueNumbers
      }
    });

    res.json({
      success: true,
      message: `${requeuedCount} queue${requeuedCount > 1 ? 's' : ''} re-queued successfully`,
      data: {
        requeuedCount,
        queueNumbers,
        windowName: window.name,
        serviceName: window.serviceIds && window.serviceIds.length > 0
          ? window.serviceIds.map(s => s.name || s).join(', ')
          : 'No services assigned',
        department: window.office
      }
    });

  } catch (error) {
    console.error('❌ RE-QUEUE SELECTED error:', error);

    await AuditService.logQueue({
      user: req.user,
      action: 'QUEUE_REQUEUE_SELECTED',
      queueId: req.body.windowId || null,
      queueNumber: null,
      department: 'unknown',
      req,
      success: false,
      errorMessage: error.message
    });

    res.status(500).json({
      error: 'Failed to re-queue selected queues',
      message: error.message
    });
  }
};

// GET /api/public/queue/windows/:department - Get available windows for transfer
exports.getWindowsForTransfer = async (req, res, next) => {
  try {
    const { department } = req.params;

    logger('🪟 Fetching windows for transfer:', { department });

    const windows = await Window.find({
      office: department,
      isOpen: true
    }).select('_id name serviceIds').populate('serviceIds', 'name isSpecialRequest').lean();

    res.json({
      success: true,
      data: windows.map(window => {
        // Filter out Special Request services from serviceName
        const regularServices = window.serviceIds && window.serviceIds.length > 0
          ? window.serviceIds.filter(s => !s.isSpecialRequest)
          : [];

        return {
          id: window._id,
          name: window.name,
          serviceName: regularServices.length > 0
            ? regularServices.map(s => s.name).join(', ')
            : 'No services assigned'
        };
      })
    });

  } catch (error) {
    console.error('❌ Error fetching windows:', error);
    res.status(500).json({
      error: 'Failed to fetch windows',
      message: error.message
    });
  }
};

// GET /api/public/bulletin - Get all bulletins for kiosk display
exports.getBulletins = async (req, res, next) => {
  try {
    const { Bulletin } = require('../models');

    // Always enforce pagination with safe defaults and maximum limit
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 100)); // Default 100, max 100
    const skip = (page - 1) * limit;

    const query = Bulletin.find().sort({ createdAt: -1 }).skip(skip).limit(limit);
    const bulletins = await query.lean();
    const totalCount = await Bulletin.countDocuments();
    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      success: true,
      records: bulletins,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit
      }
    });
  } catch (error) {
    console.error('Error fetching bulletins:', error);
    res.status(500).json({
      error: 'Failed to fetch bulletins',
      message: error.message
    });
  }
};

// GET /api/public/faq - Get all active FAQs for kiosk display (with enforced pagination)
exports.getFAQs = async (req, res, next) => {
  try {
    const FAQ = require('../models/FAQ');

    // Always enforce pagination with safe defaults and maximum limit
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 100)); // Default 100, max 100
    const skip = (page - 1) * limit;

    const query = FAQ.find({
      status: 'active',
      isActive: true
    })
      .select('question answer category order')
      .sort({ category: 1, order: 1, createdAt: 1 })
      .skip(skip)
      .limit(limit);

    const faqs = await query.lean();
    const total = await FAQ.countDocuments({
      status: 'active',
      isActive: true
    });

    res.json({
      success: true,
      data: faqs,
      count: faqs.length,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching FAQs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch FAQs',
      message: error.message
    });
  }
};

// GET /api/public/office - Get all offices for directory display (with optional pagination)
exports.getOffices = async (req, res, next) => {
  try {
    const { Office } = require('../models');

    // Optional pagination parameters
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 100)); // Default 100, max 100
    const skip = (page - 1) * limit;

    // Get total count for pagination metadata
    const totalCount = await Office.countDocuments();

    // Fetch offices with pagination (if limit is set to a reasonable value)
    // For small datasets, if no pagination is requested, return all
    const query = Office.find().sort({ name: 1 });

    // Only apply pagination if explicitly requested or if dataset might be large
    if (req.query.page || req.query.limit || totalCount > 100) {
      query.skip(skip).limit(limit);
    }

    const offices = await query.lean();
    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      success: true,
      records: offices,
      count: offices.length,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching offices:', error);
    res.status(500).json({
      error: 'Failed to fetch offices',
      message: error.message
    });
  }
};

// GET /api/public/chart - Get all charts for directory display
exports.getCharts = async (req, res, next) => {
  try {
    const { Chart } = require('../models');
    const charts = await Chart.find()
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      records: charts,
      count: charts.length
    });
  } catch (error) {
    console.error('Error fetching charts:', error);
    res.status(500).json({
      error: 'Failed to fetch charts',
      message: error.message
    });
  }
};

// Export helper function for use in other controller functions
exports.getDisplayCustomerName = getDisplayCustomerName;

