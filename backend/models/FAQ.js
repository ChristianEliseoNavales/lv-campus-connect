const mongoose = require('mongoose');

const faqSchema = new mongoose.Schema({
  question: {
    type: String,
    required: [true, 'Question is required'],
    trim: true,
    minlength: [10, 'Question must be at least 10 characters long'],
    maxlength: [500, 'Question cannot exceed 500 characters']
  },
  answer: {
    type: String,
    required: [true, 'Answer is required'],
    trim: true,
    minlength: [10, 'Answer must be at least 10 characters long'],
    maxlength: [2000, 'Answer cannot exceed 2000 characters']
  },
  office: {
    type: String,
    required: [true, 'Office is required'],
    trim: true,
    enum: {
      values: ['MIS', 'Registrar', 'Admissions', 'Senior Management'],
      message: '{VALUE} is not a valid office'
    }
  },
  order: {
    type: Number,
    default: 0,
    min: [0, 'Order cannot be negative']
  },
  status: {
    type: String,
    enum: {
      values: ['active', 'inactive'],
      message: '{VALUE} is not a valid status'
    },
    default: 'active'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for better query performance
faqSchema.index({ office: 1, order: 1 });
faqSchema.index({ status: 1, isActive: 1 });
faqSchema.index({ createdAt: -1 });

// Static method to get all active FAQs sorted by order
// If office is provided, filter by office; otherwise return all
faqSchema.statics.getActiveFAQs = function(office = null) {
  const query = {
    status: 'active',
    isActive: true
  };

  if (office) {
    query.office = office;
  }

  return this.find(query)
    .sort({ order: 1, createdAt: 1 })
    .select('-__v');
};

// Instance method to toggle status
faqSchema.methods.toggleStatus = function() {
  this.status = this.status === 'active' ? 'inactive' : 'active';
  return this.save();
};

const FAQ = mongoose.model('FAQ', faqSchema);

module.exports = FAQ;

