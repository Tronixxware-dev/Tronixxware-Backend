// Use after requireAdmin, on routes that should only be reachable by
// specific admin roles.
// Example: router.get('/staff', requireAdmin, requireRole('superadmin'), listStaff);
module.exports = function requireRole(...allowedRoles) {
  return function (req, res, next) {
    if (!req.admin || !allowedRoles.includes(req.admin.role)) {
      return res.status(403).json({ error: 'You do not have permission to do this' });
    }
    next();
  };
};