const printerService = require('../services/printerService');

// POST /api/printer/print-receipt - Print queue receipt on thermal printer
async function printReceipt(req, res, next) {
  try {
    const { queueNumber, location, windowName, validityDate, department } = req.body;

    console.log('📥 Print receipt request received');
    console.log('📋 Request body:', req.body);

    // Validate required fields
    if (!queueNumber) {
      return res.status(400).json({
        success: false,
        message: 'Queue number is required'
      });
    }

    if (!location) {
      return res.status(400).json({
        success: false,
        message: 'Location is required'
      });
    }

    if (!windowName) {
      return res.status(400).json({
        success: false,
        message: 'Window name is required'
      });
    }

    if (!validityDate) {
      return res.status(400).json({
        success: false,
        message: 'Validity date is required'
      });
    }

    // Print receipt using printer service
    const result = await printerService.printQueueReceipt({
      queueNumber,
      location,
      windowName,
      validityDate,
      department: department || 'Unknown'
    });

    if (result.success) {
      console.log('✅ Receipt printed successfully');
      res.json({
        success: true,
        message: result.message,
        data: {
          queueNumber: result.queueNumber,
          printedAt: new Date().toISOString()
        }
      });
    } else {
      console.error('❌ Print failed:', result.message);
      res.status(500).json({
        success: false,
        message: result.message,
        error: result.error
      });
    }

  } catch (error) {
    console.error('❌ Print receipt error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while printing receipt',
      error: error.message
    });
  }
}

// GET /api/printer/test - Test printer connection and print test receipt
async function testPrinter(req, res, next) {
  try {
    console.log('🧪 Printer test request received');
    
    const result = await printerService.testPrinter();
    
    if (result.success) {
      console.log('✅ Printer test successful');
      res.json({
        success: true,
        message: result.message,
        timestamp: new Date().toISOString()
      });
    } else {
      console.error('❌ Printer test failed:', result.message);
      res.status(500).json({
        success: false,
        message: result.message,
        error: result.error
      });
    }
  } catch (error) {
    console.error('❌ Printer test error:', error);
    res.status(500).json({
      success: false,
      message: 'Printer test failed',
      error: error.message
    });
  }
}

// GET /api/printer/status - Get printer status and configuration
async function getPrinterStatus(req, res, next) {
  try {
    const status = printerService.getStatus();

    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Get printer status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get printer status',
      error: error.message
    });
  }
}

// GET /api/printer/check-availability - Check if printer is available and ready to print
async function checkPrinterAvailability(req, res, next) {
  try {
    console.log('🔍 Checking printer availability...');

    const availability = await printerService.checkAvailability();

    if (availability.available && availability.ready) {
      console.log('✅ Printer is available and ready');
      res.json({
        success: true,
        available: true,
        ready: true,
        message: availability.message,
        timestamp: new Date().toISOString()
      });
    } else if (availability.available && !availability.ready) {
      console.log('⚠️ Printer found but not ready');
      res.json({
        success: true,
        available: true,
        ready: false,
        message: availability.message,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log('❌ Printer not available');
      res.json({
        success: true,
        available: false,
        ready: false,
        message: availability.message,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('❌ Printer availability check error:', error);
    res.status(500).json({
      success: false,
      available: false,
      ready: false,
      message: 'Failed to check printer availability',
      error: error.message
    });
  }
}

module.exports = {
  printReceipt,
  testPrinter,
  getPrinterStatus,
  checkPrinterAvailability
};


