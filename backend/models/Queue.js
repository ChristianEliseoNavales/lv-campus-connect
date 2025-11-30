const mongoose = require('mongoose');

const queueSchema = new mongoose.Schema({
  queueNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 99
  },
  office: {
    type: String,
    enum: ['registrar', 'admissions'],
    required: true
  },
  windowId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Window'
  },
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  // Visitation Form Reference (optional for Enroll service)
  visitationFormId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VisitationForm',
    required: false // Made optional to support Enroll service which doesn't require visitation form
  },
  idNumber: {
    type: String,
    trim: true,
    maxlength: 50
  },
  // Queue Details
  role: {
    type: String,
    enum: ['Visitor', 'Student', 'Teacher', 'Alumni'],
    required: true
  },
  studentStatus: {
    type: String,
    enum: ['incoming_new', 'continuing'],
    required: false // Will be validated in the route based on service type
  },

  isPriority: {
    type: Boolean,
    default: false
  },
  // Status Management
  status: {
    type: String,
    enum: ['waiting', 'serving', 'completed', 'skipped', 'cancelled', 'no-show'],
    default: 'waiting'
  },
  isCurrentlyServing: {
    type: Boolean,
    default: false
  },
  // Timestamps
  queuedAt: {
    type: Date,
    default: Date.now
  },
  calledAt: {
    type: Date
  },
  servedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  skippedAt: {
    type: Date
  },
  // Estimated wait time in minutes
  estimatedWaitTime: {
    type: Number,
    default: 0
  },
  // Feedback
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  // Admin remarks for transaction logs
  remarks: {
    type: String,
    trim: true,
    maxlength: 500,
    default: ''
  },
  // Admin who processed the queue
  processedBy: {
    type: mongoose.Schema.Types.Mixed, // Allow any type for now
    ref: 'User',
    required: false,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for better query performance
queueSchema.index({ office: 1, status: 1 });
queueSchema.index({ queueNumber: 1, office: 1 });
queueSchema.index({ status: 1, queuedAt: 1 });
queueSchema.index({ windowId: 1, status: 1 });
queueSchema.index({ isCurrentlyServing: 1 });
queueSchema.index({ visitationFormId: 1 }); // Index for visitation form lookups

// Compound indexes for dashboard analytics optimization
queueSchema.index({ office: 1, queuedAt: 1 }); // For date range queries by office
queueSchema.index({ office: 1, status: 1, queuedAt: 1 }); // Compound for aggregations
queueSchema.index({ serviceId: 1, office: 1 }); // For service distribution queries
queueSchema.index({ windowId: 1, status: 1, queuedAt: 1 }); // For window-specific queries
queueSchema.index({ rating: 1 }); // For rating summary queries

// Additional indexes for optimized query patterns
queueSchema.index({ serviceId: 1, status: 1 }); // For service filtering by status
queueSchema.index({ office: 1, status: 1, isPriority: 1 }); // For priority filtering
queueSchema.index({ queuedAt: 1 }); // For date range queries without office filter
queueSchema.index({ windowId: 1, status: 1, isCurrentlyServing: 1 }); // For window serving queries

// Static method to get next queue number for an office
queueSchema.statics.getNextQueueNumber = async function(office) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Find the highest queue number for today in this office
  const lastQueue = await this.findOne({
    office,
    createdAt: { $gte: today, $lt: tomorrow }
  }).sort({ queueNumber: -1 });

  if (!lastQueue) {
    return 1; // Start from 1 if no queues today
  }

  // If we've reached 99, cycle back to 1
  return lastQueue.queueNumber >= 99 ? 1 : lastQueue.queueNumber + 1;
};

// Static method to get current serving number for an office
queueSchema.statics.getCurrentServingNumber = async function(office, windowId = null) {
  const query = {
    office,
    isCurrentlyServing: true,
    status: 'serving'
  };

  if (windowId) {
    query.windowId = windowId;
  }

  const currentServing = await this.findOne(query);
  return currentServing ? currentServing.queueNumber : 0;
};

// Static method to get waiting queue for an office
queueSchema.statics.getWaitingQueue = async function(office, windowId = null) {
  const query = {
    office,
    status: 'waiting'
  };

  if (windowId) {
    query.windowId = windowId;
  }

  return this.find(query)
    .sort({ queuedAt: 1 });
};

// Instance method to mark as serving
queueSchema.methods.markAsServing = async function(windowId, processedBy) {
  // First, unmark any other queue as currently serving for this window
  await this.constructor.updateMany(
    { windowId, isCurrentlyServing: true },
    { isCurrentlyServing: false }
  );

  this.status = 'serving';
  this.isCurrentlyServing = true;
  this.windowId = windowId;

  // Set processedBy (now accepts any type)
  if (processedBy) {
    this.processedBy = processedBy;
  }

  this.calledAt = new Date();

  return this.save();
};

// Instance method to mark as completed
queueSchema.methods.markAsCompleted = async function(rating = null, feedback = null) {
  this.status = 'completed';
  this.isCurrentlyServing = false;
  this.completedAt = new Date();

  if (rating) this.rating = rating;
  if (feedback) this.feedback = feedback;

  return this.save();
};

module.exports = mongoose.model('Queue', queueSchema);
