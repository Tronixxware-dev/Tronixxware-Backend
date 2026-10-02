const express = require('express');
const router = express.Router();
const {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
} = require('../controllers/orderController');
const requireAdmin = require('../middleware/requireAdmin');
const requireRole = require('../middleware/requireRole');

// Public checkout doesn't hit this route at all — it goes through
// /api/payments, which reserves stock and creates its own 'pending' Order
// up front, then flips it to 'paid' once Paystack confirms. This route
// stays admin-only, for the admin panel to log a manual sale.
//
// Every route here is also superadmin-only: orders are off-limits to a
// product_uploader, even with a valid admin token.
router.post('/', requireAdmin, requireRole('superadmin'), createOrder);
router.get('/', requireAdmin, requireRole('superadmin'), getOrders);
router.get('/:id', requireAdmin, requireRole('superadmin'), getOrderById);
router.patch('/:id/status', requireAdmin, requireRole('superadmin'), updateOrderStatus);

module.exports = router;