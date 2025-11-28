/**
 * Queue Cleanup Service
 * Automatically updates skipped and waiting queues from previous days to 'no-show' status
 * Runs daily at midnight (Philippine Time)
 */

const mongoose = require('mongoose');
const Queue = require('../models/Queue');
const { getPhilippineDayBoundaries } = require('../utils/philippineTimezone');

/**
 * Update skipped and waiting queues from previous days to 'no-show' status
 * This prevents old skipped and waiting queues from being re-queued
 */
async function updateOldQueues() {
  try {
    // Check if database connection is ready
    if (mongoose.connection.readyState !== 1) {
      console.log('⏸️  [Queue Cleanup] Database not connected. Skipping cleanup...');
      return {
        success: false,
        updatedCount: 0,
        skippedCount: 0,
        waitingCount: 0,
        message: 'Database not connected. Cleanup skipped.',
        error: 'Database connection not ready'
      };
    }

    console.log('🧹 [Queue Cleanup] Starting cleanup of old skipped and waiting queues...');

    // Get today's date string in Philippine timezone
    const { getPhilippineDateString } = require('../utils/philippineTimezone');
    const todayString = getPhilippineDateString();
    const { startOfDay } = getPhilippineDayBoundaries(todayString);

    console.log(`🧹 [Queue Cleanup] Today's date: ${todayString}`);
    console.log(`🧹 [Queue Cleanup] Today's start (Philippine Time): ${startOfDay.toISOString()}`);

    // Find all skipped and waiting queues from before today
    // Also include queues without timestamps (old database data)
    const oldQueues = await Queue.find({
      $or: [
        {
          status: 'skipped',
          $or: [
            { skippedAt: { $lt: startOfDay } }, // Skipped before today
            { skippedAt: { $exists: false } },  // No skippedAt timestamp (old data)
            { skippedAt: null }                 // Null skippedAt timestamp
          ]
        },
        {
          status: 'waiting',
          $or: [
            { queuedAt: { $lt: startOfDay } }, // Queued before today
            { queuedAt: { $exists: false } },  // No queuedAt timestamp (old data)
            { queuedAt: null }                 // Null queuedAt timestamp
          ]
        }
      ]
    });

    if (oldQueues.length === 0) {
      console.log('✅ [Queue Cleanup] No old skipped or waiting queues found. Nothing to update.');
      return {
        success: true,
        updatedCount: 0,
        skippedCount: 0,
        waitingCount: 0,
        message: 'No old skipped or waiting queues to update'
      };
    }

    // Separate counts for logging
    const skippedQueues = oldQueues.filter(q => q.status === 'skipped');
    const waitingQueues = oldQueues.filter(q => q.status === 'waiting');

    console.log(`📊 [Queue Cleanup] Found ${oldQueues.length} old queue(s) to update:`);
    console.log(`   - Skipped: ${skippedQueues.length}`);
    console.log(`   - Waiting: ${waitingQueues.length}`);

    // Update all old skipped and waiting queues to 'no-show' status
    const updateResult = await Queue.updateMany(
      {
        $or: [
          {
            status: 'skipped',
            $or: [
              { skippedAt: { $lt: startOfDay } }, // Skipped before today
              { skippedAt: { $exists: false } },  // No skippedAt timestamp (old data)
              { skippedAt: null }                 // Null skippedAt timestamp
            ]
          },
          {
            status: 'waiting',
            $or: [
              { queuedAt: { $lt: startOfDay } }, // Queued before today
              { queuedAt: { $exists: false } },  // No queuedAt timestamp (old data)
              { queuedAt: null }                 // Null queuedAt timestamp
            ]
          }
        ]
      },
      {
        $set: {
          status: 'no-show'
        }
      }
    );

    console.log(`✅ [Queue Cleanup] Successfully updated ${updateResult.modifiedCount} queue(s) to 'no-show' status`);
    console.log(`   - Skipped queues: ${skippedQueues.length}`);
    console.log(`   - Waiting queues: ${waitingQueues.length}`);

    // Log details of updated queues
    const updatedQueueNumbers = oldQueues.map(q => ({
      queueNumber: q.queueNumber,
      office: q.office,
      status: q.status,
      timestamp: q.status === 'skipped' ? q.skippedAt : q.queuedAt
    }));

    console.log('📋 [Queue Cleanup] Updated queues:', updatedQueueNumbers);

    return {
      success: true,
      updatedCount: updateResult.modifiedCount,
      skippedCount: skippedQueues.length,
      waitingCount: waitingQueues.length,
      message: `Updated ${updateResult.modifiedCount} old queue(s) to 'no-show' status (${skippedQueues.length} skipped, ${waitingQueues.length} waiting)`,
      updatedQueues: updatedQueueNumbers
    };

  } catch (error) {
    console.error('❌ [Queue Cleanup] Error updating old skipped and waiting queues:', error);
    return {
      success: false,
      updatedCount: 0,
      skippedCount: 0,
      waitingCount: 0,
      message: 'Failed to update old skipped and waiting queues',
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
    updateOldQueues();

    // Then run every 24 hours
    setInterval(() => {
      updateOldQueues();
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

  // Wait for database connection before running initial cleanup
  // Check connection state and wait if needed
  const checkConnectionAndRun = async () => {
    let attempts = 0;
    const maxAttempts = 10; // Wait up to 10 seconds (10 attempts * 1 second)

    while (mongoose.connection.readyState !== 1 && attempts < maxAttempts) {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    }

    if (mongoose.connection.readyState === 1) {
      // Run cleanup immediately on startup to catch any queues from yesterday
      await updateOldQueues();
    } else {
      console.log('⚠️  [Queue Cleanup] Database connection not ready after waiting. Initial cleanup skipped.');
      console.log('⚠️  [Queue Cleanup] Cleanup will run on next scheduled time or when database is connected.');
    }
  };

  // Run connection check asynchronously (don't block server startup)
  checkConnectionAndRun().catch(err => {
    console.error('❌ [Queue Cleanup] Error during initial cleanup:', err.message);
  });

  // Schedule daily cleanup
  scheduleQueueCleanup();

  console.log('✅ [Queue Cleanup] Queue cleanup service initialized');
}

module.exports = {
  updateOldQueues,
  scheduleQueueCleanup,
  initializeQueueCleanup
};

