const DocumentRequest = require('../models/DocumentRequest');
const { generateTransactionNo } = require('../utils/transactionNoGenerator');
const { getBusinessDaysForRequestTypes, calculateClaimDate, formatClaimDate } = require('../config/businessDays');
const emailService = require('../services/emailService');
const {
  validateDateString,
  getPhilippineDayBoundaries,
  formatPhilippineDateTime
} = require('../utils/philippineTimezone');

// GET /api/document-requests/registrar - Get document requests with pagination and filters
exports.getDocumentRequests = async (req, res, next) => {
  try {
    const {
      date,
      page = 1,
      limit = 20,
      search,
      filterBy
    } = req.query;

    // Validate and parse pagination params
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Build base query filter
    let queryFilter = {};

    // Add date filter if provided
    if (date) {
      const validation = validateDateString(date);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: validation.error
        });
      }

      try {
        const { startOfDay, endOfDay } = getPhilippineDayBoundaries(date);
        queryFilter.dateOfRequest = {
          $gte: startOfDay,
          $lte: endOfDay
        };
      } catch (error) {
        console.error('Error processing date filter:', error);
        return res.status(400).json({
          success: false,
          error: 'Invalid date format'
        });
      }
    }

    // Add status filter if provided
    if (filterBy && filterBy !== 'all') {
      if (['pending', 'approved', 'rejected'].includes(filterBy)) {
        queryFilter.status = filterBy;
      }
    }

    // Build aggregation pipeline for search and pagination
    const pipeline = [
      { $match: queryFilter }
    ];

    // Add search filter if provided
    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      pipeline.push({
        $match: {
          $or: [
            { transactionNo: searchRegex },
            { name: searchRegex },
            { emailAddress: searchRegex },
            { contactNumber: searchRegex },
            { programGradeStrand: searchRegex }
          ]
        }
      });
    }

    // Add sorting
    pipeline.push({ $sort: { dateOfRequest: -1 } });

    // Get total count before pagination
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await DocumentRequest.aggregate(countPipeline);
    const totalCount = countResult.length > 0 ? countResult[0].total : 0;

    // Add pagination
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limitNum });

    // Execute aggregation
    const documentRequests = await DocumentRequest.aggregate(pipeline);

    // Format response
    const formattedRequests = documentRequests.map(request => ({
      id: request._id,
      transactionNo: request.transactionNo,
      name: request.name,
      lastSYAttended: request.lastSYAttended,
      programGradeStrand: request.programGradeStrand,
      contactNumber: request.contactNumber,
      emailAddress: request.emailAddress,
      request: request.request,
      dateOfRequest: request.dateOfRequest,
      status: request.status,
      approvedAt: request.approvedAt,
      rejectedAt: request.rejectedAt,
      businessDays: request.businessDays,
      claimDate: request.claimDate,
      claimedAt: request.claimedAt,
      remarks: request.remarks
    }));

    const totalPages = Math.ceil(totalCount / limitNum);

    res.json({
      success: true,
      data: formattedRequests,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        limit: limitNum
      }
    });
  } catch (error) {
    console.error('Error fetching document requests:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch document requests'
    });
  }
};

// GET /api/document-requests/registrar/:id - Get single document request
exports.getDocumentRequestById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Use .lean() for read-only operation to improve performance
    const documentRequest = await DocumentRequest.findById(id).lean();

    if (!documentRequest) {
      return res.status(404).json({
        success: false,
        error: 'Document request not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: documentRequest._id,
        transactionNo: documentRequest.transactionNo,
        name: documentRequest.name,
        lastSYAttended: documentRequest.lastSYAttended,
        programGradeStrand: documentRequest.programGradeStrand,
        contactNumber: documentRequest.contactNumber,
        emailAddress: documentRequest.emailAddress,
        request: documentRequest.request,
        dateOfRequest: documentRequest.dateOfRequest,
        status: documentRequest.status,
        approvedAt: documentRequest.approvedAt,
        rejectedAt: documentRequest.rejectedAt,
        businessDays: documentRequest.businessDays,
        claimDate: documentRequest.claimDate,
        claimedAt: documentRequest.claimedAt,
        remarks: documentRequest.remarks,
        createdAt: documentRequest.createdAt,
        updatedAt: documentRequest.updatedAt
      }
    });
  } catch (error) {
    console.error('Error fetching document request:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch document request'
    });
  }
};

