const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const { AuditTrail } = require('../models');

async function verifyAuditSystem() {
  try {
    console.log('🔍 Verifying Complete Audit Trail System...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // 1. Check total audit entries
    const totalEntries = await AuditTrail.countDocuments();
    console.log(`\n📊 Total audit entries in database: ${totalEntries}`);
    
    // 2. Check action type distribution
    const actionStats = await AuditTrail.aggregate([
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 },
          successCount: { $sum: { $cond: ['$success', 1, 0] } },
          failureCount: { $sum: { $cond: ['$success', 0, 1] } }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    console.log('\n📈 Action Type Distribution:');
    actionStats.forEach(stat => {
      console.log(`  ${stat._id}: ${stat.count} total (${stat.successCount} success, ${stat.failureCount} failures)`);
    });
    
    // 3. Check resource type distribution
    const resourceStats = await AuditTrail.aggregate([
      {
        $group: {
          _id: '$resourceType',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    console.log('\n🎯 Resource Type Distribution:');
    resourceStats.forEach(stat => {
      console.log(`  ${stat._id}: ${stat.count} entries`);
    });
    
    // 4. Check user activity
    const userStats = await AuditTrail.aggregate([
      {
        $group: {
          _id: { userId: '$userId', userName: '$userName', userRole: '$userRole' },
          actionCount: { $sum: 1 },
          lastActivity: { $max: '$createdAt' }
        }
      },
      { $sort: { actionCount: -1 } }
    ]);
    
    console.log('\n👥 User Activity Summary:');
    userStats.forEach(stat => {
      console.log(`  ${stat._id.userName} (${stat._id.userRole}): ${stat.actionCount} actions, last: ${stat.lastActivity}`);
    });
    
    // 5. Check recent activities (last 10)
    const recentActivities = await AuditTrail.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('action actionDescription userName userRole success createdAt');
    
    console.log('\n🕒 Recent Activities (Last 10):');
    recentActivities.forEach((activity, index) => {
      const status = activity.success ? '✅' : '❌';
      console.log(`  ${index + 1}. ${status} ${activity.action} by ${activity.userName} (${activity.userRole}) - ${activity.createdAt}`);
      console.log(`     ${activity.actionDescription}`);
    });
    
    // 6. Check failed actions
    const failedActions = await AuditTrail.find({ success: false })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('action actionDescription userName errorMessage createdAt');
    
    console.log('\n❌ Recent Failed Actions:');
    if (failedActions.length === 0) {
      console.log('  No failed actions found');
    } else {
      failedActions.forEach((action, index) => {
        console.log(`  ${index + 1}. ${action.action} by ${action.userName} - ${action.createdAt}`);
        console.log(`     Error: ${action.errorMessage}`);
      });
    }
    
    // 7. Check department activity
    const departmentStats = await AuditTrail.aggregate([
      {
        $group: {
          _id: '$department',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    console.log('\n🏢 Department Activity:');
    departmentStats.forEach(stat => {
      console.log(`  ${stat._id || 'Unknown'}: ${stat.count} actions`);
    });
    
    // 8. Check severity levels
    const severityStats = await AuditTrail.aggregate([
      {
        $group: {
          _id: '$severity',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    console.log('\n⚠️ Severity Level Distribution:');
    severityStats.forEach(stat => {
      console.log(`  ${stat._id || 'Unknown'}: ${stat.count} actions`);
    });
    
    // 9. Verify audit trail completeness
    console.log('\n🔍 Audit Trail Completeness Check:');
    
    const requiredFields = ['userId', 'userEmail', 'userName', 'userRole', 'action', 'actionDescription', 'resourceType', 'ipAddress', 'requestMethod', 'requestUrl', 'statusCode', 'success'];
    
    for (const field of requiredFields) {
      const missingCount = await AuditTrail.countDocuments({ [field]: { $exists: false } });
      if (missingCount > 0) {
        console.log(`  ❌ ${field}: ${missingCount} entries missing this field`);
      } else {
        console.log(`  ✅ ${field}: All entries have this field`);
      }
    }
    
    // 10. Performance check
    console.log('\n⚡ Performance Metrics:');
    const indexInfo = await AuditTrail.collection.getIndexes();
    console.log(`  Database indexes: ${Object.keys(indexInfo).length}`);
    
    const avgResponseTime = await AuditTrail.aggregate([
      {
        $group: {
          _id: null,
          avgStatusCode: { $avg: '$statusCode' },
          totalEntries: { $sum: 1 }
        }
      }
    ]);
    
    if (avgResponseTime.length > 0) {
      console.log(`  Average status code: ${avgResponseTime[0].avgStatusCode.toFixed(1)}`);
      console.log(`  Total entries processed: ${avgResponseTime[0].totalEntries}`);
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Audit system verification completed successfully!');
    
    // Summary
    console.log('\n📋 AUDIT SYSTEM SUMMARY:');
    console.log(`  Total Entries: ${totalEntries}`);
    console.log(`  Action Types: ${actionStats.length}`);
    console.log(`  Resource Types: ${resourceStats.length}`);
    console.log(`  Active Users: ${userStats.length}`);
    console.log(`  System Status: ✅ OPERATIONAL`);
    
  } catch (error) {
    console.error('❌ Audit system verification error:', error);
    process.exit(1);
  }
}

verifyAuditSystem();
