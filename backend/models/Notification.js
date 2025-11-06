const mongoose = require('mongoose');

/**
 * Notification Model
 * 
 * Stores all toast notifications that appear to users during their session.
 * This allows users to review past notifications through the notification bell.
 */
const notificationSchema = new mongoose.Schema({
  // User who received the notification
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Notification type (matches toast types)
  type: {
    type: String,
    enum: ['success', 'error', 'warning', 'info'],
    required: true
  },

  // Notification title
  title: {
    type: String,
    required: true,
    trim: true
  },

  // Notification message
  message: {
    type: String,
    required: true,
    trim: true
  },

  // Whether the notification has been read
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },

  // When the notification was read
  readAt: {
    type: Date,
    default: null
  },

  // Additional metadata (optional)
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Indexes for efficient queries
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });

// Static method to create a notification
notificationSchema.statics.createNotification = async function(userId, type, title, message, metadata = {}) {
  try {
    const notification = new this({
      userId,
      type,
      title,
      message,
      metadata
    });
    await notification.save();
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Static method to get unread count for a user
notificationSchema.statics.getUnreadCount = async function(userId) {
  try {
    return await this.countDocuments({ userId, isRead: false });
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
};

// Static method to mark notification as read
notificationSchema.statics.markAsRead = async function(notificationId) {
  try {
    return await this.findByIdAndUpdate(
      notificationId,
      { isRead: true, readAt: new Date() },
      { new: true }
    );
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

// Static method to mark all notifications as read for a user
notificationSchema.statics.markAllAsRead = async function(userId) {
  try {
    return await this.updateMany(
      { userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};

// Static method to get recent notifications for a user
notificationSchema.statics.getRecentNotifications = async function(userId, limit = 50) {
  try {
    return await this.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit);
  } catch (error) {
    console.error('Error getting recent notifications:', error);
    return [];
  }
};

// Static method to delete old notifications (older than 30 days)
notificationSchema.statics.deleteOldNotifications = async function() {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = await this.deleteMany({ createdAt: { $lt: thirtyDaysAgo } });
    console.log(`Deleted ${result.deletedCount} old notifications`);
    return result;
  } catch (error) {
    console.error('Error deleting old notifications:', error);
    throw error;
  }
};

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;

