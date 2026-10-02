const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const Admin = require('../models/Admin');
const requireAdmin = require('../middleware/requireAdmin');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

const ROLES = ['superadmin', 'product_uploader'];

// 10 attempts per IP per 15 minutes — enough headroom for a fumbled
// password, tight enough to make brute-forcing a login impractical.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in a few minutes.' },
});

// POST /api/admin/login — checks real Admin accounts in the database
// (bcrypt-hashed passwords), each with a role.
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const admin = await Admin.findOne({ email: String(email).toLowerCase().trim() });
    if (!admin) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const passwordOk = await bcrypt.compare(password, admin.passwordHash);
    if (!passwordOk) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: admin._id.toString(), email: admin.email, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({ token, email: admin.email, role: admin.role });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/staff — superadmin only. Lists every staff account (never
// returns password hashes).
router.get('/staff', requireAdmin, requireRole('superadmin'), async (req, res, next) => {
  try {
    const staff = await Admin.find().select('-passwordHash').sort({ createdAt: -1 });
    res.json(staff);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/staff — superadmin only. Creates a new staff login.
router.post('/staff', requireAdmin, requireRole('superadmin'), async (req, res, next) => {
  try {
    const { email, password, role } = req.body || {};

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    if (!role || !ROLES.includes(role)) {
      return res.status(400).json({ error: `Role must be one of: ${ROLES.join(', ')}` });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await Admin.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const admin = await Admin.create({ email: normalizedEmail, passwordHash, role });

    res.status(201).json({
      _id: admin._id,
      email: admin.email,
      role: admin.role,
      createdAt: admin.createdAt,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/staff/:id — superadmin only. Can't delete your own
// account, and can't delete the last remaining superadmin.
router.delete('/staff/:id', requireAdmin, requireRole('superadmin'), async (req, res, next) => {
  try {
    const { id } = req.params;

    if (req.admin.id === id) {
      return res.status(400).json({ error: "You can't delete your own account" });
    }

    const target = await Admin.findById(id);
    if (!target) {
      return res.status(404).json({ error: 'Staff account not found' });
    }

    if (target.role === 'superadmin') {
      const superadminCount = await Admin.countDocuments({ role: 'superadmin' });
      if (superadminCount <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last remaining superadmin' });
      }
    }

    await Admin.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;