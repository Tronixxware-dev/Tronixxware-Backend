const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} = require('../controllers/productController');
const { uploadProductImage } = require('../controllers/uploadController');
const requireAdmin = require('../middleware/requireAdmin');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

function handleUploadErrors(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      error: err.code === 'LIMIT_FILE_SIZE' ? 'Image is too large (max 5MB).' : err.message,
    });
  }
  next(err);
}

// Public
router.get('/', getProducts);
router.get('/:id', getProductById);

// Admin-gated
router.post('/upload-image', requireAdmin, upload.single('image'), handleUploadErrors, uploadProductImage);
router.post('/', requireAdmin, createProduct);
router.patch('/:id', requireAdmin, updateProduct);
router.delete('/:id', requireAdmin, deleteProduct);

module.exports = router;