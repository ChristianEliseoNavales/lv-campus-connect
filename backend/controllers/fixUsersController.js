const User = require('../models/User');
const { getDefaultPageAccess } = require('../utils/rolePermissions');

// POST /api/fix-users/page-access - Fix all users with empty or missing pageAccess
async function fixUserPageAccess(req, res, next) {
  try {
    console.log('\n🔧 Starting User PageAccess Fix...');
    console.log('👤 Requested by:', req.user.email);

    // Find all users with empty or missing pageAccess
    const usersWithEmptyAccess = await User.find({
      $or: [
        { pageAccess: { $exists: false } },
        { pageAccess: { $size: 0 } },
        { pageAccess: null }
      ]
    }).select('_id name email role office accessLevel pageAccess');

    console.log(`📊 Found ${usersWithEmptyAccess.length} users with empty/missing pageAccess`);

    if (usersWithEmptyAccess.length === 0) {
      return res.json({
        success: true,
        message: 'All users already have pageAccess configured!',
        usersFixed: 0,
        usersSkipped: 0
      });
    }

    let updatedCount = 0;
    let skippedCount = 0;
    const results = [];

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
        results.push({
          user: user.email,
          status: 'skipped',
          reason: `No default pageAccess for role "${user.role}"`
        });
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
      results.push({
        user: user.email,
        status: 'updated',
        pageAccess: defaultPageAccess
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Fix Summary:');
    console.log('='.repeat(60));
    console.log(`Total users processed: ${usersWithEmptyAccess.length}`);
    console.log(`✅ Successfully updated: ${updatedCount}`);
    console.log(`⚠️  Skipped: ${skippedCount}`);
    console.log('='.repeat(60) + '\n');

    res.json({
      success: true,
      message: `Successfully fixed ${updatedCount} users!`,
      usersFixed: updatedCount,
      usersSkipped: skippedCount,
      details: results
    });

  } catch (error) {
    console.error('\n❌ Error fixing users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fix users',
      message: error.message
    });
  }
}

// GET /api/fix-users/check - Check how many users need fixing
async function checkUsers(req, res, next) {
  try {
    // Find all users with empty or missing pageAccess
    const usersWithEmptyAccess = await User.find({
      $or: [
        { pageAccess: { $exists: false } },
        { pageAccess: { $size: 0 } },
        { pageAccess: null }
      ]
    }).select('name email role office accessLevel');

    const usersList = usersWithEmptyAccess.map(user => ({
      name: user.name,
      email: user.email,
      role: user.role,
      office: user.office,
      accessLevel: user.accessLevel
    }));

    res.json({
      success: true,
      count: usersWithEmptyAccess.length,
      users: usersList
    });

  } catch (error) {
    console.error('❌ Error checking users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check users',
      message: error.message
    });
  }
}

module.exports = {
  fixUserPageAccess,
  checkUsers
};


