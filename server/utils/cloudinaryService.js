/**
 * Cloudinary Service for Image Management
 * Handles image uploads, transformations, and folder organization
 */

const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');
const config = require('../config');

// Initialize Cloudinary
if (config.cloudinary?.cloudName && config.cloudinary?.apiKey && config.cloudinary?.apiSecret) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
    secure: true // Always use HTTPS
  });
  console.log('✅ Cloudinary configured');
} else {
  console.warn('⚠️ Cloudinary not configured - image uploads will fail');
  console.warn('⚠️ Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET');
}

class CloudinaryService {
  /**
   * Upload image to Cloudinary with folder organization
   * @param {Buffer|Stream|string} file - File buffer, stream, or file path
   * @param {Object} options - Upload options
   * @param {string} options.folder - Folder path (e.g., "leads/lead-id/photos")
   * @param {string} options.leadId - Lead ID for organization
   * @param {string} options.photographerId - Photographer user ID
   * @param {string} options.publicId - Custom public ID (optional)
   * @param {Array} options.tags - Tags for organization
   * @param {Object} options.transformations - Image transformations
   * @returns {Promise<Object>} Upload result with URLs and metadata
   */
  async uploadImage(file, options = {}) {
    try {
      const {
        folder = 'crm/photos',
        leadId,
        photographerId,
        publicId,
        tags = [],
        transformations = {},
        description
      } = options;

      // Build folder path
      let folderPath = folder;
      if (leadId) {
        folderPath = `crm/leads/${leadId}/photos`;
      } else if (photographerId) {
        folderPath = `crm/photographers/${photographerId}/photos`;
      }

      // Add tags
      const allTags = [...tags];
      if (leadId) allTags.push(`lead-${leadId}`);
      if (photographerId) allTags.push(`photographer-${photographerId}`);

      // Upload options
      const uploadOptions = {
        folder: folderPath,
        resource_type: 'image',
        overwrite: false,
        invalidate: true, // Invalidate CDN cache
        tags: allTags,
        ...transformations
      };

      if (publicId) {
        uploadOptions.public_id = publicId;
      }

      if (description) {
        uploadOptions.context = { caption: description };
      }

      // Upload to Cloudinary
      let uploadResult;
      if (Buffer.isBuffer(file)) {
        // Upload from buffer
        uploadResult = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          Readable.from(file).pipe(uploadStream);
        });
      } else if (typeof file === 'string') {
        // Upload from file path
        uploadResult = await cloudinary.uploader.upload(file, uploadOptions);
      } else {
        // Assume it's a stream
        uploadResult = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          file.pipe(uploadStream);
        });
      }

      return {
        success: true,
        public_id: uploadResult.public_id,
        url: uploadResult.url,
        secure_url: uploadResult.secure_url,
        folder: uploadResult.folder,
        width: uploadResult.width,
        height: uploadResult.height,
        format: uploadResult.format,
        bytes: uploadResult.bytes,
        created_at: uploadResult.created_at,
        tags: uploadResult.tags || []
      };
    } catch (error) {
      console.error('❌ Cloudinary upload error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delete image from Cloudinary
   * @param {string} publicId - Cloudinary public ID
   * @returns {Promise<Object>} Deletion result
   */
  async deleteImage(publicId) {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        invalidate: true
      });

      return {
        success: result.result === 'ok',
        result: result.result
      };
    } catch (error) {
      console.error('❌ Cloudinary delete error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate image URL with transformations
   * @param {string} publicId - Cloudinary public ID
   * @param {Object} transformations - Transformation options
   * @returns {string} Transformed image URL
   */
  getImageUrl(publicId, transformations = {}) {
    return cloudinary.url(publicId, {
      secure: true,
      ...transformations
    });
  }

  /**
   * Generate thumbnail URL
   * @param {string} publicId - Cloudinary public ID
   * @param {number} width - Thumbnail width
   * @param {number} height - Thumbnail height
   * @returns {string} Thumbnail URL
   */
  getThumbnailUrl(publicId, width = 300, height = 300) {
    return cloudinary.url(publicId, {
      secure: true,
      width,
      height,
      crop: 'fill',
      quality: 'auto',
      fetch_format: 'auto'
    });
  }

  /**
   * List images in a folder
   * @param {string} folder - Folder path
   * @param {Object} options - List options
   * @returns {Promise<Array>} Array of image resources
   */
  async listImages(folder, options = {}) {
    try {
      const result = await cloudinary.search
        .expression(`folder:${folder}`)
        .sort_by([{ created_at: 'desc' }])
        .max_results(options.maxResults || 50)
        .execute();

      return {
        success: true,
        resources: result.resources || []
      };
    } catch (error) {
      console.error('❌ Cloudinary list error:', error);
      return {
        success: false,
        error: error.message,
        resources: []
      };
    }
  }

  /**
   * Get image metadata
   * @param {string} publicId - Cloudinary public ID
   * @returns {Promise<Object>} Image metadata
   */
  async getImageInfo(publicId) {
    try {
      const result = await cloudinary.api.resource(publicId, {
        image_metadata: true
      });

      return {
        success: true,
        ...result
      };
    } catch (error) {
      console.error('❌ Cloudinary get info error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Upload video to Cloudinary with folder organization
   * @param {Buffer|Stream|string} file - File buffer, stream, or file path
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Upload result with URLs and metadata
   */
  async uploadVideo(file, options = {}) {
    try {
      const {
        folder = 'crm/videos',
        leadId,
        photographerId,
        publicId,
        tags = [],
        description
      } = options;

      // Build folder path
      let folderPath = folder;
      if (leadId) {
        folderPath = `crm/leads/${leadId}/videos`;
      } else if (photographerId) {
        folderPath = `crm/photographers/${photographerId}/videos`;
      }

      // Add tags
      const allTags = [...tags, 'video'];
      if (leadId) allTags.push(`lead-${leadId}`);
      if (photographerId) allTags.push(`photographer-${photographerId}`);

      // Upload options for video
      const uploadOptions = {
        folder: folderPath,
        resource_type: 'video',
        overwrite: false,
        invalidate: true,
        tags: allTags,
        // Video-specific options
        eager: [
          { width: 300, height: 300, crop: 'fill', format: 'jpg' }, // Thumbnail
          { quality: 'auto', fetch_format: 'auto' } // Optimized version
        ],
        eager_async: true // Process transformations asynchronously
      };

      if (publicId) {
        uploadOptions.public_id = publicId;
      }

      if (description) {
        uploadOptions.context = { caption: description };
      }

      // Upload to Cloudinary
      let uploadResult;
      if (Buffer.isBuffer(file)) {
        uploadResult = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          Readable.from(file).pipe(uploadStream);
        });
      } else if (typeof file === 'string') {
        uploadResult = await cloudinary.uploader.upload(file, uploadOptions);
      } else {
        uploadResult = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          file.pipe(uploadStream);
        });
      }

      return {
        success: true,
        public_id: uploadResult.public_id,
        url: uploadResult.url,
        secure_url: uploadResult.secure_url,
        folder: uploadResult.folder,
        width: uploadResult.width,
        height: uploadResult.height,
        format: uploadResult.format,
        bytes: uploadResult.bytes,
        duration: uploadResult.duration, // Video duration in seconds
        created_at: uploadResult.created_at,
        tags: uploadResult.tags || [],
        resource_type: 'video',
        // Video thumbnail (first eager transformation)
        thumbnail_url: uploadResult.eager?.[0]?.secure_url || null
      };
    } catch (error) {
      console.error('❌ Cloudinary video upload error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delete video from Cloudinary
   * @param {string} publicId - Cloudinary public ID
   * @returns {Promise<Object>} Deletion result
   */
  async deleteVideo(publicId) {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'video',
        invalidate: true
      });

      return {
        success: result.result === 'ok',
        result: result.result
      };
    } catch (error) {
      console.error('❌ Cloudinary video delete error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate video thumbnail URL
   * @param {string} publicId - Cloudinary public ID
   * @param {number} width - Thumbnail width
   * @param {number} height - Thumbnail height
   * @returns {string} Thumbnail URL (as jpg image)
   */
  getVideoThumbnailUrl(publicId, width = 300, height = 300) {
    return cloudinary.url(publicId, {
      resource_type: 'video',
      secure: true,
      width,
      height,
      crop: 'fill',
      format: 'jpg' // Get first frame as jpg
    });
  }

  /**
   * Upload media (auto-detect image or video)
   * @param {Buffer|Stream|string} file - File buffer, stream, or file path
   * @param {string} mediaType - 'image' or 'video'
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Upload result
   */
  async uploadMedia(file, mediaType, options = {}) {
    if (mediaType === 'video') {
      return this.uploadVideo(file, options);
    }
    return this.uploadImage(file, options);
  }

  /**
   * Delete media (auto-detect image or video)
   * @param {string} publicId - Cloudinary public ID
   * @param {string} resourceType - 'image' or 'video'
   * @returns {Promise<Object>} Deletion result
   */
  async deleteMedia(publicId, resourceType = 'image') {
    if (resourceType === 'video') {
      return this.deleteVideo(publicId);
    }
    return this.deleteImage(publicId);
  }
}

module.exports = new CloudinaryService();
