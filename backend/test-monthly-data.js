const mongoose = require('mongoose');
const { Queue } = require('./models');
require('dotenv').config();

// Test the monthly aggregation
async function testMonthlyAggregation() {
  try {
    console.log('🧪 Testing Monthly Data Aggregation...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Test monthly aggregation for registrar department
    const monthlyStats = await Queue.aggregate([
      { 
        $match: { 
          department: 'registrar',
          status: { $in: ['completed', 'cancelled', 'skipped'] }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$queuedAt' },
            month: { $month: '$queuedAt' }
          },
          count: { $sum: 1 },
          firstDate: { $min: '$queuedAt' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);
    
    console.log('\n📊 Monthly Aggregation Results:');
    monthlyStats.forEach(stat => {
      const date = new Date(stat._id.year, stat._id.month - 1, 1);
      const monthName = date.toLocaleDateString('en-US', { month: 'short' });
      console.log(`   ${monthName} ${stat._id.year}: ${stat.count} queues`);
    });
    
    console.log(`\n✅ Total months: ${monthlyStats.length}`);
    console.log(`✅ Total queues: ${monthlyStats.reduce((sum, stat) => sum + stat.count, 0)}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the test
if (require.main === module) {
  testMonthlyAggregation();
}

module.exports = { testMonthlyAggregation };
