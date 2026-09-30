const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Customer = require('../models/Customer');

function signToken(customer) {
  return jwt.sign(
    { customerId: customer._id.toString(), role: 'customer' },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function publicCustomer(customer) {
  return {
    id: customer._id,
    fullName: customer.fullName || '',
    email: customer.email || '',
    phone: customer.phone || '',
    createdAt: customer.createdAt,
  };
}

// POST /api/customers/register — identifier is whatever the customer typed:
// we detect email vs phone by shape, so this stays a single "email or
// phone number" field on the frontend rather than two separate inputs.
exports.register = async (req, res) => {
  try {
    const { identifier, password, fullName } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Email or phone number, and password, are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const trimmed = identifier.trim();
    const isEmail = /^\S+@\S+\.\S+$/.test(trimmed);
    const field = isEmail ? 'email' : 'phone';
    const value = isEmail ? trimmed.toLowerCase() : trimmed;

    const existing = await Customer.findOne({ [field]: value });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email/phone already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const customer = await Customer.create({
      [field]: value,
      fullName: fullName || '',
      passwordHash,
    });

    const token = signToken(customer);
    res.status(201).json({ token, customer: publicCustomer(customer) });
  } catch (err) {
    console.error('Customer register error:', err);
    res.status(500).json({ error: 'Failed to create account' });
  }
};

// POST /api/customers/login
exports.login = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Email/phone and password are required' });
    }

    const trimmed = identifier.trim();
    const value = /^\S+@\S+\.\S+$/.test(trimmed) ? trimmed.toLowerCase() : trimmed;

    const customer = await Customer.findOne({
      $or: [{ email: value }, { phone: value }],
    });

    if (!customer) {
      return res.status(401).json({ error: 'Incorrect email/phone or password' });
    }

    const match = await bcrypt.compare(password, customer.passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'Incorrect email/phone or password' });
    }

    const token = signToken(customer);
    res.json({ token, customer: publicCustomer(customer) });
  } catch (err) {
    console.error('Customer login error:', err);
    res.status(500).json({ error: 'Failed to log in' });
  }
};

// GET /api/customers/me
exports.me = async (req, res) => {
  res.json({ customer: publicCustomer(req.customer) });
};