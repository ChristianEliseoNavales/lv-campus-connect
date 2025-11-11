/**
 * Script to delete all queue records with status 'waiting' from the database
 * This will permanently remove waiting queues while preserving all other queue data
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Import models
const Queue = require('../models/Queue');

/**
 * Delete all waiting queues from the database
 */
async function deleteWaitingQueues() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Count waiting queues before deletion
    const waitingCount = await Queue.countDocuments({ status: 'waiting' });
    console.log(`\n📊 Found ${waitingCount} waiting queue(s) to delete`);

    if (waitingCount === 0) {
      console.log('✅ No waiting queues found. Nothing to delete.');
      await mongoose.connection.close();
      console.log('🔌 Database connection closed');
      return;
    }

    // Get details of waiting queues before deletion (for logging)
    const waitingQueues = await Queue.find({ status: 'waiting' })
      .select('queueNumber office windowId serviceId queuedAt')
      .sort({ queuedAt: 1 });

    console.log('\n📋 Waiting queues to be deleted:');
    waitingQueues.forEach((queue, index) => {
      console.log(`   ${index + 1}. Queue #${queue.queueNumber} - ${queue.office} - Queued at: ${queue.queuedAt?.toLocaleString() || 'N/A'}`);
    });

    // Delete all waiting queues
    console.log('\n🗑️  Deleting waiting queue records...');
    const deleteResult = await Queue.deleteMany({ status: 'waiting' });
    console.log(`✅ Successfully deleted ${deleteResult.deletedCount} waiting queue record(s)`);

    // Verify deletion
    const remainingWaiting = await Queue.countDocuments({ status: 'waiting' });
    const totalQueues = await Queue.countDocuments();

    console.log('\n📊 Final Database Status:');
    console.log(`   Waiting queues remaining: ${remainingWaiting}`);
    console.log(`   Total queue records: ${totalQueues}`);

    // Show breakdown by status
    const statusCounts = await Queue.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    console.log('\n📈 Queue Status Breakdown:');
    statusCounts.forEach(status => {
      console.log(`   ${status._id}: ${status.count}`);
    });

    console.log('\n✅ Waiting queues deletion completed successfully!');

    // Close database connection
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');

  } catch (error) {
    console.error('❌ Error deleting waiting queues:', error);
    process.exit(1);
  }
}

// Run the deletion function
console.log('⚠️  WARNING: This will permanently delete ALL waiting queue records!');
console.log('');
console.log('This will delete:');
console.log('- All queue entries with status "waiting"');
console.log('');
console.log('This will NOT affect:');
console.log('- Queues with other statuses (serving, completed, cancelled, skipped)');
console.log('- Visitation form data');
console.log('- Window configurations');
console.log('- Service definitions');
console.log('- User accounts');
console.log('- Settings');
console.log('');

deleteWaitingQueues();

