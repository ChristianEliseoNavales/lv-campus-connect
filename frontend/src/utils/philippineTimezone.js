/**
 * Philippine Timezone Utilities
 * Handles date operations in Philippine Standard Time (GMT+8)
 */

// Philippine timezone offset in minutes (GMT+8)
export const PHILIPPINE_TIMEZONE_OFFSET = 8 * 60;

/**
 * Get current date/time in Philippine timezone
 * @param {Date} date - Optional date to convert, defaults to current date
 * @returns {Date} Date object adjusted to Philippine timezone
 */
export const getPhilippineDate = (date = new Date()) => {
  // Handle null or invalid date inputs
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    date = new Date(); // Use current date as fallback
  }

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
export const getPhilippineDateString = (date = new Date()) => {
  // Handle null or invalid date inputs
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    date = new Date(); // Use current date as fallback
  }

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
export const getPhilippineToday = () => {
  return getPhilippineDateString();
};

/**
 * Check if a date is in the future relative to Philippine timezone
 * @param {Date} date - Date to check
 * @param {Date} referenceDate - Reference date (defaults to current Philippine date)
 * @returns {boolean} True if date is in the future
 */
export const isDateInFuture = (date, referenceDate = new Date()) => {
  // Handle null or invalid date inputs
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return false; // Invalid dates are not considered future dates
  }

  const phDate = getPhilippineDate(date);
  const phReference = getPhilippineDate(referenceDate);

  // Reset time to start of day for comparison
  phDate.setHours(0, 0, 0, 0);
  phReference.setHours(0, 0, 0, 0);

  return phDate > phReference;
};

/**
 * Check if a date is today in Philippine timezone
 * @param {Date} date - Date to check
 * @returns {boolean} True if date is today
 */
export const isToday = (date) => {
  // Handle null or invalid date inputs
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return false; // Invalid dates are not today
  }

  const phDate = getPhilippineDate(date);
  const phToday = getPhilippineDate();

  return phDate.toDateString() === phToday.toDateString();
};

/**
 * Convert a date to Philippine timezone and format for API
 * @param {Date|string} date - Date to convert
 * @returns {string|null} Date string in YYYY-MM-DD format or null if invalid
 */
export const formatDateForAPI = (date) => {
  if (!date) return null;

  try {
    // Handle both Date objects and date strings
    if (date instanceof Date) {
      return getPhilippineDateString(date);
    } else if (typeof date === 'string') {
      // If it's already in YYYY-MM-DD format, validate and return
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (dateRegex.test(date)) {
        // Validate it's a real date
        const parsedDate = new Date(date + 'T00:00:00');
        if (!isNaN(parsedDate.getTime())) {
          return date;
        }
      } else {
        // Try to parse as ISO string and convert to YYYY-MM-DD
        const parsedDate = new Date(date);
        if (!isNaN(parsedDate.getTime())) {
          return getPhilippineDateString(parsedDate);
        }
      }
    }
  } catch (error) {
    console.error('Error formatting date for API:', error);
  }

  return null;
};

/**
 * Get start and end of day in Philippine timezone for database queries
 * @param {Date|string} date - Date to get boundaries for
 * @returns {Object} Object with startOfDay and endOfDay Date objects
 */
export const getPhilippineDayBoundaries = (date) => {
  const phDate = getPhilippineDate(date);

  const startOfDay = new Date(phDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(phDate);
  endOfDay.setHours(23, 59, 59, 999);

  return { startOfDay, endOfDay };
};

/**
 * Format date for display in Philippine timezone
 * @param {Date|string} date - Date to format
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export const formatPhilippineDate = (date, options = {}) => {
  if (!date) return '';

  const phDate = getPhilippineDate(date);
  const defaultOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Manila'
  };

  return phDate.toLocaleDateString('en-US', { ...defaultOptions, ...options });
};

/**
 * Convert a Philippine date to ISO string for API transmission
 * This preserves the Philippine date (not UTC conversion)
 * @param {Date} date - Date object in Philippine timezone
 * @returns {string} ISO string representing the Philippine date at start of day
 */
export const toPhilippineISOString = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return null;
  }

  // Get the date components in Philippine timezone
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

  const year = phTime.find(part => part.type === 'year').value;
  const month = phTime.find(part => part.type === 'month').value;
  const day = phTime.find(part => part.type === 'day').value;
  const hour = phTime.find(part => part.type === 'hour').value;
  const minute = phTime.find(part => part.type === 'minute').value;
  const second = phTime.find(part => part.type === 'second').value;

  // Return ISO string in Philippine timezone (with +08:00 offset)
  return `${year}-${month}-${day}T${hour}:${minute}:${second}+08:00`;
};

/**
 * Get start of day in Philippine timezone as ISO string
 * @param {Date} date - Date object
 * @returns {string} ISO string for start of day (00:00:00) in Philippine timezone
 */
export const getPhilippineStartOfDayISO = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return null;
  }

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

  // Return start of day (00:00:00) in Philippine timezone
  return `${year}-${month}-${day}T00:00:00+08:00`;
};

/**
 * Get end of day in Philippine timezone as ISO string
 * @param {Date} date - Date object
 * @returns {string} ISO string for end of day (23:59:59) in Philippine timezone
 */
export const getPhilippineEndOfDayISO = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return null;
  }

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

  // Return end of day (23:59:59.999) in Philippine timezone
  return `${year}-${month}-${day}T23:59:59.999+08:00`;
};
