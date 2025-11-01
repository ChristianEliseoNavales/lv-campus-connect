const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
  // Rating details
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  feedback: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  // What is being rated
  ratingType: {
    type: String,
    enum: ['service', 'window', 'overall_experience', 'staff_performance', 'system_usability'],
    required: true
  },
  // Related entities
  queueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Queue',
    required: true
  },
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service'
  },
  windowId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Window'
  },
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Customer information
  customerName: {
    type: String,
    required: true,
    trim: true
  },
  customerEmail: {
    type: String,
    trim: true,
    lowercase: true
  },
  customerRole: {
    type: String,
    enum: ['Visitor', 'Student', 'Teacher', 'Alumni'],
    required: true
  },
  // Office context
  office: {
    type: String,
    enum: ['registrar', 'admissions'],
    required: true
  },
  // Rating categories (detailed breakdown)
  categories: {
    serviceQuality: {
      type: Number,
      min: 1,
      max: 5
    },
    staffCourtesy: {
      type: Number,
      min: 1,
      max: 5
    },
    waitTime: {
      type: Number,
      min: 1,
      max: 5
    },
    facilityCondition: {
      type: Number,
      min: 1,
      max: 5
    },
    systemEaseOfUse: {
      type: Number,
      min: 1,
      max: 5
    }
  },
  // Additional feedback
  suggestions: {
    type: String,
    trim: true,
    maxlength: 500
  },
  wouldRecommend: {
    type: Boolean
  },
  // Sentiment analysis (can be populated by AI/ML service)
  sentiment: {
    type: String,
    enum: ['positive', 'neutral', 'negative'],
    default: 'neutral'
  },
  sentimentScore: {
    type: Number,
    min: -1,
    max: 1,
    default: 0
  },
  // Status and moderation
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'flagged'],
    default: 'approved'
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  isAnonymous: {
    type: Boolean,
    default: false
  },
  // Moderation details
  moderatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  moderatedAt: {
    type: Date
  },
  moderationReason: {
    type: String,
    trim: true
  },
  // Response from staff/admin
  response: {
    content: {
      type: String,
      trim: true,
      maxlength: 500
    },
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    respondedAt: {
      type: Date
    }
  },
  // Metadata
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String,
    trim: true
  },
  // Follow-up information
  followUpRequired: {
    type: Boolean,
    default: false
  },
  followUpCompleted: {
    type: Boolean,
    default: false
  },
  followUpNotes: {
    type: String,
    trim: true
  },
  // Tags for categorization
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }]
}, {
  timestamps: true
});

// Indexes for better query performance
ratingSchema.index({ office: 1, createdAt: -1 });
ratingSchema.index({ serviceId: 1, rating: -1 });
ratingSchema.index({ windowId: 1, rating: -1 });
ratingSchema.index({ staffId: 1, rating: -1 });
ratingSchema.index({ queueId: 1 });
ratingSchema.index({ rating: -1, createdAt: -1 });
ratingSchema.index({ ratingType: 1, office: 1 });
ratingSchema.index({ status: 1, isPublic: 1 });
ratingSchema.index({ sentiment: 1, createdAt: -1 });

// Static method to get average rating for a service
ratingSchema.statics.getServiceAverageRating = async function(serviceId) {
  const result = await this.aggregate([
    { $match: { serviceId: new mongoose.Types.ObjectId(serviceId), status: 'approved' } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalRatings: { $sum: 1 },
        ratingDistribution: {
          $push: '$rating'
        }
      }
    }
  ]);

  if (result.length === 0) {
    return { averageRating: 0, totalRatings: 0, ratingDistribution: [] };
  }

  const data = result[0];
  
  // Calculate rating distribution
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  data.ratingDistribution.forEach(rating => {
    distribution[rating] = (distribution[rating] || 0) + 1;
  });

  return {
    averageRating: Math.round(data.averageRating * 10) / 10,
    totalRatings: data.totalRatings,
    ratingDistribution: distribution
  };
};

