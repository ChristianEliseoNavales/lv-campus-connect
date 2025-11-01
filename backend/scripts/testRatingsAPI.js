const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const { Rating } = require('../models');

async function testRatingsAPI() {
  try {
    console.log('🧪 Testing Ratings API logic...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Simulate the API query logic from /api/ratings
    const query = {}; // No filters applied
    
    // Build aggregation pipeline to join with Queue for queuedAt
    const pipeline = [
      // Match ratings based on basic filters
      { $match: query },
      
      // Join with Queue to get queuedAt
      {
        $lookup: {
          from: 'queues',
          localField: 'queueId',
          foreignField: '_id',
          as: 'queue'
        }
      },
      
      // Unwind queue array (should be single item)
      { $unwind: { path: '$queue', preserveNullAndEmptyArrays: true } },
      
      // Add queuedAt field for easier access
      {
        $addFields: {
          queuedAt: '$queue.queuedAt'
        }
      },
      
      // Add sorting
      { $sort: { createdAt: -1 } }
    ];
    
    // Execute aggregation
    const ratings = await Rating.aggregate(pipeline);
    
    console.log(`📊 API would return ${ratings.length} ratings`);
    
    if (ratings.length > 0) {
      console.log('\n📝 Sample rating data:');
      const sample = ratings[0];
      console.log({
        _id: sample._id,
        rating: sample.rating,
        customerName: sample.customerName,
        department: sample.department,
        ratingType: sample.ratingType,
        queuedAt: sample.queuedAt,
        createdAt: sample.createdAt
      });
    } else {
      console.log('❌ No ratings returned by API logic');
    }
    
    await mongoose.disconnect();
    console.log('\n✅ API test completed');
    
  } catch (error) {
    console.error('❌ API test error:', error);
    process.exit(1);
  }
}

testRatingsAPI();
