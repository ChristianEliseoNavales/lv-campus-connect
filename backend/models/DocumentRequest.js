const mongoose = require('mongoose');

const documentRequestSchema = new mongoose.Schema({
  transactionNo: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    // Index is defined explicitly below with schema.index() to avoid duplicates
    validate: {
      validator: function(v) {
        return /^TR\d{6}-\d{3}$/.test(v);
      },
      message: 'Transaction number must be in format TR######-###'
    }
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  lastSYAttended: {
    type: String,
    required: true,
    trim: true
  },
  programGradeStrand: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  contactNumber: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^(\+63|0)[0-9]{10}$/.test(v);
      },
      message: 'Contact number must be a valid Philippine phone number'
    }
  },
  emailAddress: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Email must be valid'
    }
  },
  request: {
    type: [String],
    required: true,
    validate: {
      validator: function(v) {
        return v.length > 0;
      },
      message: 'At least one request type must be selected'
    },
    enum: {
      values: [
        'Certificate of Enrollment',
        'Form 137',
        'Transcript of Records',
        'Good Moral Certificate',
        'Certified True Copy of Documents',
        'Education Service Contracting Certificate (ESC)'
      ],
      message: 'Invalid request type'
    }
  },
  dateOfRequest: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },
  approvedAt: {
    type: Date
  },
  rejectedAt: {
    type: Date
  },
  businessDays: {
    type: Number,
    min: 3,
    max: 5
  },
  claimDate: {
    type: Date
  },
  claimedAt: {
    type: Date
  },
  remarks: {
    type: String,
    trim: true,
    maxlength: 500,
    default: ''
  }
}, {
  timestamps: true
});

// Indexes for better query performance
documentRequestSchema.index({ status: 1, dateOfRequest: -1 });
documentRequestSchema.index({ emailAddress: 1 });
documentRequestSchema.index({ dateOfRequest: -1 });
// Note: transactionNo unique index is automatically created by unique: true in schema
// Compound index for transactionNo + status queries (used in Document Claim validation)
documentRequestSchema.index({ transactionNo: 1, status: 1 });

// Static method to find by transaction number
// Uses .lean() for read-only operations to improve performance
documentRequestSchema.statics.findByTransactionNo = function(transactionNo) {
  return this.findOne({ transactionNo: transactionNo.trim().toUpperCase() }).lean();
};

// Instance method to check if request can be claimed
documentRequestSchema.methods.canBeClaimed = function() {
  return this.status === 'approved' && !this.claimedAt;
};

module.exports = mongoose.model('DocumentRequest', documentRequestSchema);

