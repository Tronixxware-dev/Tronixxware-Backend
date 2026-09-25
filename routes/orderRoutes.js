const express = require('express');
const router = express.Router();
const {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
} = require('../controllers/orderController');
const requireAdmin = require('../middleware/requireAdmin');

router.post('/', requireAdmin, createOrder);
router.get('/', requireAdmin, getOrders);
router.get('/:id', requireAdmin, getOrderById);
router.patch('/:id/status', requireAdmin, updateOrderStatus);

module.exports = router;