// POST /api/public/document-request - Create document request from kiosk
exports.createDocumentRequest = async (req, res, next) => {
  try {
    const {
      name,
      lastSYAttended,
      programGradeStrand,
      contactNumber,
      emailAddress,
      request
    } = req.body;

    // Validate required fields
    if (!name || !lastSYAttended || !programGradeStrand || !contactNumber || !emailAddress || !request) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required'
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

    res.status(201).json({
      success: true,
      data: {
        id: documentRequest._id,
        transactionNo: documentRequest.transactionNo,
        message: 'Document request submitted successfully'
      }
    });
  } catch (error) {
    console.error('Error creating document request:', error);

    // Handle duplicate transaction number (shouldn't happen, but just in case)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: 'Transaction number conflict. Please try again.'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create document request'
    });
  }
};

// PATCH /api/document-requests/registrar/:id/approve - Approve document request
exports.approveDocumentRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { businessDays } = req.body;

    const documentRequest = await DocumentRequest.findById(id);

    if (!documentRequest) {
      return res.status(404).json({
        success: false,
        error: 'Document request not found'
      });
    }

    if (documentRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Document request is already ${documentRequest.status}`
      });
    }

    // Calculate business days (use provided value or calculate from request types)
    let finalBusinessDays = businessDays;
    if (!finalBusinessDays) {
      finalBusinessDays = getBusinessDaysForRequestTypes(documentRequest.request);
    }

    // Ensure business days is within valid range
    if (finalBusinessDays < 3 || finalBusinessDays > 5) {
      finalBusinessDays = Math.max(3, Math.min(5, finalBusinessDays));
    }

    // Calculate claim date
    const approvalDate = new Date();
    const claimDate = calculateClaimDate(approvalDate, finalBusinessDays);

    // Update document request
    documentRequest.status = 'approved';
    documentRequest.approvedAt = approvalDate;
    documentRequest.businessDays = finalBusinessDays;
    documentRequest.claimDate = claimDate;

    await documentRequest.save();

    // Send approval email
    try {
      await emailService.sendDocumentRequestApprovalEmail({
        transactionNo: documentRequest.transactionNo,
        name: documentRequest.name,
        emailAddress: documentRequest.emailAddress,
        request: documentRequest.request,
        businessDays: finalBusinessDays,
        claimDate: claimDate,
        formattedClaimDate: formatClaimDate(claimDate),
        lastSYAttended: documentRequest.lastSYAttended,
        programGradeStrand: documentRequest.programGradeStrand,
        contactNumber: documentRequest.contactNumber
      });
    } catch (emailError) {
      console.error('Error sending approval email:', emailError);
      // Don't fail the approval if email fails, but log it
    }

    res.json({
      success: true,
      data: {
        id: documentRequest._id,
        transactionNo: documentRequest.transactionNo,
        status: documentRequest.status,
        businessDays: documentRequest.businessDays,
        claimDate: documentRequest.claimDate,
        message: 'Document request approved successfully'
      }
    });
  } catch (error) {
    console.error('Error approving document request:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to approve document request'
    });
  }
};

// PATCH /api/document-requests/registrar/:id/reject - Reject document request
exports.rejectDocumentRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rejectionReasons } = req.body;

    const documentRequest = await DocumentRequest.findById(id);

    if (!documentRequest) {
      return res.status(404).json({
        success: false,
        error: 'Document request not found'
      });
    }

    if (documentRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Document request is already ${documentRequest.status}`
      });
    }

    // Validate rejection reasons
    if (!rejectionReasons || !Array.isArray(rejectionReasons) || rejectionReasons.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one rejection reason is required'
      });
    }

    // Format rejection reasons as a string for storage
    const remarksText = rejectionReasons.join('; ');

    // Update document request
    documentRequest.status = 'rejected';
    documentRequest.rejectedAt = new Date();
    documentRequest.remarks = remarksText;

    await documentRequest.save();

    // Send rejection email
    const emailService = require('../services/emailService');
    try {
      await emailService.sendDocumentRequestRejectionEmail({
        transactionNo: documentRequest.transactionNo,
        name: documentRequest.name,
        emailAddress: documentRequest.emailAddress,
        request: documentRequest.request,
        rejectionReasons: rejectionReasons,
        lastSYAttended: documentRequest.lastSYAttended,
        programGradeStrand: documentRequest.programGradeStrand,
        contactNumber: documentRequest.contactNumber
      });
    } catch (emailError) {
      console.error('Error sending rejection email:', emailError);
      // Don't fail the rejection if email fails, but log it
    }

    res.json({
      success: true,
      data: {
        id: documentRequest._id,
        transactionNo: documentRequest.transactionNo,
        status: documentRequest.status,
        message: 'Document request rejected successfully'
      }
    });
  } catch (error) {
    console.error('Error rejecting document request:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to reject document request'
    });
  }
};

