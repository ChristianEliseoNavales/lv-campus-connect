const mongoose = require('mongoose');

const chartSchema = new mongoose.Schema({
  // Office reference
  officeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Office',
    required: true
  },
  officeName: {
    type: String,
    required: true,
    trim: true
  },
  // Image information (Cloudinary)
  image: {
    // Cloudinary-specific fields
    public_id: {
      type: String,
      required: true,
      trim: true
    },
    secure_url: {
      type: String,
      required: true,
      trim: true
    },
    url: {
      type: String,
      required: true,
      trim: true
    },
    resource_type: {
      type: String,
      enum: ['image'],
      default: 'image'
    },
    // Legacy fields (for backward compatibility)
    filename: {
      type: String,
      trim: true
    },
    originalName: {
      type: String,
      trim: true
    },
    size: {
      type: Number
    },
    mimeType: {
      type: String,
      trim: true
    }
  },
  // Audit fields
  uploadedBy: {
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
chartSchema.index({ officeId: 1 });
chartSchema.index({ officeName: 1 });

// Static method to get chart by office
chartSchema.statics.getByOffice = function(officeId) {
  return this.findOne({ officeId }).populate('officeId', 'officeName officeEmail');
};

// Static method to get chart by office name
chartSchema.statics.getByOfficeName = function(officeName) {
  return this.findOne({ officeName });
};

module.exports = mongoose.model('Chart', chartSchema);

