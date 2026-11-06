const express = require('express');
const { query } = require('../db');
const { authenticate } = require('../auth');

const router = express.Router();

// All audit routes require authentication
router.use(authenticate);

// GET all logs (Admin only)
// ?category=all|signins|financial (default all) · ?limit=1..500 (default 100)
router.get('/', async (req, res) => {
  // Security check: Only admins can view the audit log
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admins only.' });
  }

  try {
    const category = ['all', 'signins', 'financial'].includes(req.query.category)
      ? req.query.category
      : 'all';
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);

    // Sign-in events (LOGIN / LOGIN_FAILED) vs everything else, which is the
    // financial write trail this log was originally built for.
    let where = '';
    if (category === 'signins') where = `WHERE al.action IN ('LOGIN', 'LOGIN_FAILED')`;
    if (category === 'financial') where = `WHERE al.action NOT IN ('LOGIN', 'LOGIN_FAILED')`;

    const { rows } = await query(`
      SELECT al.*, u.name as user_name, u.email as user_email
      FROM audit_log al
      LEFT JOIN users u ON al.user_id = u.id
      ${where}
      ORDER BY al.created_at DESC
      LIMIT $1
    `, [limit]);
    res.json({ logs: rows });
  } catch (error) {
    console.error('Audit log fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

module.exports = router;