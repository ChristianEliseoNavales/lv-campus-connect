const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Printer Service for LVCampusConnect System
 * Handles thermal receipt printing for queue tickets
 *
 * CONFIGURATION:
 * - TEST_MODE: Set to true to prevent actual printing (saves thermal paper during testing)
 * - PRINTER_PORT: The Windows port name for the thermal printer (e.g., 'USB001', 'COM1')
 *
 * To find your printer port:
 * 1. Open Control Panel > Devices and Printers
 * 2. Right-click on POS-58 printer > Printer Properties
 * 3. Go to Ports tab
 * 4. Look for the checked port (e.g., USB001, COM1, etc.)
 *
 * TROUBLESHOOTING:
 * - If receipt prints with only 3 characters per line, the Windows Print Spooler is applying
 *   document formatting. This service uses RAW printing mode to bypass that.
 * - RAW mode sends data directly to the printer port without formatting
 * - Make sure the printer port (USB001, COM1, etc.) is correct
 */
class PrinterService {
  constructor() {
    // WARNING: Set to true during testing to prevent paper waste
    this.TEST_MODE = false;  // DISABLED - Will print to physical printer

    this.printerName = 'POS-58-Text';  // Using Generic/Text Only driver (no margins)
    this.printerPort = 'USB001';  // Printer port - update this based on your setup
    this.isInitialized = true;
    this.tempDir = path.join(os.tmpdir(), 'lvcampus-receipts');

    // Create temp directory for receipt files
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }

    console.log('='.repeat(60));
    console.log('THERMAL PRINTER SERVICE INITIALIZED');
    console.log('='.repeat(60));
    console.log('Printer name:', this.printerName);
    console.log('Printer port:', this.printerPort);
    console.log('Printer type: RAW ESC/POS (binary commands)');
    console.log('TEST MODE:', this.TEST_MODE ? 'ENABLED (No actual printing)' : 'DISABLED (Will print to physical printer)');
    console.log('Temp directory:', this.tempDir);

