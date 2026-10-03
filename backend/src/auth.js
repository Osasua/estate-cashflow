const jwt = require('jsonwebtoken');

function sign(user) {
  return jwt.sign(
    { id: user.id, name: user.name, role: user.role },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '12h' }
  );
}

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired, please sign in again' });
  }
}

// Admin and Treasurer can record/edit financial data
const staff = (req, res, next) =>
  ['admin', 'treasurer'].includes(req.user && req.user.role)
    ? next()
    : res.status(403).json({ error: 'Treasurer or Admin access required' });

module.exports = { sign, authenticate, staff };
