const express = require('express');
const router = express.Router();
const {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
} = require('../controllers/orderController');
const requireAdmin = require('../middleware/requireAdmin');

// Public checkout doesn't hit this route at all — it goes through
// /api/payments, which reserves stock and creates its own 'pending' Order
// up front, then flips it to 'paid' once Paystack confirms. This route
// stays admin-only, for the admin panel to log a manual sale.
router.post('/', requireAdmin, createOrder);
router.get('/', requireAdmin, getOrders);
router.get('/:id', requireAdmin, getOrderById);
router.patch('/:id/status', requireAdmin, updateOrderStatus);

module.exports = router;