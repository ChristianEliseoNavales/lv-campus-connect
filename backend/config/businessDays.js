/**
 * Business days configuration for document request types
 * Maps each request type to the number of business days required for processing
 */

const BUSINESS_DAYS_CONFIG = {
  'Certificate of Enrollment': 3,
  'Form 137': 5,
  'Transcript of Records': 5,
  'Good Moral Certificate': 3,
  'Certified True Copy of Documents': 4,
  'Education Service Contracting Certificate (ESC)': 4
};

/**
 * Get business days for a specific request type
 * @param {string} requestType - The request type
 * @returns {number} Number of business days (default: 5 if not found)
 */
function getBusinessDaysForRequestType(requestType) {
  return BUSINESS_DAYS_CONFIG[requestType] || 5;
}

/**
 * Get business days for multiple request types (returns the maximum)
 * @param {string[]} requestTypes - Array of request types
 * @returns {number} Maximum number of business days required
 */
function getBusinessDaysForRequestTypes(requestTypes) {
  if (!requestTypes || requestTypes.length === 0) {
    return 5; // Default
  }

  const businessDays = requestTypes.map(type => getBusinessDaysForRequestType(type));
  return Math.max(...businessDays);
}

/**
 * Calculate claim date by adding business days to approval date
 * Excludes weekends (Saturday and Sunday)
 * @param {Date} approvalDate - Date when request was approved
 * @param {number} businessDays - Number of business days to add
 * @returns {Date} Claim date
 */
function calculateClaimDate(approvalDate, businessDays) {
  const claimDate = new Date(approvalDate);
  let daysAdded = 0;

  while (daysAdded < businessDays) {
    claimDate.setDate(claimDate.getDate() + 1);

    // Skip weekends (Saturday = 6, Sunday = 0)
    const dayOfWeek = claimDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      daysAdded++;
    }
  }

  return claimDate;
}

/**
 * Calculate business days from approval date to claim date
 * Excludes weekends (Saturday and Sunday)
 * @param {Date} approvalDate - Date when request was approved
 * @param {Date} claimDate - Date when document can be claimed
 * @returns {number} Number of business days between the dates
 */
function calculateBusinessDays(approvalDate, claimDate) {
  // Normalize dates to start of day for accurate comparison
  const startDate = new Date(approvalDate);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(claimDate);
  endDate.setHours(0, 0, 0, 0);

  // Validate that claim date is not before approval date
  if (endDate < startDate) {
    throw new Error('Claim date cannot be before approval date');
  }

  // If same day, return 0
  if (endDate.getTime() === startDate.getTime()) {
    return 0;
  }

  let businessDays = 0;
  const currentDate = new Date(startDate);

  // Count business days from approval date to claim date
  while (currentDate < endDate) {
    currentDate.setDate(currentDate.getDate() + 1);

    // Skip weekends (Saturday = 6, Sunday = 0)
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      businessDays++;
    }
  }

  return businessDays;
}

/**
 * Format claim date for display
 * @param {Date} claimDate - Claim date
 * @returns {string} Formatted date string
 */
function formatClaimDate(claimDate) {
  return claimDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });
}

module.exports = {
  BUSINESS_DAYS_CONFIG,
  getBusinessDaysForRequestType,
  getBusinessDaysForRequestTypes,
  calculateClaimDate,
  calculateBusinessDays,
  formatClaimDate
};













