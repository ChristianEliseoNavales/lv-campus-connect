const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { verifyToken, checkApiAccess } = require('../middleware/authMiddleware');
const faqController = require('../controllers/faqController');
const asyncHandler = require('../middleware/asyncHandler');

// Validation rules for FAQ
const faqValidation = [
  body('question')
    .trim()
    .notEmpty().withMessage('Question is required')
    .isLength({ min: 10, max: 500 }).withMessage('Question must be between 10 and 500 characters'),
  body('answer')
    .trim()
    .notEmpty().withMessage('Answer is required')
    .isLength({ min: 10, max: 2000 }).withMessage('Answer must be between 10 and 2000 characters'),
  body('office')
    .trim()
    .notEmpty().withMessage('Office is required')
    .isIn(['MIS', 'Registrar', 'Admissions', 'Senior Management'])
    .withMessage('Invalid office'),
  body('order')
    .optional()
    .isInt({ min: 0 }).withMessage('Order must be a non-negative integer'),
  body('status')
    .optional()
    .isIn(['active', 'inactive']).withMessage('Status must be either active or inactive')
];

// GET /api/faq - Get all FAQs (with optional filtering)
router.get('/', verifyToken, checkApiAccess, asyncHandler(faqController.getFAQs));

// GET /api/faq/:id - Get single FAQ by ID
router.get('/:id', verifyToken, checkApiAccess, asyncHandler(faqController.getFAQById));

// POST /api/faq - Create new FAQ
router.post('/', verifyToken, checkApiAccess, faqValidation, asyncHandler(faqController.createFAQ));

// PUT /api/faq/:id - Update FAQ
router.put('/:id', verifyToken, checkApiAccess, faqValidation, asyncHandler(faqController.updateFAQ));

// DELETE /api/faq/:id - Delete FAQ
router.delete('/:id', verifyToken, checkApiAccess, asyncHandler(faqController.deleteFAQ));

module.exports = router;

