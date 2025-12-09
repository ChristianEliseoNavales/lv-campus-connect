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
  formatClaimDate
};


