const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query } = require('../db');
const { authenticate } = require('../auth');
const { sendWelcomeEmail } = require('../mailer');

const router = express.Router();
router.use(authenticate);

// Middleware: Admin only
const adminOnly = (req, res, next) => 
  req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Admin access required' });

// GET all users
router.get('/', async (req, res) => {
  const { rows } = await query(
    'SELECT id, name, email, role, member_id, created_at FROM users ORDER BY created_at DESC'
  );
  res.json({ users: rows });
});

// POST create new staff user (Admin or Treasurer)
router.post('/', adminOnly, async (req, res) => {
  const { name, email, role, member_id } = req.body;
  
  if (!['admin', 'treasurer'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role. Must be admin or treasurer.' });
  }

  const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
  if (existing.rows[0]) return res.status(409).json({ error: 'Email already in use' });

  const tempPassword = crypto.randomBytes(6).toString('hex');
  const password_hash = bcrypt.hashSync(tempPassword, 10);

  try {
    const { rows } = await query(
      'INSERT INTO users (name, email, password_hash, role, member_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, member_id',
      [name, email.toLowerCase().trim(), password_hash, role, member_id || null]
    );

    const loginUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    try {
      await sendWelcomeEmail(email, tempPassword, loginUrl);
    } catch (emailErr) {
      console.error('Welcome email failed:', emailErr.message);
    }

    res.status(201).json({ user: rows[0], tempPassword });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PUT update user role and/or household link
router.put('/:id', adminOnly, async (req, res) => {
  const { role, member_id } = req.body;
  
  if (role && !['admin', 'treasurer', 'member'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  const updates = [];
  const values = [];
  let paramCount = 1;

  if (role) {
    updates.push(`role = $${paramCount++}`);
    values.push(role);
  }
  if (member_id !== undefined) {
    updates.push(`member_id = $${paramCount++}`);
    values.push(member_id || null);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(req.params.id);

  const { rows } = await query(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, name, email, role, member_id`,
    values
  );
  
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  res.json({ user: rows[0] });
});

module.exports = router;