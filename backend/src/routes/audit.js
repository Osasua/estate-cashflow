const express = require('express');
const { query } = require('../db');
const { authenticate } = require('../auth');

const router = express.Router();

// All audit routes require authentication
router.use(authenticate);

// GET all logs (Admin only)
router.get('/', async (req, res) => {
  // Security check: Only admins can view the audit log
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admins only.' });
  }

  try {
    // Fetch the last 100 actions, ordered by newest first
    const { rows } = await query(`
      SELECT al.*, u.name as user_name 
      FROM audit_log al 
      LEFT JOIN users u ON al.user_id = u.id 
      ORDER BY al.created_at DESC 
      LIMIT 100
    `);
    res.json({ logs: rows });
  } catch (error) {
    console.error('Audit log fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

module.exports = router;