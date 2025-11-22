require('dotenv').config();
const mongoose = require('mongoose');
const Queue = require('../models/Queue');

async function testAggregation() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Build the same aggregation pipeline used in queueRatings.js
    const matchStage = {
      rating: { $exists: true, $ne: null }
    };

    const pipeline = [
      // Match queues with ratings
      { $match: matchStage },
      
      // Join with VisitationForm to get customer details
      {
        $lookup: {
          from: 'visitationforms',
          localField: 'visitationFormId',
          foreignField: '_id',
          as: 'visitationForm'
        }
      },
      
      // Join with Service to get service name
      {
        $lookup: {
          from: 'services',
          localField: 'serviceId',
          foreignField: '_id',
          as: 'service'
        }
      },
      
      // Unwind arrays
      { $unwind: { path: '$visitationForm', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
      
      // Add computed fields with conditional logic for customerName
      {
        $addFields: {
          customerName: {
            $ifNull: [
              '$visitationForm.customerName',
              {
                $cond: {
                  // If service is 'Enroll', use office-specific labels
                  if: { $eq: ['$service.name', 'Enroll'] },
                  then: {
                    $cond: {
                      if: { $eq: ['$office', 'registrar'] },
                      then: 'Enrollee',
                      else: {
                        $cond: {
                          if: { $eq: ['$office', 'admissions'] },
                          then: 'New Student',
                          else: 'Anonymous Customer'
                        }
                      }
                    }
                  },
                  else: 'Anonymous Customer'
                }
              }
            ]
          },
          serviceName: '$service.name',
          department: '$office'
        }
      },
      
      // Sort by queuedAt descending
      { $sort: { queuedAt: -1 } },
      
      // Limit to 10 for testing
      { $limit: 10 },
      
      // Project only needed fields
      {
        $project: {
          _id: 1,
          queueNumber: 1,
          office: 1,
          rating: 1,
          queuedAt: 1,
          customerName: 1,
          serviceName: 1,
          department: 1,
          role: 1,
          status: 1
        }
      }
    ];

    console.log('\n🔍 Running aggregation pipeline...\n');
    const result = await Queue.aggregate(pipeline);

    console.log(`📊 Found ${result.length} results\n`);

    result.forEach((item, index) => {
      console.log(`${index + 1}. Queue #${item.queueNumber} - ${item.serviceName}`);
      console.log(`   Office: ${item.office}`);
      console.log(`   Customer Name: ${item.customerName}`);
      console.log(`   Rating: ${item.rating}`);
      console.log('');
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testAggregation();

