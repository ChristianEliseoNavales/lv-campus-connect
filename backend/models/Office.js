const mongoose = require('mongoose');

const officeSchema = new mongoose.Schema({
  officeName: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  officeEmail: {
    type: String,
    default: null,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Allow null/empty
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Email must be valid'
    }
  }
}, {
  timestamps: true
});

// Note: officeName already has a unique index due to unique: true
// No need for explicit index declaration

module.exports = mongoose.model('Office', officeSchema);

