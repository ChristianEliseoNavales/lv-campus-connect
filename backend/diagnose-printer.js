/**
 * Diagnostic script to analyze thermal printer behavior
 * This will help identify why the printer keeps rolling paper
 */

const printerService = require('./services/printerService');
const fs = require('fs');
const path = require('path');

console.log('\n' + '='.repeat(70));
console.log('THERMAL PRINTER DIAGNOSTIC TOOL');
console.log('='.repeat(70));
console.log('\nThis tool will help diagnose the paper rolling issue.\n');

async function runDiagnostics() {
  try {
    // Test 1: Check what's in the receipt file
    console.log('📋 TEST 1: Analyzing Receipt Content');
    console.log('-'.repeat(70));
    
    const receiptData = {
      queueNumber: 99,
      location: 'COMLAB A',
      windowName: 'Window 1',
      validityDate: 'November 2, 2025',
      department: "Registrar's Office"
    };

    const receiptText = printerService.formatReceipt({
      queueNumber: '99',
      location: receiptData.location,
      windowName: receiptData.windowName,
      validityDate: receiptData.validityDate,
      department: receiptData.department
    });

    console.log('\n📄 Receipt Content (visible):');
    console.log('─'.repeat(70));
    console.log(receiptText);
    console.log('─'.repeat(70));

    // Show byte analysis
    console.log('\n🔍 Byte Analysis:');
    console.log(`Total length: ${receiptText.length} characters`);
    console.log(`Total bytes: ${Buffer.from(receiptText, 'utf8').length} bytes`);
    
    // Count newlines
    const newlineCount = (receiptText.match(/\n/g) || []).length;
    console.log(`Newline characters: ${newlineCount}`);
    
    // Check for special characters
    const hasFormFeed = receiptText.includes('\f');
    const hasCarriageReturn = receiptText.includes('\r');
    const hasESCCommands = receiptText.includes('\x1B');
    
    console.log(`Form feed (\\f): ${hasFormFeed ? 'YES ✓' : 'NO'}`);
    console.log(`Carriage return (\\r): ${hasCarriageReturn ? 'YES ✓' : 'NO'}`);
    console.log(`ESC/POS commands (\\x1B): ${hasESCCommands ? 'YES ✓' : 'NO'}`);

    // Show last 50 characters in hex
    console.log('\n🔬 Last 50 characters (hex view):');
    const lastChars = receiptText.slice(-50);
    const hexView = Buffer.from(lastChars, 'utf8').toString('hex').match(/.{1,2}/g).join(' ');
    console.log(hexView);
    
    // Decode the hex
    console.log('\n📖 Decoded last characters:');
    for (let i = 0; i < lastChars.length; i++) {
      const char = lastChars[i];
      const code = char.charCodeAt(0);
      if (code === 10) {
        console.log(`  [${i}] \\n (newline, 0x0A)`);
      } else if (code === 13) {
        console.log(`  [${i}] \\r (carriage return, 0x0D)`);
      } else if (code === 12) {
        console.log(`  [${i}] \\f (form feed, 0x0C)`);
      } else if (code === 27) {
        console.log(`  [${i}] ESC (escape, 0x1B)`);
      } else if (code < 32) {
        console.log(`  [${i}] <control char 0x${code.toString(16).toUpperCase()}>`);
      } else {
        console.log(`  [${i}] '${char}' (0x${code.toString(16).toUpperCase()})`);
      }
    }

    // Test 2: Check printer driver settings
    console.log('\n\n📊 TEST 2: Checking Printer Configuration');
    console.log('-'.repeat(70));
    
    const status = printerService.getStatus();
    console.log('Printer Name:', status.printerName);
    console.log('Printer Port:', status.printerPort);
    console.log('Test Mode:', status.testMode);

    // Test 3: Recommendations
    console.log('\n\n💡 TEST 3: Diagnostic Results & Recommendations');
    console.log('-'.repeat(70));
    
    console.log('\n🔍 ANALYSIS:');
    console.log('The issue is likely caused by one of these:');
    console.log('');
    console.log('1. NOTEPAD ADDS FORM FEED:');
    console.log('   - Notepad /p may be adding a form feed at the end');
    console.log('   - This causes thermal printer to advance to "next page"');
    console.log('   - On continuous paper, this means rolling a lot of paper');
    console.log('');
    console.log('2. PRINTER DRIVER SETTINGS:');
    console.log('   - Generic/Text Only driver may have page size configured');
    console.log('   - Check: Control Panel > Devices > POS-58-Text > Properties');
    console.log('   - Look for: Paper Size, Form Feed, Page Length settings');
    console.log('');
    console.log('3. PRINTER HARDWARE SETTINGS:');
    console.log('   - The printer itself may have auto-cut disabled');
    console.log('   - Check printer DIP switches or configuration');
    console.log('');
    
    console.log('\n✅ SOLUTIONS TO TRY:');
    console.log('');
    console.log('Solution A: Check Printer Driver Settings');
    console.log('  1. Open Control Panel > Devices and Printers');
    console.log('  2. Right-click "POS-58-Text" > Printer Properties');
    console.log('  3. Go to "Device Settings" or "Advanced" tab');
    console.log('  4. Look for "Form Feed" or "Page Length" settings');
    console.log('  5. Try setting page length to minimum (e.g., 1 inch)');
    console.log('');
    console.log('Solution B: Switch to Raw Port Printing');
    console.log('  - Bypass notepad entirely');
    console.log('  - Send data directly to USB001 port');
    console.log('  - Full control over ESC/POS commands');
    console.log('  - I can implement this if needed');
    console.log('');
    console.log('Solution C: Add Form Feed Before Cut');
    console.log('  - Add \\f character to trigger page break');
    console.log('  - Then immediately cut');
    console.log('  - May prevent excessive rolling');
    console.log('');

    console.log('\n' + '='.repeat(70));
    console.log('DIAGNOSTIC COMPLETE');
    console.log('='.repeat(70));
    console.log('\nNext steps:');
    console.log('1. Check the printer driver settings (Solution A)');
    console.log('2. If that doesn\'t work, I can implement raw port printing (Solution B)');
    console.log('3. Or we can try adding form feed control (Solution C)');
    console.log('');

  } catch (error) {
    console.error('\n❌ Diagnostic failed:', error);
  }
}

// Run diagnostics
runDiagnostics();

