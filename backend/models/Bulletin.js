const mongoose = require('mongoose');

const bulletinSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  summary: {
    type: String,
    trim: true,
    maxlength: 500
  },
  // Image information (Cloudinary)
  image: {
    // Cloudinary-specific fields
    public_id: {
      type: String,
      trim: true
    },
    secure_url: {
      type: String,
      trim: true
    },
    url: {
      type: String,
      trim: true
    },
    resource_type: {
      type: String,
      enum: ['image', 'video', 'raw'],
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
    path: {
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
  // Publication details
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  publishedAt: {
    type: Date
  },
  expiresAt: {
    type: Date
  },
  // Categorization
  category: {
    type: String,
    enum: ['General', 'Academic', 'Administrative', 'Events', 'Announcements', 'Emergency', 'Other'],
    default: 'General'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  // Target audience
  targetAudience: [{
    type: String,
    enum: ['all', 'students', 'faculty', 'staff', 'visitors', 'alumni']
  }],
  // Visibility settings
  isVisible: {
    type: Boolean,
    default: true
  },
  showOnHomepage: {
    type: Boolean,
    default: false
  },
  showOnBulletinBoard: {
    type: Boolean,
    default: true
  },
  // Display settings
  displayOrder: {
    type: Number,
    default: 0
  },
  featuredUntil: {
    type: Date
  },
  // Engagement metrics
  views: {
    type: Number,
    default: 0
  },
  likes: {
    type: Number,
    default: 0
  },
  // Tags for search and filtering
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  // Author information
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Made optional to support system-generated bulletins
  },
  authorName: {
    type: String,
    required: true,
    trim: true
  },
  authorEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  // Approval workflow
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  rejectionReason: {
    type: String,
    trim: true
  },
  // Version control
  version: {
    type: Number,
    default: 1
  },
  previousVersions: [{
    version: Number,
    title: String,
    content: String,
    updatedAt: Date,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  // SEO and metadata
  slug: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    lowercase: true
  },
  metaDescription: {
    type: String,
    trim: true,
    maxlength: 160
  },
  keywords: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  // Scheduling
  scheduledPublishAt: {
    type: Date
  },
  autoArchiveAt: {
    type: Date
  },
  // Comments and feedback
  allowComments: {
    type: Boolean,
    default: false
  },
  comments: [{
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    content: {
      type: String,
      required: true,
      trim: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    isApproved: {
      type: Boolean,
      default: false
    }
  }],
  // Audit fields
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for better query performance
bulletinSchema.index({ status: 1, publishedAt: -1 });
bulletinSchema.index({ category: 1, status: 1 });
bulletinSchema.index({ priority: 1, publishedAt: -1 });
bulletinSchema.index({ author: 1, createdAt: -1 });
bulletinSchema.index({ tags: 1 });
// Note: slug index is automatically created by unique: true
bulletinSchema.index({ expiresAt: 1 });
bulletinSchema.index({ showOnHomepage: 1, status: 1 });
bulletinSchema.index({ displayOrder: 1, publishedAt: -1 });

// Generate slug from title before saving
bulletinSchema.pre('save', function(next) {
  if (this.isModified('title') && !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  next();
});

// Static method to get published bulletins
bulletinSchema.statics.getPublished = function(limit = 10, skip = 0) {
  return this.find({
    status: 'published',
    isVisible: true,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  })
  .populate('author', 'name email')
  .sort({ displayOrder: -1, publishedAt: -1 })
  .limit(limit)
  .skip(skip);
};

// Static method to get homepage bulletins
bulletinSchema.statics.getHomepageBulletins = function(limit = 5) {
  return this.find({
    status: 'published',
    isVisible: true,
    showOnHomepage: true,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  })
  .populate('author', 'name email')
  .sort({ displayOrder: -1, publishedAt: -1 })
  .limit(limit);
};

// Static method to get bulletins by category
bulletinSchema.statics.getByCategory = function(category, limit = 10, skip = 0) {
  return this.find({
    category,
    status: 'published',
    isVisible: true,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  })
  .populate('author', 'name email')
  .sort({ displayOrder: -1, publishedAt: -1 })
  .limit(limit)
  .skip(skip);
};

// Instance method to publish bulletin
bulletinSchema.methods.publish = function(publishedBy) {
  this.status = 'published';
  this.publishedAt = new Date();
  this.approvalStatus = 'approved';
  this.approvedBy = publishedBy;
  this.approvedAt = new Date();
  return this.save();
};

// Instance method to archive bulletin
bulletinSchema.methods.archive = function() {
  this.status = 'archived';
  return this.save();
};

// Instance method to increment views
bulletinSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save();
};

// Instance method to add comment
bulletinSchema.methods.addComment = function(authorId, content) {
  this.comments.push({
    author: authorId,
    content: content,
    createdAt: new Date(),
    isApproved: false
  });
  return this.save();
};

// Instance method to create new version
bulletinSchema.methods.createNewVersion = function(updates, updatedBy) {
  // Save current version to history
  this.previousVersions.push({
    version: this.version,
    title: this.title,
    content: this.content,
    updatedAt: new Date(),
    updatedBy: updatedBy
  });

  // Update with new content
  Object.keys(updates).forEach(key => {
    if (key !== 'version' && key !== 'previousVersions') {
      this[key] = updates[key];
    }
  });

  this.version += 1;
  this.lastUpdatedBy = updatedBy;
  
  return this.save();
};

module.exports = mongoose.model('Bulletin', bulletinSchema);
