const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { User } = require('../models');
const { getDefaultPageAccess } = require('../utils/rolePermissions');

async function fixPageAccess() {
  try {
    console.log('🔧 Fixing PageAccess for all users...\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Find all users
    const users = await User.find({});
    console.log(`📋 Found ${users.length} users\n`);
    
    let updated = 0;
    let skipped = 0;
    
    for (const user of users) {
      console.log(`Processing: ${user.email} (${user.role})`);
      
      // Get the correct pageAccess for the user's role
      const correctPageAccess = getDefaultPageAccess(user.role);
      
      if (!correctPageAccess || correctPageAccess.length === 0) {
        console.log(`  ⚠️  No default pageAccess for role: ${user.role}`);
        skipped++;
        continue;
      }
      
      // Check if current pageAccess has old format (non-route values)
      const hasOldFormat = user.pageAccess && user.pageAccess.some(page => 
        !page.startsWith('/') && page !== '*'
      );
      
      // Check if pageAccess is empty
      const isEmpty = !user.pageAccess || user.pageAccess.length === 0;
      
      if (hasOldFormat || isEmpty) {
        console.log(`  📝 Old pageAccess:`, user.pageAccess);
        console.log(`  ✅ New pageAccess:`, correctPageAccess);
        
        user.pageAccess = correctPageAccess;
        await user.save();
        
        console.log(`  ✅ Updated!\n`);
        updated++;
      } else {
        console.log(`  ⏭️  Already has correct format\n`);
        skipped++;
      }
    }
    
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    Fix Summary                             ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    console.log(`✅ Updated: ${updated}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`📊 Total: ${users.length}\n`);
    
    if (updated > 0) {
      console.log('🎉 PageAccess fixed successfully!\n');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('📡 MongoDB connection closed');
  }
}

fixPageAccess();

