const fetch = require('node-fetch');

// Test the new time range filters
async function testNewTimeRanges() {
  console.log('🧪 Testing New Time Range Filters...');
  
  const baseUrl = 'http://localhost:5000/api/analytics';
  const timeRanges = ['year', '6months', '3months', '1month'];
  
  for (const timeRange of timeRanges) {
    console.log(`\n📊 Testing ${timeRange} filter...`);
    
    try {
      // Test pie chart endpoint
      const pieResponse = await fetch(`${baseUrl}/pie-chart/registrar?timeRange=${timeRange}`);
      const pieData = await pieResponse.json();
      
      if (pieData.success) {
        console.log(`✅ Pie Chart (${timeRange}): ${pieData.data.length} services, ${pieData.total} total queues`);
        pieData.data.forEach((service, index) => {
          console.log(`   ${index + 1}. ${service.service}: ${service.count} (${service.percentage}%)`);
        });
      } else {
        console.log(`❌ Pie Chart (${timeRange}): ${pieData.error}`);
      }
      
      // Test area chart endpoint
      const areaResponse = await fetch(`${baseUrl}/area-chart/registrar?timeRange=${timeRange}`);
      const areaData = await areaResponse.json();
      
      if (areaData.success) {
        console.log(`✅ Area Chart (${timeRange}): ${areaData.data.length} data points, ${areaData.totalQueues} total queues`);
        // Show first 3 and last 3 data points
        const data = areaData.data;
        if (data.length > 0) {
          console.log(`   First: ${data[0].month} - ${data[0].count} queues`);
          if (data.length > 1) {
            console.log(`   Second: ${data[1].month} - ${data[1].count} queues`);
          }
          if (data.length > 2) {
            console.log(`   Last: ${data[data.length - 1].month} - ${data[data.length - 1].count} queues`);
          }
        }
      } else {
        console.log(`❌ Area Chart (${timeRange}): ${areaData.error}`);
      }
      
    } catch (error) {
      console.log(`❌ Error testing ${timeRange}: ${error.message}`);
    }
  }
  
  console.log('\n✅ Time range filter testing completed!');
}

// Run the test
testNewTimeRanges().catch(console.error);
