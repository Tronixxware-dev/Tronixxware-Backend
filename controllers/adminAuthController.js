const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

const ROLES = ['superadmin', 'product_uploader'];

// POST /api/admin/login
async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const admin = await Admin.findOne({ email: String(email).toLowerCase().trim() });
  if (!admin) {
    return res.status(401).json({ error: 'Incorrect email or password' });
  }

  const matches = await bcrypt.compare(password, admin.passwordHash);
  if (!matches) {
    return res.status(401).json({ error: 'Incorrect email or password' });
  }

  const token = jwt.sign(
    { id: admin._id.toString(), email: admin.email, role: admin.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, email: admin.email, role: admin.role });
}

// GET /api/admin/staff — superadmin only. Lists every staff account (never
// returns password hashes).
async function listStaff(req, res) {
  const staff = await Admin.find().select('-passwordHash').sort({ createdAt: -1 });
  res.json(staff);
}

// POST /api/admin/staff — superadmin only. Creates a new staff login.
async function createStaff(req, res) {
  const { email, password, role } = req.body;

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
}

// DELETE /api/admin/staff/:id — superadmin only. Can't delete your own
// account (avoids accidentally locking yourself out), and can't delete the
// last remaining superadmin (avoids locking everyone out).
async function deleteStaff(req, res) {
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
}

module.exports = { login, listStaff, createStaff, deleteStaff, ROLES };