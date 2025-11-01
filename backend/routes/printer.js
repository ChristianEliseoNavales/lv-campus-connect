const express = require('express');
const router = express.Router();
const printerService = require('../services/printerService');

/**
 * Printer Routes for LVCampusConnect System
 * Handles thermal receipt printing for queue tickets
 */

/**
 * @route   POST /api/printer/print-receipt
 * @desc    Print queue receipt on thermal printer
 * @access  Public (Kiosk)
 * @body    {queueNumber, location, windowName, validityDate, department}
 */
router.post('/print-receipt', async (req, res) => {
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
});

/**
 * @route   GET /api/printer/test
 * @desc    Test printer connection and print test receipt
 * @access  Public (for testing)
 */
router.get('/test', async (req, res) => {
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
});

/**
 * @route   GET /api/printer/status
 * @desc    Get printer status and configuration
 * @access  Public
 */
router.get('/status', (req, res) => {
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
});

module.exports = router;

