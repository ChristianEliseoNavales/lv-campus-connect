const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Email must be valid'
    }
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  password: {
    type: String,
    required: false // Made optional for Google SSO preparation
  },
  googleId: {
    type: String,
    sparse: true // Allows multiple null values but unique non-null values
  },
  accessLevel: {
    type: String,
    enum: ['super_admin', 'admin', 'admin_staff'],
    required: true
  },
  office: {
    type: String,
    enum: ['MIS', 'Registrar', 'Admissions', 'Senior Management'],
    required: true
  },
  role: {
    type: String,
    enum: [
      'MIS Super Admin',
      'MIS Admin',
      'MIS Admin Staff',
      'Registrar Admin',
      'Registrar Admin Staff',
      'Admissions Admin',
      'Admissions Admin Staff',
      'Senior Management Admin',
      'Senior Management Admin Staff'
    ],
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  profilePicture: {
    type: String // URL to profile picture
  },
  permissions: [{
    type: String
  }],
  pageAccess: [{
    type: String
  }],
  assignedWindow: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Window',
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for better query performance
// Note: email index is automatically created by unique: true
userSchema.index({ role: 1 });
userSchema.index({ accessLevel: 1 });
userSchema.index({ office: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ office: 1, isActive: 1 }); // Compound index for common query pattern

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  
  try {
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10;
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Update last login
userSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  return this.save();
};

// Remove sensitive data when converting to JSON
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.googleId;
  return user;
};

module.exports = mongoose.model('User', userSchema);
