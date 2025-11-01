/**
 * ALIGNMENT DIAGNOSTIC TEST
 * 
 * This prints a ruler pattern to identify where extra spaces are being added
 */

const printerService = require('./services/printerService');

console.log('\n');
console.log('═'.repeat(70));
console.log('  ALIGNMENT DIAGNOSTIC TEST');
console.log('═'.repeat(70));
console.log('\n');

// Check TEST_MODE status
if (printerService.TEST_MODE) {
  console.log('⚠️  WARNING: TEST_MODE is ENABLED');
  console.log('');
  console.log('This test requires TEST_MODE to be DISABLED to print to the physical printer.');
  console.log('');
  console.log('✅ To enable physical printing:');
  console.log('   1. Open: backend/services/printerService.js');
  console.log('   2. Find line 29: this.TEST_MODE = true;');
  console.log('   3. Change to: this.TEST_MODE = false;');
  console.log('   4. Save the file');
  console.log('   5. Run this script again: node test-alignment.js');
  console.log('');
  console.log('═'.repeat(70));
  console.log('\n');
  process.exit(0);
}

// TEST_MODE is disabled, proceed with actual printing
console.log('✅ TEST_MODE is DISABLED - Physical printing enabled');
console.log('');
console.log('🖨️  Preparing alignment diagnostic test...');
console.log('');

async function runAlignmentTest() {
  try {
    // Create alignment test pattern (18 characters per line)
    let testReceipt = '';

    // Line 1: Ruler (position markers)
    testReceipt += '123456789012345678\n';

    // Line 2: All equal signs (should be exactly 18 chars)
    testReceipt += '==================\n';

    // Line 3: Alternating pattern
    testReceipt += '|-|-|-|-|-|-|-|-|-\n';

    // Line 4: Left-aligned text (no spaces at start)
    testReceipt += 'LEFT ALIGNED\n';

    // Line 5: Manually centered (3 spaces + text + 3 spaces = 18)
    testReceipt += '  CENTERED TEXT  \n';

    // Line 6: All dashes
    testReceipt += '------------------\n';

    // Line 7: Numbers at specific positions
    testReceipt += '1        9       18\n';

    // Line 8: Another ruler
    testReceipt += 'ABCDEFGHIJKLMNOPQR\n';

    // Line 9: All equal signs again
    testReceipt += '==================\n';

    // Line 10: Empty line
    testReceipt += '\n';

    // Line 11: Paper feed
    testReceipt += '\n';

    console.log('📄 What will be printed:');
    console.log('─'.repeat(70));
    console.log(testReceipt);
    console.log('─'.repeat(70));
    console.log('');
    console.log('📏 Analysis:');
    console.log('   Each line should be EXACTLY 18 characters');
    console.log('   Line 1: Position ruler (1-18)');
    console.log('   Line 2: All equal signs');
    console.log('   Line 3: Alternating pattern');
    console.log('   Line 4: Left-aligned (starts at position 1)');
    console.log('   Line 5: Manually centered (2 spaces on each side)');
    console.log('   Line 7: Numbers at positions 1, 9, and 18');
    console.log('');

    // Print using the service
    console.log('🖨️  Sending to printer...');
    console.log('');

    await printerService.printWithRawESCPOS(testReceipt);

    console.log('');
    console.log('═'.repeat(70));
    console.log('  ✅ ALIGNMENT TEST SENT TO PRINTER');
    console.log('═'.repeat(70));
    console.log('');
    console.log('📋 VERIFICATION INSTRUCTIONS:');
    console.log('');
    console.log('Look at the printed receipt and check:');
    console.log('');
    console.log('1. Does the ruler line show 1-18 in order ON ONE LINE?');
    console.log('   Expected: 123456789012345678');
    console.log('   SUCCESS = All on one line, no wrapping');
    console.log('');
    console.log('2. Do all the equal signs line up vertically?');
    console.log('   Lines 2 and 9 should be identical');
    console.log('');
    console.log('3. Does "LEFT ALIGNED" start at the very left edge?');
    console.log('   No wrapping, all on one line');
    console.log('');
    console.log('4. Is "CENTERED TEXT" truly centered?');
    console.log('   Should have equal space on both sides');
    console.log('');
    console.log('5. On line 7, are the numbers at the correct positions?');
    console.log('   "1" at start, "9" in middle, "18" at end');
    console.log('');
    console.log('📞 REPORT BACK:');
    console.log('   Tell me if ALL lines print on ONE line each (no wrapping)');
    console.log('   Example: "Perfect! No wrapping!" or "Still wrapping at line X"');
    console.log('');
    console.log('═'.repeat(70));
    console.log('\n');

  } catch (error) {
    console.log('');
    console.log('═'.repeat(70));
    console.log('  ❌ ERROR DURING PRINTING');
    console.log('═'.repeat(70));
    console.log('');
    console.log('Error:', error.message);
    console.log('');
    console.log('Possible causes:');
    console.log('  1. Printer is offline or not ready');
    console.log('  2. Printer name is incorrect');
    console.log('  3. USB cable is disconnected');
    console.log('  4. Printer is out of paper');
    console.log('');
    console.log('═'.repeat(70));
    console.log('\n');
    process.exit(1);
  }
}

runAlignmentTest();

