require('dotenv').config();
const mongoose = require('mongoose');
const Queue = require('../models/Queue');
const Rating = require('../models/Rating');
const Service = require('../models/Service');
const VisitationForm = require('../models/VisitationForm');

async function analyzeRatingsIssue() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log('=' .repeat(80));
    console.log('ANALYZING RATINGS DATA ISSUE');
    console.log('=' .repeat(80));

    // 1. Check Queue collection for ratings
    console.log('\n📊 PART 1: Queue Collection Analysis');
    console.log('-'.repeat(80));
    
    const queuesWithRatings = await Queue.find({ 
      rating: { $exists: true, $ne: null } 
    }).limit(5);
    
    console.log(`Found ${queuesWithRatings.length} queues with ratings in Queue collection`);
    
    for (const queue of queuesWithRatings) {
      const service = await Service.findById(queue.serviceId);
      const visitationForm = queue.visitationFormId ? 
        await VisitationForm.findById(queue.visitationFormId) : null;
      
      console.log('\n  Queue Entry:');
      console.log(`    - Queue Number: ${queue.queueNumber}`);
      console.log(`    - Office: ${queue.office}`);
      console.log(`    - Service: ${service?.name || 'Unknown'}`);
      console.log(`    - Rating: ${queue.rating}`);
      console.log(`    - Has VisitationForm: ${!!visitationForm}`);
      console.log(`    - VisitationForm CustomerName: ${visitationForm?.customerName || 'N/A'}`);
      console.log(`    - Student Status: ${queue.studentStatus || 'N/A'}`);
    }

    // 2. Check Rating collection
    console.log('\n\n📊 PART 2: Rating Collection Analysis');
    console.log('-'.repeat(80));
    
    const ratingsCount = await Rating.countDocuments();
    console.log(`Total ratings in Rating collection: ${ratingsCount}`);
    
    if (ratingsCount > 0) {
      const sampleRatings = await Rating.find().limit(5);
      
      for (const rating of sampleRatings) {
        console.log('\n  Rating Entry:');
        console.log(`    - Customer Name: ${rating.customerName}`);
        console.log(`    - Rating: ${rating.rating}`);
        console.log(`    - Office: ${rating.office}`);
        console.log(`    - Queue ID: ${rating.queueId}`);
        
        // Check if the queue still exists
        const queue = await Queue.findById(rating.queueId);
        if (queue) {
          const service = await Service.findById(queue.serviceId);
          console.log(`    - Queue Service: ${service?.name || 'Unknown'}`);
          console.log(`    - Queue Office: ${queue.office}`);
        } else {
          console.log(`    - Queue: NOT FOUND (deleted)`);
        }
      }
    }

    // 3. Test the aggregation pipeline
    console.log('\n\n📊 PART 3: Testing Aggregation Pipeline');
    console.log('-'.repeat(80));
    
    const pipeline = [
      { $match: { rating: { $exists: true, $ne: null } } },
      {
        $lookup: {
          from: 'visitationforms',
          localField: 'visitationFormId',
          foreignField: '_id',
          as: 'visitationForm'
        }
      },
      {
        $lookup: {
          from: 'services',
          let: { serviceIdStr: { $toString: '$serviceId' } },
          pipeline: [
            { $match: { $expr: { $eq: [{ $toString: '$_id' }, '$$serviceIdStr'] } } }
          ],
          as: 'service'
        }
      },
      { $unwind: { path: '$visitationForm', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          customerName: {
            $ifNull: [
              '$visitationForm.customerName',
              {
                $cond: {
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
          serviceName: '$service.name'
        }
      },
      { $limit: 5 },
      {
        $project: {
          queueNumber: 1,
          office: 1,
          rating: 1,
          customerName: 1,
          serviceName: 1
        }
      }
    ];

    const aggregationResult = await Queue.aggregate(pipeline);
    
    console.log(`\nAggregation returned ${aggregationResult.length} results:`);
    aggregationResult.forEach((item, index) => {
      console.log(`\n  ${index + 1}. Queue #${item.queueNumber}`);
      console.log(`     Service: ${item.serviceName}`);
      console.log(`     Office: ${item.office}`);
      console.log(`     Customer Name: ${item.customerName}`);
      console.log(`     Rating: ${item.rating}`);
    });

    console.log('\n\n' + '='.repeat(80));
    console.log('ANALYSIS COMPLETE');
    console.log('='.repeat(80));

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

analyzeRatingsIssue();

