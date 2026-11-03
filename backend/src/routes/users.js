const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query } = require('../db');
const { frontendUrl } = require('../frontend-url');
const { authenticate, staff } = require('../auth'); // ✅ Added 'staff' here
const { sendWelcomeEmail } = require('../welcome-mail');
const { audit } = require('../audit');

const router = express.Router();
router.use(authenticate);

// Middleware: Admin only
const adminOnly = (req, res, next) => 
  req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Admin access required' });

// GET all users — ADMIN ONLY (this endpoint lists emails; it must not be
// reachable by every authenticated user)
router.get('/', adminOnly, async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT id, name, email, role, member_id, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ users: rows });
  } catch (err) {
    console.error('GET users error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST create new staff user (Admin or Treasurer)
router.post('/', adminOnly, async (req, res) => {
  const { name, email, role, member_id } = req.body;
  
  if (!['admin', 'treasurer', 'secretary', 'facility', 'gate'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role. Must be admin, treasurer, secretary, facility or gate.' });
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

    const loginUrl = frontendUrl();
    try {
      await sendWelcomeEmail(email, tempPassword, loginUrl, name);
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
  
  if (role && !['admin', 'treasurer', 'secretary', 'facility', 'gate', 'member'].includes(role)) {
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

// DELETE a user (Admin only). Removes the portal LOGIN only — households,
// bills and payment history are untouched. Historical references are
// detached (set null) so the audit trail and payment records survive.
router.delete('/:id', adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid user id' });
  if (id === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }
  try {
    const { rows } = await query('SELECT id, name, email, role FROM users WHERE id = $1', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    if (rows[0].role === 'admin') {
      const { rows: admins } = await query(`SELECT count(*)::int AS n FROM users WHERE role = 'admin'`);
      if (admins[0].n <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last admin account' });
      }
    }
    await query('UPDATE payments SET recorded_by = NULL WHERE recorded_by = $1', [id]);
    await query('UPDATE audit_log SET user_id = NULL WHERE user_id = $1', [id]);
    await query('UPDATE access_codes SET created_by = NULL WHERE created_by = $1', [id]);
    await query('DELETE FROM users WHERE id = $1', [id]);
    await audit(req.user.id, 'DELETE', 'users', id, { name: rows[0].name, email: rows[0].email, role: rows[0].role }, null);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('User delete error:', err);
    res.status(500).json({ error: 'Failed to delete user: ' + err.message });
  }
});

module.exports = router;