/**
 * Queue Cleanup Service
 * Automatically updates skipped queues from previous days to 'no-show' status
 * Runs daily at midnight (Philippine Time)
 */

const Queue = require('../models/Queue');
const { getPhilippineDayBoundaries } = require('../utils/philippineTimezone');

/**
 * Update skipped queues from previous days to 'no-show' status
 * This prevents old skipped queues from being re-queued
 */
async function updateOldSkippedQueues() {
  try {
    console.log('🧹 [Queue Cleanup] Starting cleanup of old skipped queues...');

    // Get today's date boundaries in Philippine timezone
    const today = new Date();
    const { startOfDay } = getPhilippineDayBoundaries(today);

    console.log(`🧹 [Queue Cleanup] Today's start (Philippine Time): ${startOfDay.toISOString()}`);

    // Find all skipped queues from before today
    const oldSkippedQueues = await Queue.find({
      status: 'skipped',
      skippedAt: { $lt: startOfDay } // Skipped before today
    });

    if (oldSkippedQueues.length === 0) {
      console.log('✅ [Queue Cleanup] No old skipped queues found. Nothing to update.');
      return {
        success: true,
        updatedCount: 0,
        message: 'No old skipped queues to update'
      };
    }

    console.log(`📊 [Queue Cleanup] Found ${oldSkippedQueues.length} old skipped queue(s) to update`);

    // Update all old skipped queues to 'no-show' status
    const updateResult = await Queue.updateMany(
      {
        status: 'skipped',
        skippedAt: { $lt: startOfDay }
      },
      {
        $set: {
          status: 'no-show'
        }
      }
    );

    console.log(`✅ [Queue Cleanup] Successfully updated ${updateResult.modifiedCount} queue(s) to 'no-show' status`);

    // Log details of updated queues
    const updatedQueueNumbers = oldSkippedQueues.map(q => ({
      queueNumber: q.queueNumber,
      office: q.office,
      skippedAt: q.skippedAt
    }));

    console.log('📋 [Queue Cleanup] Updated queues:', updatedQueueNumbers);

    return {
      success: true,
      updatedCount: updateResult.modifiedCount,
      message: `Updated ${updateResult.modifiedCount} old skipped queue(s) to 'no-show' status`,
      updatedQueues: updatedQueueNumbers
    };

  } catch (error) {
    console.error('❌ [Queue Cleanup] Error updating old skipped queues:', error);
    return {
      success: false,
      updatedCount: 0,
      message: 'Failed to update old skipped queues',
      error: error.message
    };
  }
}

/**
 * Schedule the cleanup job to run daily at midnight (Philippine Time)
 * Uses setInterval to run every 24 hours
 */
function scheduleQueueCleanup() {
  // Calculate milliseconds until next midnight in Philippine timezone
  const now = new Date();
  const phTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  
  // Set to next midnight
  const nextMidnight = new Date(phTime);
  nextMidnight.setHours(24, 0, 0, 0);
  
  const msUntilMidnight = nextMidnight - phTime;

  console.log('⏰ [Queue Cleanup] Scheduling daily cleanup job...');
  console.log(`⏰ [Queue Cleanup] Next run in ${Math.round(msUntilMidnight / 1000 / 60)} minutes`);

  // Run at next midnight
  setTimeout(() => {
    updateOldSkippedQueues();
    
    // Then run every 24 hours
    setInterval(() => {
      updateOldSkippedQueues();
    }, 24 * 60 * 60 * 1000); // 24 hours in milliseconds
    
  }, msUntilMidnight);

  console.log('✅ [Queue Cleanup] Daily cleanup job scheduled successfully');
}

/**
 * Initialize the queue cleanup service
 * Call this when the server starts
 */
function initializeQueueCleanup() {
  console.log('🚀 [Queue Cleanup] Initializing queue cleanup service...');
  
  // Run cleanup immediately on startup to catch any queues from yesterday
  updateOldSkippedQueues();
  
  // Schedule daily cleanup
  scheduleQueueCleanup();
  
  console.log('✅ [Queue Cleanup] Queue cleanup service initialized');
}

module.exports = {
  updateOldSkippedQueues,
  scheduleQueueCleanup,
  initializeQueueCleanup
};

