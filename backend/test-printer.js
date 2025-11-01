/**
 * Quick test script for thermal printer
 * Run with: node test-printer.js
 */

const printerService = require('./services/printerService');

async function testPrinter() {
  console.log('\n🧪 Testing Thermal Printer...\n');
  
  // Test 1: Check printer status
  console.log('📊 Test 1: Checking printer status...');
  const status = printerService.getStatus();
  console.log('Status:', JSON.stringify(status, null, 2));
  console.log('');
  
  // Test 2: Print test receipt
  console.log('📄 Test 2: Printing test receipt...');
  const testResult = await printerService.testPrinter();
  console.log('Result:', JSON.stringify(testResult, null, 2));
  console.log('');
  
  // Test 3: Print queue receipt
  console.log('🎫 Test 3: Printing queue receipt...');
  const queueResult = await printerService.printQueueReceipt({
    queueNumber: 1,
    location: 'EFS 101',
    windowName: 'Window 1',
    validityDate: 'November 1, 2025',
    department: "Registrar's Office"
  });
  console.log('Result:', JSON.stringify(queueResult, null, 2));
  console.log('');
  
  console.log('✅ All tests completed!');
  console.log('💡 Check your printer for output.');
  console.log('');
}

// Run tests
testPrinter().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});

