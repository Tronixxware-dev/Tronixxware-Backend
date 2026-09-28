const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// 10 attempts per IP per 15 minutes — enough headroom for a fumbled
// password, tight enough to make brute-forcing the single admin password
// impractical.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in a few minutes.' },
});

function safeCompare(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    // Compare against itself so a wrong-length guess doesn't return faster
    // than a right-length one (keeps this a constant-time check either way).
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// POST /api/admin/login — the store has a single admin account, whose
// credentials live only in environment variables (never in the database or
// in git). If you ever need more than one admin login, swap this for a real
// Admin/User model with hashed passwords.
router.post('/login', loginLimiter, (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const adminEmail = process.env.ADMIN_EMAIL || '';
  const adminPassword = process.env.ADMIN_PASSWORD || '';

  if (!adminEmail || !adminPassword) {
    console.error('ADMIN_EMAIL / ADMIN_PASSWORD are not set — admin login is disabled.');
    return res.status(500).json({ error: 'Admin login is not configured' });
  }

  const emailOk = safeCompare(String(email).toLowerCase(), adminEmail.toLowerCase());
  const passwordOk = safeCompare(password, adminPassword);

  if (!emailOk || !passwordOk) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign({ role: 'admin', email: adminEmail }, process.env.JWT_SECRET, {
    expiresIn: '12h',
  });

  res.json({ token });
});

module.exports = router;