    if (this.TEST_MODE) {
      console.log('');
      console.log('WARNING: TEST MODE ACTIVE');
      console.log('- Receipts will be saved to files but NOT printed');
      console.log('- Receipt content will be displayed in console');
      console.log('- To enable actual printing, set TEST_MODE = false');
    } else {
      console.log('');
      console.log('PRODUCTION MODE ACTIVE');
      console.log('- Using RAW ESC/POS binary commands');
      console.log('- Direct printer control (no text wrapping)');
      console.log('- Make sure printer is connected and ready');
    }
    console.log('='.repeat(60));
  }

  async printQueueReceipt(receiptData) {
    try {
      const { queueNumber, location, windowName, validityDate, department } = receiptData;

      console.log('Starting print job...');
      console.log('Receipt data:', { queueNumber, location, windowName, validityDate, department });

      const formattedQueueNumber = queueNumber.toString().padStart(2, '0');

      const receiptText = this.formatReceipt({
        queueNumber: formattedQueueNumber,
        location,
        windowName,
        validityDate,
        department
      });

      const timestamp = Date.now();
      const filename = `receipt_${formattedQueueNumber}_${timestamp}.txt`;
      const filepath = path.join(this.tempDir, filename);

      fs.writeFileSync(filepath, receiptText, 'utf8');
      console.log('Receipt file created:', filepath);

      if (this.TEST_MODE) {
        this.displayReceiptInConsole(receiptText, formattedQueueNumber);

        console.log('');
        console.log('TEST MODE: Receipt NOT sent to printer');
        console.log('Receipt saved to:', filepath);

        return {
          success: true,
          message: 'Receipt created successfully (TEST MODE - not printed)',
          queueNumber: formattedQueueNumber,
          testMode: true,
          filepath: filepath
        };
      }

      // Use notepad for printing (simple and reliable)
      await this.printWithNotepad(filepath);

      console.log('Receipt printed successfully');
      console.log('Queue Number:', formattedQueueNumber);

      setTimeout(() => {
        try {
          if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
          }
        } catch (err) {
          console.error('Failed to delete temp file:', err.message);
        }
      }, 5000);

      return {
        success: true,
        message: 'Receipt printed successfully',
        queueNumber: formattedQueueNumber,
        testMode: false
      };

    } catch (error) {
      console.error('Print error:', error.message);

      let errorMessage = 'Failed to print receipt';

      if (error.message.includes('not found') || error.message.includes('ENOENT')) {
        errorMessage = 'Printer not found. Please check connection.';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Printer timeout. Please check if printer is ready.';
      } else if (error.message.includes('Access is denied')) {
        errorMessage = 'Printer access denied. Please check printer permissions.';
      }

      return {
        success: false,
        message: errorMessage,
        error: error.message
      };
    }
  }

  displayReceiptInConsole(receiptText, queueNumber) {
    console.log('');
    console.log('='.repeat(60));
    console.log('RECEIPT PREVIEW (Queue #' + queueNumber + ')');
    console.log('='.repeat(60));
    console.log(receiptText);
    console.log('='.repeat(60));
    console.log('Receipt length:', receiptText.split('\n').length, 'lines');
    console.log('Max line width:', Math.max(...receiptText.split('\n').map(line => line.length)), 'characters');
    console.log('='.repeat(60));
  }

  /**
   * Format a MINIMAL test receipt (single line for verification)
   * This is used to test if the printer can print 32 characters per line
   * without wasting thermal paper
   * @returns {string} Single line test receipt
   */
  formatMinimalTestReceipt() {
    const width = 32;  // 58mm paper width in characters
    const testLine = '='.repeat(width);

    let receipt = '';
    receipt += testLine + '\n';  // Single line of 32 equal signs
    receipt += '\n\n';  // Feed paper to cut

    return receipt;
  }

  formatReceipt(data) {
    const { queueNumber, location, windowName, validityDate } = data;
    const width = 18;  // Set to 18 to prevent wrapping (printer wraps at ~20)

    const line = '='.repeat(width);
    const dashLine = '-'.repeat(width);

    let receipt = '';

    receipt += line + '\n';
    receipt += this.centerText('LVCAMPUSCONNECT', width) + '\n';
    receipt += this.centerText('SYSTEM', width) + '\n';
    receipt += line + '\n';

    receipt += this.centerText('QUEUE NUMBER', width) + '\n';
    receipt += this.centerText(queueNumber, width) + '\n';
    receipt += dashLine + '\n';

    receipt += 'Location:\n';
    const locationLines = this.wrapText(location, width);
    locationLines.forEach(line => {
      receipt += line + '\n';
    });
    receipt += dashLine + '\n';

    receipt += 'Please Proceed to:\n';
    const windowLines = this.wrapText(windowName, width);
    windowLines.forEach(line => {
      receipt += line + '\n';
    });
    receipt += dashLine + '\n';

    receipt += 'Valid on:\n';
    const dateLines = this.wrapText(validityDate, width);
    dateLines.forEach(line => {
      receipt += line + '\n';
    });
    receipt += line + '\n';

    receipt += this.centerText('Thank you for', width) + '\n';
    receipt += this.centerText('visiting!', width) + '\n';
    receipt += line + '\n';
    receipt += line + '\n';
    receipt += line + '\n';
    return receipt;
  }

  centerText(text, width) {
    if (text.length >= width) return text;
    const totalPadding = width - text.length;
    const leftPadding = Math.floor(totalPadding / 2);
    const rightPadding = totalPadding - leftPadding;
    return ' '.repeat(leftPadding) + text + ' '.repeat(rightPadding);
  }

  /**
   * Print using notepad with PowerShell automation
   * This uses notepad.exe /p and auto-clicks the Print button
   */
  async printWithNotepad(filepath) {
    try {
      console.log('Printing with notepad (automated)...');
      console.log('File:', filepath);
      console.log('Printer:', this.printerName);

      // PowerShell script to automate notepad printing
      const psScript = `
# Start notepad print process
Start-Process notepad -ArgumentList '/p', '${filepath.replace(/\\/g, '\\\\')}' -WindowStyle Hidden

# Wait for print dialog to appear
Start-Sleep -Milliseconds 500

# Load Windows Forms for SendKeys
Add-Type -AssemblyName System.Windows.Forms

# Send Enter key to auto-click Print button
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")

# Wait for print job to complete
Start-Sleep -Milliseconds 1000

# Close any remaining notepad windows
Get-Process notepad -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
      `.trim();

      const timestamp = Date.now();
      const psFile = path.join(this.tempDir, `print_${timestamp}.ps1`);
      fs.writeFileSync(psFile, psScript, 'utf8');

      console.log('Executing automated print...');

      await new Promise((resolve, reject) => {
        exec(`powershell -ExecutionPolicy Bypass -File "${psFile}"`, (error, stdout, stderr) => {
          if (error) {
            console.error('Print automation error:', error.message);
            reject(error);
            return;
          }
          resolve();
        });
      });

      console.log('✓ Print job sent successfully (automated)');

      // Clean up PowerShell script
      setTimeout(() => {
        try {
          if (fs.existsSync(psFile)) fs.unlinkSync(psFile);
        } catch (err) {
          console.error('Failed to delete temp file:', err.message);
        }
      }, 5000);

      return true;
    } catch (error) {
      console.error('Print error:', error);
      throw error;
    }
  }

  printToWindows(filepath) {
    return new Promise((resolve, reject) => {
      // Use PowerShell Out-Printer command WITHOUT -Raw flag
      // This preserves line breaks and prevents text wrapping
      // The Generic/Text Only driver will handle it as plain text
      const command = `powershell -Command "Get-Content '${filepath}' | Out-Printer -Name '${this.printerName}'"`;

      console.log('Sending data to printer:', this.printerName);
      console.log('Command:', command);

      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error('Print command error:', error.message);
          console.error('This usually means:');
          console.error('1. Printer is offline or not ready');
          console.error('2. Printer name is incorrect');
          console.error('3. Access denied (try running as Administrator)');
          reject(error);
          return;
        }
        if (stderr) {
          console.error('Print command stderr:', stderr);
        }
        if (stdout) {
          console.log('Print command output:', stdout);
        }
        console.log('Data sent successfully to printer');
        resolve();
      });
    });
  }

  wrapText(text, maxWidth = 32) {
    if (!text) return [''];

    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    words.forEach(word => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;

      if (testLine.length <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    });

    if (currentLine) lines.push(currentLine);

    return lines.length > 0 ? lines : [''];
  }

  async testPrinter() {
    try {
      console.log('Running printer test...');

      const width = 32;
      const line = '='.repeat(width);
      const timestamp = new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Manila',
        dateStyle: 'medium',
        timeStyle: 'medium'
      });

      let testReceipt = '';
      testReceipt += line + '\n';
      testReceipt += this.centerText('PRINTER TEST', width) + '\n';
      testReceipt += line + '\n';
      testReceipt += 'Connection: OK\n';
      testReceipt += 'Status: Ready\n';
      testReceipt += 'Time: ' + timestamp + '\n';
      testReceipt += line + '\n';
      testReceipt += '\n';
      testReceipt += '\n';
      testReceipt += '\n';

      // ESC/POS partial cut command
      testReceipt += '\x1B\x69';

      const filename = `test_receipt_${Date.now()}.txt`;
      const filepath = path.join(this.tempDir, filename);

      fs.writeFileSync(filepath, testReceipt, 'utf8');

      if (this.TEST_MODE) {
        this.displayReceiptInConsole(testReceipt, 'TEST');
        console.log('TEST MODE: Test receipt NOT sent to printer');
        return {
          success: true,
          message: 'Printer test successful (TEST MODE - not printed).',
          testMode: true
        };
      }

      // Use RAW ESC/POS commands for complete control
      await this.printWithRawESCPOS(testReceipt);

      setTimeout(() => {
        try {
          if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
          }
        } catch (err) {
          console.error('Failed to delete temp file:', err.message);
        }
      }, 5000);

      console.log('Printer test successful');
      return {
        success: true,
        message: 'Printer test successful. Test receipt printed.'
      };

    } catch (error) {
      console.error('Printer test failed:', error.message);
      return {
        success: false,
        message: 'Printer test failed. Please check connection.',
        error: error.message
      };
    }
  }

  getStatus() {
    return {
      initialized: this.isInitialized,
      printerName: this.printerName,
      printerPort: this.printerPort,
      testMode: this.TEST_MODE,
      interface: this.TEST_MODE ? 'Test Mode (No Printing)' : 'RAW Printing to ' + this.printerPort,
      type: 'Text-based printing',
      paperWidth: '58mm',
      tempDirectory: this.tempDir
    };
  }

  /**
   * Check if printer is available and ready
   * This performs a quick check without actually printing
   * @returns {Promise<Object>} Status object with availability info
   */
  async checkAvailability() {
    try {
      // In TEST_MODE, always return available
      if (this.TEST_MODE) {
        return {
          available: true,
          ready: true,
          message: 'Printer available (TEST MODE)',
          testMode: true
        };
      }

      // Check if printer exists in Windows
      const checkCommand = `powershell -Command "Get-Printer -Name '${this.printerName}' -ErrorAction SilentlyContinue | Select-Object Name, PrinterStatus, JobCount"`;

      return new Promise((resolve) => {
        exec(checkCommand, { timeout: 3000 }, (error, stdout, stderr) => {
          if (error) {
            // Printer not found or error occurred
            console.log('Printer check failed:', error.message);
            resolve({
              available: false,
              ready: false,
              message: 'Printer not found or offline',
              error: error.message
            });
            return;
          }

          if (stderr) {
            console.log('Printer check stderr:', stderr);
            resolve({
              available: false,
              ready: false,
              message: 'Printer check error',
              error: stderr
            });
            return;
          }

          // Parse PowerShell output
          const output = stdout.trim();

          if (!output || output.length === 0) {
            resolve({
              available: false,
              ready: false,
              message: 'Printer not found'
            });
            return;
          }

          // If we got output, printer exists
          // Check for common error indicators in the output
          const lowerOutput = output.toLowerCase();

          if (lowerOutput.includes('offline') || lowerOutput.includes('error') || lowerOutput.includes('paused')) {
            resolve({
              available: true,
              ready: false,
              message: 'Printer offline or has errors',
              details: output
            });
            return;
          }

          // Printer exists and appears ready
          resolve({
            available: true,
            ready: true,
            message: 'Printer ready',
            details: output
          });
        });
      });

    } catch (error) {
      console.error('Printer availability check error:', error);
      return {
        available: false,
        ready: false,
        message: 'Failed to check printer status',
        error: error.message
      };
    }
  }
}

module.exports = new PrinterService();
