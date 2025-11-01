/**
 * MINIMAL THERMAL PRINTER TEST
 * 
 * This script prints ONLY ONE LINE to verify if the printer can handle
 * 32 characters per line without wasting thermal paper.
 * 
 * What will be printed:
 * ================================
 * 
 * That's it! Just 32 equal signs on one line.
 * 
 * EXPECTED RESULT:
 * - If working correctly: You'll see a line of 32 equal signs across the paper
 * - If still broken: You'll see only 3 equal signs (===) on the paper
 * 
 * SAFETY:
 * - TEST_MODE must be set to FALSE for this to work
 * - Only prints ONE line (minimal paper waste)
 * - Quick verification test
 */

const printerService = require('./services/printerService');

console.log('\n');
console.log('═'.repeat(70));
console.log('  MINIMAL THERMAL PRINTER TEST');
console.log('═'.repeat(70));
console.log('\n');

// Check TEST_MODE status
if (printerService.TEST_MODE) {
  console.log('⚠️  WARNING: TEST_MODE is ENABLED');
  console.log('');
  console.log('This test requires TEST_MODE to be DISABLED to print to the physical printer.');
  console.log('');
  console.log('What will be printed (preview):');
  console.log('─'.repeat(70));
  const testReceipt = printerService.formatMinimalTestReceipt();
  console.log(testReceipt);
  console.log('─'.repeat(70));
  console.log('');
  console.log('📏 Analysis:');
  console.log(`   Line width: ${32} characters`);
  console.log(`   Total lines: 1 line (plus paper feed)`);
  console.log(`   Paper waste: ~2-3 cm`);
  console.log('');
  console.log('✅ To enable physical printing:');
  console.log('   1. Open: backend/services/printerService.js');
  console.log('   2. Find line 29: this.TEST_MODE = true;');
  console.log('   3. Change to: this.TEST_MODE = false;');
  console.log('   4. Save the file');
  console.log('   5. Run this script again: node test-minimal-print.js');
  console.log('');
  console.log('═'.repeat(70));
  console.log('\n');
  process.exit(0);
}

// TEST_MODE is disabled, proceed with actual printing
console.log('✅ TEST_MODE is DISABLED - Physical printing enabled');
console.log('');
console.log('🖨️  Preparing minimal test print...');
console.log('');

async function runMinimalTest() {
  try {
    // Get printer status
    const status = printerService.getStatus();
    console.log('📊 Printer Status:');
    console.log(`   Name: ${status.printerName}`);
    console.log(`   Port: ${status.printerPort}`);
    console.log(`   Test Mode: ${status.testMode ? 'ENABLED' : 'DISABLED'}`);
    console.log('');

    // Format minimal test receipt
    const testReceipt = printerService.formatMinimalTestReceipt();
    
    console.log('📄 What will be printed:');
    console.log('─'.repeat(70));
    console.log(testReceipt);
    console.log('─'.repeat(70));
    console.log('');
    console.log('📏 Analysis:');
    console.log(`   Line width: 32 characters (32 equal signs)`);
    console.log(`   Total lines: 1 line`);
    console.log(`   Paper waste: ~2-3 cm (minimal)`);
    console.log('');

    // Print to physical printer using RAW ESC/POS
    console.log('🖨️  Sending to printer using RAW ESC/POS...');
    console.log('');

    await printerService.printWithRawESCPOS(testReceipt);
    
    console.log('');
    console.log('═'.repeat(70));
    console.log('  ✅ PRINT JOB SENT TO PRINTER');
    console.log('═'.repeat(70));
    console.log('');
    console.log('📋 VERIFICATION INSTRUCTIONS:');
    console.log('');
    console.log('Check the printed receipt and count the equal signs (=):');
    console.log('');
    console.log('✅ SUCCESS: If you see 32 equal signs in a row');
    console.log('   ================================');
    console.log('   (The line should span most of the 58mm paper width)');
    console.log('');
    console.log('❌ FAILURE: If you see only 3 equal signs');
    console.log('   ===');
    console.log('   (The line is very short, only ~7mm wide)');
    console.log('');
    console.log('📞 REPORT BACK:');
    console.log('   Tell me: "I see 32 equal signs" or "I see only 3 equal signs"');
    console.log('');
    console.log('═'.repeat(70));
    console.log('');

  } catch (error) {
    console.error('');
    console.error('═'.repeat(70));
    console.error('  ❌ ERROR DURING PRINTING');
    console.error('═'.repeat(70));
    console.error('');
    console.error('Error:', error.message);
    console.error('');
    console.error('Possible causes:');
    console.error('  1. Printer is offline or not ready');
    console.error('  2. Printer name is incorrect');
    console.error('  3. USB cable is disconnected');
    console.error('  4. Printer is out of paper');
    console.error('');
    console.error('═'.repeat(70));
    console.error('');
    process.exit(1);
  }
}

runMinimalTest();

