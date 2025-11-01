const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const { Queue, Rating } = require('../models');

async function checkRatingsData() {
  try {
    console.log('🔍 Checking ratings data...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Check queue data
    const queueCount = await Queue.countDocuments();
    const queueWithRatings = await Queue.countDocuments({ 
      rating: { $exists: true, $ne: null } 
    });
    
    // Check rating documents
    const ratingCount = await Rating.countDocuments();
    
    console.log('\n📊 Data Summary:');
    console.log(`Total Queue entries: ${queueCount}`);
    console.log(`Queue entries with ratings: ${queueWithRatings}`);
    console.log(`Rating documents: ${ratingCount}`);
    
    // Show sample queue with rating
    if (queueWithRatings > 0) {
      console.log('\n📝 Sample Queue with Rating:');
      const sampleQueue = await Queue.findOne({ 
        rating: { $exists: true, $ne: null } 
      }).populate('visitationFormId');
      
      if (sampleQueue) {
        console.log({
          id: sampleQueue._id.toString(),
          queueNumber: sampleQueue.queueNumber,
          rating: sampleQueue.rating,
          department: sampleQueue.department,
          customerName: sampleQueue.visitationFormId?.customerName || 'No customer name',
          role: sampleQueue.role
        });
      }
    }
    
    // Show sample rating document
    if (ratingCount > 0) {
      console.log('\n⭐ Sample Rating Document:');
      const sampleRating = await Rating.findOne();
      console.log({
        id: sampleRating._id.toString(),
        rating: sampleRating.rating,
        customerName: sampleRating.customerName,
        department: sampleRating.department,
        ratingType: sampleRating.ratingType,
        createdAt: sampleRating.createdAt
      });
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Database check completed');
    
  } catch (error) {
    console.error('❌ Error checking ratings data:', error);
    process.exit(1);
  }
}

checkRatingsData();
