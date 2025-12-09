const DocumentRequest = require('../models/DocumentRequest');
const Queue = require('../models/Queue');

/**
 * Generate a unique transaction number in format TR######-###
 * Checks both DocumentRequest and Queue models for uniqueness
 * @returns {Promise<string>} Unique transaction number
 */
async function generateTransactionNo() {
  const maxRetries = 10;
  let attempts = 0;

  while (attempts < maxRetries) {
    // Generate 6 random digits
    const firstPart = Math.floor(100000 + Math.random() * 900000).toString();

    // Generate 3 random digits
    const secondPart = Math.floor(100 + Math.random() * 900).toString();

    // Format as TR######-###
    const transactionNo = `TR${firstPart}-${secondPart}`;

    // Check if it already exists in DocumentRequest or Queue
    // Use .select('_id').lean() to minimize data transfer for existence checks
    const [existingDocumentRequest, existingQueue] = await Promise.all([
      DocumentRequest.findOne({ transactionNo }).select('_id').lean(),
      Queue.findOne({ transactionNo }).select('_id').lean()
    ]);

    if (!existingDocumentRequest && !existingQueue) {
      return transactionNo;
    }

    attempts++;
  }

  // If we've exhausted retries, throw an error
  throw new Error('Failed to generate unique transaction number after multiple attempts');
}

module.exports = {
  generateTransactionNo
};

