/**
 * Input Validation Middleware
 * Uses express-validator for request validation and sanitization
 */

const { validationResult, body, param, query } = require('express-validator');
const { ValidationError } = require('../utils/errorHandler');

/**
 * Validation Result Handler
 * Extracts validation errors and formats them
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const details = errors.array().map(err => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value,
      location: err.location
    }));

    const error = new ValidationError('Validation failed', details);
    return next(error);
  }

  next();
};

/**
 * Common Validation Rules
 */
const commonValidations = {
  // MongoDB ObjectId validation
  mongoId: (field = 'id') => {
    return param(field)
      .isMongoId()
      .withMessage(`${field} must be a valid MongoDB ObjectId`);
  },

  // Email validation
  email: (field = 'email') => {
    return body(field)
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage(`${field} must be a valid email address`);
  },

  // Required email
  requiredEmail: (field = 'email') => {
    return body(field)
      .notEmpty()
      .withMessage(`${field} is required`)
      .isEmail()
      .normalizeEmail()
      .withMessage(`${field} must be a valid email address`);
  },

  // String validation
  string: (field, minLength = 1, maxLength = 255) => {
    return body(field)
      .optional()
      .isString()
      .withMessage(`${field} must be a string`)
      .isLength({ min: minLength, max: maxLength })
      .withMessage(`${field} must be between ${minLength} and ${maxLength} characters`)
      .trim();
  },

  // Required string
  requiredString: (field, minLength = 1, maxLength = 255) => {
    return body(field)
      .notEmpty()
      .withMessage(`${field} is required`)
      .isString()
      .withMessage(`${field} must be a string`)
      .isLength({ min: minLength, max: maxLength })
      .withMessage(`${field} must be between ${minLength} and ${maxLength} characters`)
      .trim();
  },

  // Phone number validation
  phone: (field = 'contactNumber') => {
    return body(field)
      .optional()
      .isMobilePhone('any')
      .withMessage(`${field} must be a valid phone number`);
  },

  // Required phone number
  requiredPhone: (field = 'contactNumber') => {
    return body(field)
      .notEmpty()
      .withMessage(`${field} is required`)
      .isMobilePhone('any')
      .withMessage(`${field} must be a valid phone number`);
  },

  // Array validation
  array: (field, minItems = 1) => {
    return body(field)
      .optional()
      .isArray()
      .withMessage(`${field} must be an array`)
      .isLength({ min: minItems })
      .withMessage(`${field} must contain at least ${minItems} item(s)`);
  },

  // Required array
  requiredArray: (field, minItems = 1) => {
    return body(field)
      .notEmpty()
      .withMessage(`${field} is required`)
      .isArray()
      .withMessage(`${field} must be an array`)
      .isLength({ min: minItems })
      .withMessage(`${field} must contain at least ${minItems} item(s)`);
  },

  // Boolean validation
  boolean: (field) => {
    return body(field)
      .optional()
      .isBoolean()
      .withMessage(`${field} must be a boolean`)
      .toBoolean();
  },

  // Number validation
  number: (field, min = null, max = null) => {
    let validator = body(field)
      .optional()
      .isNumeric()
      .withMessage(`${field} must be a number`);

    if (min !== null) {
      validator = validator.isInt({ min })
        .withMessage(`${field} must be at least ${min}`);
    }

    if (max !== null) {
      validator = validator.isInt({ max })
        .withMessage(`${field} must be at most ${max}`);
    }

    return validator.toInt();
  },

  // Date validation
  date: (field) => {
    return body(field)
      .optional()
      .isISO8601()
      .withMessage(`${field} must be a valid date (ISO 8601 format)`)
      .toDate();
  },

  // Enum validation
  enum: (field, allowedValues) => {
    return body(field)
      .optional()
      .isIn(allowedValues)
      .withMessage(`${field} must be one of: ${allowedValues.join(', ')}`);
  },

  // Required enum
  requiredEnum: (field, allowedValues) => {
    return body(field)
      .notEmpty()
      .withMessage(`${field} is required`)
      .isIn(allowedValues)
      .withMessage(`${field} must be one of: ${allowedValues.join(', ')}`);
  }
};

/**
 * Sanitization Helpers
 */
const sanitizers = {
  // Trim string
  trim: (field) => {
    return body(field).trim();
  },

  // Escape HTML
  escape: (field) => {
    return body(field).escape();
  },

  // Lowercase string
  toLowerCase: (field) => {
    return body(field).toLowerCase();
  },

  // Uppercase string
  toUpperCase: (field) => {
    return body(field).toUpperCase();
  }
};

module.exports = {
  handleValidationErrors,
  commonValidations,
  sanitizers,
  // Re-export express-validator for custom validations
  body,
  param,
  query,
  validationResult
};
