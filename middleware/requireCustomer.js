const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer');

module.exports = async function requireCustomer(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const token = header.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== 'customer' || !payload.customerId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const customer = await Customer.findById(payload.customerId);
    if (!customer) {
      return res.status(401).json({ error: 'Account no longer exists' });
    }
    req.customer = customer;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
};