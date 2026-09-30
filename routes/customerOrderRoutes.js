const express = require('express');
const router = express.Router();
const { getMyOrders, getMyOrderById } = require('../controllers/customerOrderController');
const requireCustomer = require('../middleware/requireCustomer');

router.get('/', requireCustomer, getMyOrders);
router.get('/:id', requireCustomer, getMyOrderById);

module.exports = router;