// Static method to get average rating for a window
ratingSchema.statics.getWindowAverageRating = async function(windowId) {
  const result = await this.aggregate([
    { $match: { windowId: new mongoose.Types.ObjectId(windowId), status: 'approved' } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalRatings: { $sum: 1 }
      }
    }
  ]);

  return result.length > 0 ? {
    averageRating: Math.round(result[0].averageRating * 10) / 10,
    totalRatings: result[0].totalRatings
  } : { averageRating: 0, totalRatings: 0 };
};

// Static method to get office ratings summary
ratingSchema.statics.getOfficeSummary = async function(office, startDate, endDate) {
  const matchStage = { office, status: 'approved' };

  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = new Date(startDate);
    if (endDate) matchStage.createdAt.$lte = new Date(endDate);
  }

  const result = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalRatings: { $sum: 1 },
        averageServiceQuality: { $avg: '$categories.serviceQuality' },
        averageStaffCourtesy: { $avg: '$categories.staffCourtesy' },
        averageWaitTime: { $avg: '$categories.waitTime' },
        averageFacilityCondition: { $avg: '$categories.facilityCondition' },
        averageSystemEaseOfUse: { $avg: '$categories.systemEaseOfUse' },
        sentimentBreakdown: {
          $push: '$sentiment'
        }
      }
    }
  ]);

  if (result.length === 0) {
    return {
      averageRating: 0,
      totalRatings: 0,
      categories: {},
      sentimentBreakdown: { positive: 0, neutral: 0, negative: 0 }
    };
  }

  const data = result[0];
  
  // Calculate sentiment breakdown
  const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
  data.sentimentBreakdown.forEach(sentiment => {
    sentimentCounts[sentiment] = (sentimentCounts[sentiment] || 0) + 1;
  });

  return {
    averageRating: Math.round(data.averageRating * 10) / 10,
    totalRatings: data.totalRatings,
    categories: {
      serviceQuality: Math.round((data.averageServiceQuality || 0) * 10) / 10,
      staffCourtesy: Math.round((data.averageStaffCourtesy || 0) * 10) / 10,
      waitTime: Math.round((data.averageWaitTime || 0) * 10) / 10,
      facilityCondition: Math.round((data.averageFacilityCondition || 0) * 10) / 10,
      systemEaseOfUse: Math.round((data.averageSystemEaseOfUse || 0) * 10) / 10
    },
    sentimentBreakdown: sentimentCounts
  };
};

// Instance method to analyze sentiment (placeholder for AI/ML integration)
ratingSchema.methods.analyzeSentiment = function() {
  if (!this.feedback) {
    this.sentiment = 'neutral';
    this.sentimentScore = 0;
    return;
  }

  // Simple keyword-based sentiment analysis (can be replaced with AI service)
  const positiveWords = ['good', 'great', 'excellent', 'amazing', 'helpful', 'friendly', 'fast', 'efficient'];
  const negativeWords = ['bad', 'terrible', 'awful', 'slow', 'rude', 'unhelpful', 'poor', 'disappointing'];
  
  const text = this.feedback.toLowerCase();
  const positiveCount = positiveWords.filter(word => text.includes(word)).length;
  const negativeCount = negativeWords.filter(word => text.includes(word)).length;
  
  if (positiveCount > negativeCount) {
    this.sentiment = 'positive';
    this.sentimentScore = Math.min(0.8, positiveCount * 0.2);
  } else if (negativeCount > positiveCount) {
    this.sentiment = 'negative';
    this.sentimentScore = Math.max(-0.8, negativeCount * -0.2);
  } else {
    this.sentiment = 'neutral';
    this.sentimentScore = 0;
  }
};

// Pre-save middleware to analyze sentiment
ratingSchema.pre('save', function(next) {
  if (this.isModified('feedback')) {
    this.analyzeSentiment();
  }
  next();
});

module.exports = mongoose.model('Rating', ratingSchema);
