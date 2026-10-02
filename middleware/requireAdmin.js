const jwt = require('jsonwebtoken');

const VALID_ROLES = ['superadmin', 'product_uploader'];

module.exports = function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or malformed admin token' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!VALID_ROLES.includes(payload.role)) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    req.admin = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired admin token' });
  }
};