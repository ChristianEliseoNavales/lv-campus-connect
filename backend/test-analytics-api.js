const mongoose = require('mongoose');
const { Queue, Service, Window } = require('./models');
require('dotenv').config();

// Test the analytics API endpoints
async function testAnalyticsAPI() {
  try {
    console.log('🧪 Testing Analytics API Endpoints...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Check if we have services and windows
    const services = await Service.find({});
    const windows = await Window.find({});
    const queues = await Queue.find({});
    
    console.log(`📊 Database Status:`);
    console.log(`   Services: ${services.length}`);
    console.log(`   Windows: ${windows.length}`);
    console.log(`   Queues: ${queues.length}`);
    
    if (services.length === 0) {
      console.log('⚠️ No services found. Running basic seed first...');
      // Run basic seeding
      const { seedDatabase } = require('./scripts/seedDatabase');
      await seedDatabase();
    }
    
    if (queues.length === 0) {
      console.log('⚠️ No queue data found. Running queue seeding...');
      // Run queue seeding
      const { seedQueueData } = require('./scripts/seedQueueData');
      await seedQueueData();
    }
    
    // Test pie chart data aggregation
    console.log('\n📈 Testing Pie Chart Data Aggregation...');
    
    const registrarPieData = await Queue.aggregate([
      { 
        $match: { 
          department: 'registrar',
          status: { $in: ['completed', 'cancelled', 'skipped'] }
        }
      },
      {
        $group: {
          _id: '$serviceId',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 4 }
    ]);
    
    console.log('Registrar Pie Chart Data:', registrarPieData);
    
    // Test area chart data aggregation
    console.log('\n📊 Testing Area Chart Data Aggregation...');
    
    const registrarAreaData = await Queue.aggregate([
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
            month: { $month: '$queuedAt' },
            day: { $dayOfMonth: '$queuedAt' }
          },
          count: { $sum: 1 },
          date: { $first: '$queuedAt' }
        }
      },
      { $sort: { 'date': 1 } },
      { $limit: 10 } // Show first 10 days
    ]);
    
    console.log('Registrar Area Chart Data (first 10 days):', registrarAreaData);
    
    console.log('\n✅ Analytics API test completed successfully!');
    
  } catch (error) {
    console.error('❌ Analytics API test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the test
if (require.main === module) {
  testAnalyticsAPI();
}

module.exports = { testAnalyticsAPI };
