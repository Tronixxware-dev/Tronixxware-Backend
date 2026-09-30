const Order = require('../models/Order');

// GET /api/my-orders — every order this logged-in customer has ever placed,
// newest first.
exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ customerId: req.customer._id })
      .sort({ createdAt: -1 })
      .lean();
    res.json(orders);
  } catch (err) {
    console.error('Get my orders error:', err);
    res.status(500).json({ error: 'Failed to load orders' });
  }
};

// GET /api/my-orders/:id — scoped to this customer, so nobody can view
// someone else's order just by guessing an id.
exports.getMyOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      customerId: req.customer._id,
    }).lean();
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    console.error('Get my order error:', err);
    res.status(500).json({ error: 'Failed to load order' });
  }
};