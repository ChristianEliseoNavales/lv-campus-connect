/**
 * Migration Script: Fix User PageAccess
 *
 * This script fixes users who have empty or missing pageAccess arrays
 * by automatically assigning them the default pageAccess for their role.
 *
 * Usage: node backend/scripts/fixUserPageAccess.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const { getDefaultPageAccess } = require('../utils/rolePermissions');

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Atlas connected successfully!');
    console.log(`📍 Connected to database: ${mongoose.connection.db.databaseName}`);
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Main migration function
const fixUserPageAccess = async () => {
  try {
    console.log('\n🔧 Starting User PageAccess Fix Migration...\n');

    // Find all users with empty or missing pageAccess
    const usersWithEmptyAccess = await User.find({
      $or: [
        { pageAccess: { $exists: false } },
        { pageAccess: { $size: 0 } },
        { pageAccess: null }
      ]
    }).select('_id name email role office accessLevel pageAccess');

    console.log(`📊 Found ${usersWithEmptyAccess.length} users with empty/missing pageAccess\n`);

    if (usersWithEmptyAccess.length === 0) {
      console.log('✅ All users already have pageAccess configured!');
      return;
    }

    let updatedCount = 0;
    let skippedCount = 0;

    for (const user of usersWithEmptyAccess) {
      console.log(`\n👤 Processing: ${user.name} (${user.email})`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Office: ${user.office}`);
      console.log(`   Current pageAccess:`, user.pageAccess || []);

      // Get default pageAccess for this role
      const defaultPageAccess = getDefaultPageAccess(user.role, user.office);

      if (!defaultPageAccess || defaultPageAccess.length === 0) {
        console.log(`   ⚠️  No default pageAccess found for role "${user.role}". Skipping...`);
        skippedCount++;
        continue;
      }

      console.log(`   📋 Assigning default pageAccess:`, defaultPageAccess);

      // Update user with default pageAccess
      await User.findByIdAndUpdate(
        user._id,
        { pageAccess: defaultPageAccess },
        { new: true }
      );

      console.log(`   ✅ Updated successfully!`);
      updatedCount++;
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log('='.repeat(60));
    console.log(`Total users processed: ${usersWithEmptyAccess.length}`);
    console.log(`✅ Successfully updated: ${updatedCount}`);
    console.log(`⚠️  Skipped: ${skippedCount}`);
    console.log('='.repeat(60) + '\n');

    console.log('✅ Migration completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  }
};

// Run migration
const runMigration = async () => {
  try {
    await connectDB();
    await fixUserPageAccess();
    
    console.log('🎉 All done! Closing database connection...\n');
    await mongoose.connection.close();
    console.log('✅ Database connection closed.\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Execute if run directly
if (require.main === module) {
  runMigration();
}

module.exports = { fixUserPageAccess };

