const fetch = require('node-fetch');

async function testRatingsEndpoint() {
  try {
    console.log('🧪 Testing /api/ratings endpoint...');
    
    const response = await fetch('http://localhost:5000/api/ratings');
    
    if (!response.ok) {
      console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return;
    }
    
    const data = await response.json();
    
    console.log('✅ API Response received');
    console.log('Success:', data.success);
    console.log('Data length:', data.data?.length || 0);
    
    if (data.data && data.data.length > 0) {
      console.log('\n📝 Sample rating from API:');
      const sample = data.data[0];
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
      console.log('❌ No ratings data returned');
    }
    
    if (data.pagination) {
      console.log('\n📊 Pagination info:');
      console.log(data.pagination);
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

testRatingsEndpoint();
