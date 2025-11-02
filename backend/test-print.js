/**
 * Test script to verify the new direct port printing works
 */

const printerService = require('./services/printerService');

console.log('\n' + '='.repeat(70));
console.log('TESTING DIRECT PORT PRINTING');
console.log('='.repeat(70));
console.log('\nThis will test the new printing method that bypasses notepad.\n');

async function testPrint() {
  try {
    const receiptData = {
      queueNumber: '99',
      location: 'COMLAB A',
      windowName: 'Window 1',
      validityDate: 'November 2, 2025',
      department: "Registrar's Office"
    };

    console.log('📋 Receipt Data:');
    console.log(JSON.stringify(receiptData, null, 2));
    console.log('');

    console.log('🖨️  Attempting to print...');
    console.log('');

    const result = await printerService.printQueueReceipt(receiptData);

    if (result.success) {
      console.log('');
      console.log('✅ SUCCESS! Print test completed.');
      console.log('');
      console.log('If TEST_MODE is enabled, check the console output above.');
      console.log('If TEST_MODE is disabled, check if the printer printed correctly.');
      console.log('');
      console.log('Key things to verify:');
      console.log('1. Did the printer stop feeding paper after printing?');
      console.log('2. Was the receipt cut properly?');
      console.log('3. Is all content visible on the receipt?');
    } else {
      console.log('');
      console.log('❌ FAILED! Print test failed.');
      console.log('Error:', result.error);
    }

    console.log('');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('');
    console.error('❌ Test failed with error:');
    console.error(error);
    console.error('');
    console.error('='.repeat(70));
  }
}

testPrint();

