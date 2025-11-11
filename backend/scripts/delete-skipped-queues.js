/**
 * Script to delete all queue records with status 'skipped' from the database
 * This will permanently remove skipped queues while preserving all other queue data
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Import models
const Queue = require('../models/Queue');

/**
 * Delete all skipped queues from the database
 */
async function deleteSkippedQueues() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Count skipped queues before deletion
    const skippedCount = await Queue.countDocuments({ status: 'skipped' });
    console.log(`\n📊 Found ${skippedCount} skipped queue(s) to delete`);

    if (skippedCount === 0) {
      console.log('✅ No skipped queues found. Nothing to delete.');
      await mongoose.connection.close();
      console.log('🔌 Database connection closed');
      return;
    }

    // Get details of skipped queues before deletion (for logging)
    const skippedQueues = await Queue.find({ status: 'skipped' })
      .select('queueNumber office windowId serviceId skippedAt')
      .sort({ skippedAt: -1 });

    console.log('\n📋 Skipped queues to be deleted:');
    skippedQueues.forEach((queue, index) => {
      console.log(`   ${index + 1}. Queue #${queue.queueNumber} - ${queue.office} - Skipped at: ${queue.skippedAt?.toLocaleString() || 'N/A'}`);
    });

    // Delete all skipped queues
    console.log('\n🗑️  Deleting skipped queue records...');
    const deleteResult = await Queue.deleteMany({ status: 'skipped' });
    console.log(`✅ Successfully deleted ${deleteResult.deletedCount} skipped queue record(s)`);

    // Verify deletion
    const remainingSkipped = await Queue.countDocuments({ status: 'skipped' });
    const totalQueues = await Queue.countDocuments();

    console.log('\n📊 Final Database Status:');
    console.log(`   Skipped queues remaining: ${remainingSkipped}`);
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

    console.log('\n✅ Skipped queues deletion completed successfully!');

    // Close database connection
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');

  } catch (error) {
    console.error('❌ Error deleting skipped queues:', error);
    process.exit(1);
  }
}

// Run the deletion function
console.log('⚠️  WARNING: This will permanently delete ALL skipped queue records!');
console.log('');
console.log('This will delete:');
console.log('- All queue entries with status "skipped"');
console.log('');
console.log('This will NOT affect:');
console.log('- Queues with other statuses (waiting, serving, completed, cancelled)');
console.log('- Visitation form data');
console.log('- Window configurations');
console.log('- Service definitions');
console.log('- User accounts');
console.log('- Settings');
console.log('');

deleteSkippedQueues();

