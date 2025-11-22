/**
 * Cloudinary image optimization utility
 * Applies automatic format, quality, and size optimizations to Cloudinary URLs
 */

/**
 * Optimize Cloudinary image URL with automatic transformations
 * @param {string|object} image - Image object with secure_url/url/public_id or direct URL string
 * @param {object} options - Additional transformation options
 * @returns {string} Optimized Cloudinary URL or original URL if not Cloudinary
 */
export const getOptimizedCloudinaryUrl = (image, options = {}) => {
  // Handle different image object formats
  let imageUrl = null;
  let publicId = null;

  if (typeof image === 'string') {
    imageUrl = image;
  } else if (image) {
    imageUrl = image.secure_url || image.url;
    publicId = image.public_id;
  }

  if (!imageUrl) {
    return null;
  }

  // Check if it's a Cloudinary URL
  const isCloudinaryUrl = imageUrl.includes('cloudinary.com') || publicId;

  if (!isCloudinaryUrl) {
    // Not a Cloudinary URL, return as-is (local image)
    return imageUrl;
  }

  // Extract public_id from URL if not provided
  if (!publicId && imageUrl.includes('cloudinary.com')) {
    // Extract public_id from Cloudinary URL pattern: .../upload/v1234567890/public_id.jpg
    const uploadMatch = imageUrl.match(/\/upload\/([^/]+)\/(.+)$/);
    if (uploadMatch) {
      publicId = uploadMatch[2].split('.')[0]; // Remove file extension
    }
  }

  // Build optimized URL with transformations (Cloudinary format: w_800,q_auto,f_auto,c_limit)
  const transformations = [
    'f_auto',      // Automatic format selection (WebP when supported)
    'q_auto',      // Automatic quality optimization
    'w_800',       // Limit width for performance
    'c_limit'      // Maintain aspect ratio
  ];

  // Add custom transformations if provided
  if (options.width) {
    transformations.push(`w_${options.width}`);
  }
  if (options.height) {
    transformations.push(`h_${options.height}`);
  }
  if (options.crop) {
    transformations.push(`c_${options.crop}`);
  }

  const transformationString = transformations.join(',');

  // If we have a Cloudinary URL, insert transformations
  if (imageUrl.includes('cloudinary.com') && imageUrl.includes('/upload/')) {
    // Insert transformations after /upload/
    // Format: https://res.cloudinary.com/{cloud_name}/image/upload/{transformations}/...
    return imageUrl.replace('/upload/', `/upload/${transformationString}/`);
  }

  // If we only have public_id (no URL), we need cloud name from environment or original URL
  // This case is less common, but handle it if needed
  if (publicId && !imageUrl.includes('cloudinary.com')) {
    // Extract cloud name from environment variable if available, or use a default
    // Note: This requires CLOUDINARY_CLOUD_NAME to be available in frontend
    // For now, return null to fall back to original behavior
    return null;
  }

  // Fallback: return original URL
  return imageUrl;
};

