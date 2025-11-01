const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const { Queue, Rating } = require('../models');

async function migrateQueueRatings() {
  try {
    console.log('🔄 Migrating existing queue ratings to Rating documents...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find all queue entries with ratings
    const queuesWithRatings = await Queue.find({ 
      rating: { $exists: true, $ne: null } 
    }).populate('visitationFormId');
    
    console.log(`📊 Found ${queuesWithRatings.length} queue entries with ratings`);
    
    let migratedCount = 0;
    
    for (const queue of queuesWithRatings) {
      try {
        // Check if Rating document already exists for this queue
        const existingRating = await Rating.findOne({ queueId: queue._id });
        
        if (existingRating) {
          console.log(`⏭️  Skipping queue ${queue.queueNumber} - Rating document already exists`);
          continue;
        }
        
        // Create Rating document
        const ratingData = {
          rating: queue.rating,
          ratingType: 'overall_experience',
          queueId: queue._id,
          customerName: queue.visitationFormId?.customerName || 'Anonymous Customer',
          customerRole: queue.role,
          department: queue.department,
          status: 'approved'
        };
        
        // Add customer email if available
        if (queue.visitationFormId?.email) {
          ratingData.customerEmail = queue.visitationFormId.email;
        }
        
        const ratingDocument = new Rating(ratingData);
        await ratingDocument.save();
        
        console.log(`✅ Migrated queue ${queue.queueNumber} (${queue.department}) - Rating: ${queue.rating}`);
        migratedCount++;
        
      } catch (error) {
        console.error(`❌ Failed to migrate queue ${queue.queueNumber}:`, error.message);
      }
    }
    
    console.log(`\n🎉 Migration completed! Migrated ${migratedCount} ratings`);
    
    // Verify the migration
    const totalRatingDocuments = await Rating.countDocuments();
    console.log(`📊 Total Rating documents now: ${totalRatingDocuments}`);
    
    await mongoose.disconnect();
    console.log('✅ Database connection closed');
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
}

migrateQueueRatings();