// POST /api/document-requests/registrar - Create document request from admin side (auto-approved)
exports.createAdminDocumentRequest = async (req, res, next) => {
  try {
    const {
      name,
      lastSYAttended,
      programGradeStrand,
      contactNumber,
      emailAddress,
      request,
      remarks
    } = req.body;

    // Validate required fields
    if (!name || !lastSYAttended || !programGradeStrand || !contactNumber || !emailAddress || !request) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required'
      });
    }

    // Validate request is an array with at least one item
    if (!Array.isArray(request) || request.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one request type must be selected'
      });
    }

    // Validate document types
    const validDocumentTypes = [
      'Certificate of Enrollment',
      'Form 137',
      'Transcript of Records',
      'Good Moral Certificate',
      'Certified True Copy of Documents',
      'Education Service Contracting Certificate (ESC)'
    ];
    const invalidDocuments = request.filter(doc => !validDocumentTypes.includes(doc));
    if (invalidDocuments.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Invalid document type(s): ${invalidDocuments.join(', ')}`
      });
    }

    // Generate unique transaction number
    const transactionNo = await generateTransactionNo();

    // Calculate business days and claim date for auto-approved requests
    const finalBusinessDays = 5; // Default for admin-created requests
    const approvalDate = new Date();
    const claimDate = calculateClaimDate(approvalDate, finalBusinessDays);

    // Create document request - auto-approve admin-created requests
    const documentRequest = new DocumentRequest({
      transactionNo,
      name: name.trim(),
      lastSYAttended: lastSYAttended.trim(),
      programGradeStrand: programGradeStrand.trim(),
      contactNumber: contactNumber.trim(),
      emailAddress: emailAddress.trim().toLowerCase(),
      request: request,
      remarks: remarks ? remarks.trim() : '',
      status: 'approved', // Auto-approve admin-created requests
      approvedAt: approvalDate,
      businessDays: finalBusinessDays,
      claimDate: claimDate
    });

    await documentRequest.save();

    // Send approval email notification
    try {
      await emailService.sendDocumentRequestApprovalEmail({
        transactionNo: documentRequest.transactionNo,
        name: documentRequest.name,
        emailAddress: documentRequest.emailAddress,
        request: documentRequest.request,
        claimDate: formatClaimDate(claimDate),
        lastSYAttended: documentRequest.lastSYAttended,
        programGradeStrand: documentRequest.programGradeStrand,
        contactNumber: documentRequest.contactNumber
      });
    } catch (emailError) {
      console.error('Error sending approval email:', emailError);
      // Don't fail the creation if email fails, but log it
    }

    res.status(201).json({
      success: true,
      data: {
        id: documentRequest._id,
        transactionNo: documentRequest.transactionNo,
        message: 'Document request created and approved successfully'
      }
    });
  } catch (error) {
    console.error('Error creating admin document request:', error);

    // Handle duplicate transaction number (shouldn't happen, but just in case)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: 'Transaction number conflict. Please try again.'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create document request'
    });
  }
};
