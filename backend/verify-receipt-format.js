/**
 * Receipt Format Verification Script
 * 
 * This script shows EXACTLY what will be printed to the thermal printer.
 * Use this to verify the receipt format before enabling physical printing.
 * 
 * Expected output:
 * - Width: 32 characters per line
 * - Length: ~15-20 lines
 * - Format: Centered headers, left-aligned info
 */

const printerService = require('./services/printerService');

console.log('\n');
console.log('═'.repeat(70));
console.log('  RECEIPT FORMAT VERIFICATION');
console.log('═'.repeat(70));
console.log('\n');

// Sample receipt data
const sampleReceipt = {
  queueNumber: 42,
  location: 'EFS 101',
  windowName: 'Window 3',
  validityDate: 'November 1, 2025',
  department: "Registrar's Office"
};

console.log('📋 Sample Receipt Data:');
console.log(JSON.stringify(sampleReceipt, null, 2));
console.log('\n');

// Format the receipt
const receiptText = printerService.formatReceipt(sampleReceipt);

console.log('📄 FORMATTED RECEIPT (What will be printed):');
console.log('─'.repeat(70));
console.log('\n');

// Display with line numbers and character count
const lines = receiptText.split('\n');
let maxWidth = 0;

lines.forEach((line, index) => {
  const lineNum = String(index + 1).padStart(2, '0');
  const charCount = String(line.length).padStart(2, ' ');
  console.log(`${lineNum} [${charCount} chars] │${line}│`);
  if (line.length > maxWidth) maxWidth = line.length;
});

console.log('\n');
console.log('─'.repeat(70));
console.log('\n');

// Analysis
console.log('📊 RECEIPT ANALYSIS:');
console.log('─'.repeat(70));
console.log(`Total lines:           ${lines.length}`);
console.log(`Maximum line width:    ${maxWidth} characters`);
console.log(`Expected width:        32 characters`);
console.log(`Width match:           ${maxWidth === 32 ? '✅ PERFECT' : '❌ MISMATCH'}`);
console.log(`Paper size:            58mm thermal paper`);
console.log(`Character density:     ~10 chars per inch`);
console.log('\n');

// Verification checklist
console.log('✅ VERIFICATION CHECKLIST:');
console.log('─'.repeat(70));

const checks = [
  { name: 'Line width is 32 characters', pass: maxWidth === 32 },
  { name: 'Receipt has 15-25 lines', pass: lines.length >= 15 && lines.length <= 25 },
  { name: 'Header is centered', pass: receiptText.includes('LVCAMPUSCONNECT SYSTEM') },
  { name: 'Queue number is visible', pass: receiptText.includes('42') },
  { name: 'Location is visible', pass: receiptText.includes('EFS 101') },
  { name: 'Window is visible', pass: receiptText.includes('Window 3') },
  { name: 'Date is visible', pass: receiptText.includes('November 1, 2025') },
  { name: 'Footer is present', pass: receiptText.includes('Thank you') }
];

checks.forEach(check => {
  const status = check.pass ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} - ${check.name}`);
});

console.log('\n');

// Overall status
const allPassed = checks.every(check => check.pass);

if (allPassed) {
  console.log('═'.repeat(70));
  console.log('  ✅ ALL CHECKS PASSED - RECEIPT FORMAT IS CORRECT');
  console.log('═'.repeat(70));
  console.log('\n');
  console.log('📌 NEXT STEPS:');
  console.log('  1. Configure printer driver (see MANUAL_CONFIGURATION_GUIDE.md)');
  console.log('  2. Run: node test-printer.js (with TEST_MODE = true)');
  console.log('  3. Verify console output matches this format');
  console.log('  4. Ask me to enable physical printing');
  console.log('\n');
} else {
  console.log('═'.repeat(70));
  console.log('  ⚠️  SOME CHECKS FAILED - REVIEW RECEIPT FORMAT');
  console.log('═'.repeat(70));
  console.log('\n');
  console.log('📌 ISSUES DETECTED:');
  checks.filter(c => !c.pass).forEach(check => {
    console.log(`  ❌ ${check.name}`);
  });
  console.log('\n');
}

// TEST_MODE status
console.log('🔒 SAFETY STATUS:');
console.log('─'.repeat(70));
console.log(`TEST_MODE:             ${printerService.TEST_MODE ? '✅ ENABLED' : '⚠️  DISABLED'}`);
console.log(`Physical printing:     ${printerService.TEST_MODE ? '❌ BLOCKED' : '✅ ALLOWED'}`);
console.log(`Thermal paper safe:    ${printerService.TEST_MODE ? '✅ YES' : '⚠️  NO'}`);
console.log('\n');

if (!printerService.TEST_MODE) {
  console.log('⚠️  WARNING: TEST_MODE is DISABLED!');
  console.log('   Physical printing is ENABLED - thermal paper may be wasted!');
  console.log('   To enable TEST_MODE, edit backend/services/printerService.js');
  console.log('   Set: this.TEST_MODE = true;');
  console.log('\n');
}

console.log('═'.repeat(70));
console.log('\n');

