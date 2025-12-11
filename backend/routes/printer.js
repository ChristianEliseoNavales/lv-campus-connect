const express = require('express');
const router = express.Router();
const printerController = require('../controllers/printerController');
const asyncHandler = require('../middleware/asyncHandler');

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
router.post('/print-receipt', asyncHandler(printerController.printReceipt));

/**
 * @route   GET /api/printer/test
 * @desc    Test printer connection and print test receipt
 * @access  Public (for testing)
 */
router.get('/test', asyncHandler(printerController.testPrinter));

/**
 * @route   GET /api/printer/status
 * @desc    Get printer status and configuration
 * @access  Public
 */
router.get('/status', asyncHandler(printerController.getPrinterStatus));

/**
 * @route   GET /api/printer/check-availability
 * @desc    Check if printer is available and ready to print
 * @access  Public (Kiosk)
 */
router.get('/check-availability', asyncHandler(printerController.checkPrinterAvailability));

module.exports = router;

