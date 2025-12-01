const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  office: {
    type: String,
    enum: ['registrar', 'admissions'],
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Special Request flag - marks services created as Special Requests
  isSpecialRequest: {
    type: Boolean,
    default: false
  },
  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for better query performance
serviceSchema.index({ office: 1, isActive: 1 });
serviceSchema.index({ name: 1, office: 1 }, { unique: true });

// Static method to get services by office
serviceSchema.statics.getByOffice = function(office, activeOnly = true) {
  const query = { office };
  if (activeOnly) {
    query.isActive = true;
  }
  return this.find(query).sort({ name: 1 });
};

module.exports = mongoose.model('Service', serviceSchema);
