const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  // System-wide settings
  systemName: {
    type: String,
    default: 'University Kiosk System'
  },
  systemVersion: {
    type: String,
    default: '1.0.0'
  },
  // Queue system settings
  queueSettings: {
    isEnabled: {
      type: Boolean,
      default: true
    },
    globalQueueNumbering: {
      type: Boolean,
      default: true
    },
    maxQueueNumber: {
      type: Number,
      default: 99,
      min: 1,
      max: 999
    },
    resetQueueDaily: {
      type: Boolean,
      default: true
    },
    resetTime: {
      type: String, // Format: "HH:MM"
      default: "00:00"
    },
    allowPriorityQueue: {
      type: Boolean,
      default: true
    },
    maxWaitTime: {
      type: Number, // in minutes
      default: 120
    }
  },
  // Kiosk settings
  kioskSettings: {
    idleTimeout: {
      type: Number, // in seconds
      default: 300
    },
    idleWarningTime: {
      type: Number, // in seconds
      default: 30
    },
    autoRefreshInterval: {
      type: Number, // in seconds
      default: 30
    },
    enableTextToSpeech: {
      type: Boolean,
      default: true
    },
    voiceSettings: {
      rate: {
        type: Number,
        default: 0.8,
        min: 0.1,
        max: 2.0
      },
      pitch: {
        type: Number,
        default: 1.0,
        min: 0.0,
        max: 2.0
      },
      volume: {
        type: Number,
        default: 1.0,
        min: 0.0,
        max: 1.0
      },
      voice: {
        type: String,
        default: 'female'
      }
    }
  },
  // Display settings
  displaySettings: {
    theme: {
      primaryColor: {
        type: String,
        default: '#1F3463'
      },
      secondaryColor: {
        type: String,
        default: '#FFE251'
      },
      backgroundColor: {
        type: String,
        default: '#FFFFFF'
      },
      textColor: {
        type: String,
        default: '#000000'
      }
    },
    layout: {
      orientation: {
        type: String,
        enum: ['landscape', 'portrait'],
        default: 'landscape'
      },
      aspectRatio: {
        type: String,
        default: '16:9'
      }
    },
    fonts: {
      primary: {
        type: String,
        default: 'SF Pro Rounded'
      },
      secondary: {
        type: String,
        default: 'Days One'
      }
    }
  },
  // Office-specific settings
  officeSettings: {
    registrar: {
      isEnabled: {
        type: Boolean,
        default: true
      },
      displayName: {
        type: String,
        default: "Registrar's Office"
      },
      description: {
        type: String,
        default: 'Student records, transcripts, enrollment verification'
      },
      location: {
        type: String,
        default: 'Ground Floor, Administration Building'
      },
      operatingHours: {
        start: {
          type: String,
          default: "08:00"
        },
        end: {
          type: String,
          default: "17:00"
        }
      },
      operatingDays: [{
        type: String,
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
      }],
      maxWindows: {
        type: Number,
        default: 5,
        min: 1
      }
    },
    admissions: {
      isEnabled: {
        type: Boolean,
        default: true
      },
      displayName: {
        type: String,
        default: 'Admissions Office'
      },
      description: {
        type: String,
        default: 'New student applications, admission requirements'
      },
      location: {
        type: String,
        default: 'Second Floor, Administration Building'
      },
      operatingHours: {
        start: {
          type: String,
          default: "08:00"
        },
        end: {
          type: String,
          default: "17:00"
        }
      },
      operatingDays: [{
        type: String,
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
      }],
      maxWindows: {
        type: Number,
        default: 3,
        min: 1
      }
    }
  },
  // Notification settings
  notificationSettings: {
    enableEmailNotifications: {
      type: Boolean,
      default: false
    },
    enableSMSNotifications: {
      type: Boolean,
      default: false
    },
    enablePushNotifications: {
      type: Boolean,
      default: true
    },
    queueCallNotification: {
      type: Boolean,
      default: true
    },
    reminderNotification: {
      type: Boolean,
      default: true
    },
    reminderTime: {
      type: Number, // minutes before estimated time
      default: 5
    }
  },
  // Security settings
  securitySettings: {
    sessionTimeout: {
      type: Number, // in minutes
      default: 60
    },
    maxLoginAttempts: {
      type: Number,
      default: 5
    },
    lockoutDuration: {
      type: Number, // in minutes
      default: 15
    },
    requirePasswordChange: {
      type: Boolean,
      default: false
    },
    passwordChangeInterval: {
      type: Number, // in days
      default: 90
    }
  },
  // Audit settings
  auditSettings: {
    enableAuditLog: {
      type: Boolean,
      default: true
    },
    retentionPeriod: {
      type: Number, // in days
      default: 365
    },
    logLevel: {
      type: String,
      enum: ['error', 'warn', 'info', 'debug'],
      default: 'info'
    }
  },
  // Last updated information
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Note: _id field is automatically unique in MongoDB, no need for explicit index
// Settings document uses singleton pattern via static methods

// Static method to get current settings (singleton pattern)
settingsSchema.statics.getCurrentSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = new this();
    await settings.save();
  }
  return settings;
};

// Static method to update settings
settingsSchema.statics.updateSettings = async function(updates, updatedBy) {
  let settings = await this.getCurrentSettings();
  
  // Deep merge the updates
  Object.keys(updates).forEach(key => {
    if (typeof updates[key] === 'object' && !Array.isArray(updates[key])) {
      settings[key] = { ...settings[key], ...updates[key] };
    } else {
      settings[key] = updates[key];
    }
  });
  
  settings.lastUpdatedBy = updatedBy;
  return settings.save();
};

module.exports = mongoose.model('Settings', settingsSchema);
