/**
 * Philippine Timezone Utilities for Backend
 * Handles date operations in Philippine Standard Time (GMT+8)
 */

// Philippine timezone offset in milliseconds (GMT+8)
const PHILIPPINE_TIMEZONE_OFFSET = 8 * 60 * 60 * 1000;

/**
 * Get current date/time in Philippine timezone
 * @param {Date} date - Optional date to convert, defaults to current date
 * @returns {Date} Date object adjusted to Philippine timezone
 */
const getPhilippineDate = (date = new Date()) => {
  // Create a new date in Philippine timezone using Intl.DateTimeFormat
  const phTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);

  const phYear = parseInt(phTime.find(part => part.type === 'year').value);
  const phMonth = parseInt(phTime.find(part => part.type === 'month').value) - 1; // Month is 0-indexed
  const phDay = parseInt(phTime.find(part => part.type === 'day').value);
  const phHour = parseInt(phTime.find(part => part.type === 'hour').value);
  const phMinute = parseInt(phTime.find(part => part.type === 'minute').value);
  const phSecond = parseInt(phTime.find(part => part.type === 'second').value);

  return new Date(phYear, phMonth, phDay, phHour, phMinute, phSecond, date.getMilliseconds());
};

/**
 * Get date string in YYYY-MM-DD format for Philippine timezone
 * @param {Date} date - Optional date to convert, defaults to current date
 * @returns {string} Date string in YYYY-MM-DD format
 */
const getPhilippineDateString = (date = new Date()) => {
  // Get date components directly from Philippine timezone without UTC conversion
  const phTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false
  }).formatToParts(date);

  const year = phTime.find(part => part.type === 'year').value;
  const month = phTime.find(part => part.type === 'month').value;
  const day = phTime.find(part => part.type === 'day').value;

  // Return YYYY-MM-DD format directly from Philippine timezone components
  return `${year}-${month}-${day}`;
};

/**
 * Get today's date string in Philippine timezone
 * @returns {string} Today's date in YYYY-MM-DD format
 */
const getPhilippineToday = () => {
  return getPhilippineDateString();
};

/**
 * Check if a date string is in the future relative to Philippine timezone
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {boolean} True if date is in the future (after today)
 */
const isDateInFuture = (dateString) => {
  if (!dateString) return false;

  // Get today's date string in Philippine timezone
  const todayString = getPhilippineDateString();

  // Simple string comparison for YYYY-MM-DD format
  // This avoids timezone conversion issues
  return dateString > todayString;
};

/**
 * Get start and end of day in Philippine timezone for database queries
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {Object} Object with startOfDay and endOfDay Date objects in UTC
 */
const getPhilippineDayBoundaries = (dateString) => {
  if (!dateString) {
    throw new Error('Date string is required');
  }

  // Create start and end of day in Philippine timezone using proper timezone handling
  const startOfDayPH = new Date(`${dateString}T00:00:00+08:00`); // Philippine timezone (GMT+8)
  const endOfDayPH = new Date(`${dateString}T23:59:59.999+08:00`); // Philippine timezone (GMT+8)

  // These are already in UTC after timezone conversion
  return {
    startOfDay: startOfDayPH,
    endOfDay: endOfDayPH
  };
};

/**
 * Validate date string format and check if it's not in the future
 * @param {string} dateString - Date string to validate
 * @returns {Object} Validation result with isValid and error properties
 */
const validateDateString = (dateString) => {
  if (!dateString) {
    return { isValid: false, error: 'Date is required' };
  }

  // Check format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) {
    return { isValid: false, error: 'Date must be in YYYY-MM-DD format' };
  }

  // Check if it's a valid date
  const date = new Date(dateString + 'T00:00:00');
  if (isNaN(date.getTime())) {
    return { isValid: false, error: 'Invalid date' };
  }

  // Check if it's not in the future
  if (isDateInFuture(dateString)) {
    return { isValid: false, error: 'Date cannot be in the future' };
  }

  return { isValid: true };
};

/**
 * Format date for logging with Philippine timezone
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string
 */
const formatPhilippineDateTime = (date = new Date()) => {
  const phDate = getPhilippineDate(date);
  return phDate.toISOString().replace('T', ' ').substring(0, 19) + ' PHT';
};

module.exports = {
  getPhilippineDate,
  getPhilippineDateString,
  getPhilippineToday,
  isDateInFuture,
  getPhilippineDayBoundaries,
  validateDateString,
  formatPhilippineDateTime,
  PHILIPPINE_TIMEZONE_OFFSET
};
