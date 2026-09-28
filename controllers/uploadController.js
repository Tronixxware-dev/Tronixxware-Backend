const cloudinary = require('../config/cloudinary');

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

function uploadBufferToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'tronixxware/products', resource_type: 'image' },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
}

// POST /api/products/upload-image  (admin-gated, multipart/form-data, field name "image")
async function uploadProductImage(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file was uploaded (expected field "image").' });
    }
    if (!ALLOWED_TYPES.includes(req.file.mimetype)) {
      return res.status(400).json({ error: 'Unsupported image type. Use JPEG, PNG, WebP, or AVIF.' });
    }
    if (req.file.size > MAX_BYTES) {
      return res.status(400).json({ error: 'Image is too large (max 5MB).' });
    }

    const result = await uploadBufferToCloudinary(req.file.buffer);
    res.status(201).json({ url: result.secure_url, publicId: result.public_id });
  } catch (err) {
    console.error('Image upload failed:', err);
    res.status(500).json({ error: 'Image upload failed. Please try again.' });
  }
}

module.exports = { uploadProductImage };