const express = require('express');
const { query } = require('../db');
const { authenticate, staff } = require('../auth');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { sendWelcomeEmail } = require('../mailer');

const router = express.Router();
router.use(authenticate);

// GET all members with their linked user info
router.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT m.*, 
            u.email AS user_email, 
            u.name AS user_name,
            (SELECT COALESCE(SUM(amount_due), 0) FROM contributions WHERE member_id = m.id) AS total_due_expected,
            (SELECT COALESCE(SUM(amount_paid), 0) FROM contributions WHERE member_id = m.id) AS total_paid,
            ((SELECT COALESCE(SUM(amount_due), 0) FROM contributions WHERE member_id = m.id) - 
             (SELECT COALESCE(SUM(amount_paid), 0) FROM contributions WHERE member_id = m.id) + 
             COALESCE(m.opening_balance, 0)) AS outstanding_balance
       FROM members m 
       LEFT JOIN users u ON u.member_id = m.id
      ORDER BY m.house_number`
  );
  res.json({ members: rows });
});

// UPDATE a member's details
router.put('/:id', staff, async (req, res) => {
  const { household_name, house_number, phone, email, monthly_due, active, opening_balance } = req.body || {};

  const { rows } = await query(
    `UPDATE members SET 
        household_name = COALESCE($2, household_name),
        house_number = COALESCE($3, house_number),
        phone = COALESCE($4, phone),
        email = COALESCE($5, email),
        monthly_due = COALESCE($6, monthly_due),
        active = COALESCE($7, active),
        opening_balance = COALESCE($8, opening_balance)
     WHERE id = $1 RETURNING *`,
    [req.params.id, household_name, house_number, phone, email, monthly_due, active, opening_balance]
  );
  
  res.json({ member: rows[0] });
});

// ADD a new member
router.post('/', staff, async (req, res) => {
  const { household_name, house_number, phone, email, monthly_due = 10000, opening_balance = 0 } = req.body || {};
  
  try {
    const { rows } = await query(
      `INSERT INTO members (household_name, house_number, phone, email, monthly_due, active, opening_balance)
       VALUES ($1, $2, $3, $4, $5, true, $6) RETURNING *`,
      [household_name, house_number, phone || null, email || null, monthly_due, opening_balance]
    );
    res.status(201).json({ member: rows[0] });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'House number already exists' });
    throw e;
  }
});

// Create login and send welcome email
router.post('/:id/create-login', staff, async (req, res) => {
  const member = await query('SELECT * FROM members WHERE id = $1', [req.params.id]);
  if (!member.rows[0]) return res.status(404).json({ error: 'Member not found' });
  
  const m = member.rows[0];
  if (!m.email) return res.status(400).json({ error: 'Member must have an email address to create a login.' });

  const existingUser = await query('SELECT id FROM users WHERE member_id = $1', [m.id]);
  if (existingUser.rows[0]) return res.status(409).json({ error: 'A login account already exists for this member.' });

  const tempPassword = crypto.randomBytes(6).toString('hex'); 
  const password_hash = bcrypt.hashSync(tempPassword, 10);

  const { rows: newUser } = await query(
    `INSERT INTO users (name, email, password_hash, role, member_id) 
     VALUES ($1, $2, $3, 'member', $4) RETURNING *`,
    [m.household_name, m.email.toLowerCase().trim(), password_hash, m.id]
  );

  // TEMPORARY FIX: Skip email and show password on screen
  res.json({ 
    message: `✅ Login created for ${m.email}! Temporary Password: ${tempPassword}` 
  });
}); // ✅ THIS WAS MISSING!

// DELETE a member permanently (Hard Delete)
router.delete('/:id', staff, async (req, res) => {
  try {
    const hasHistory = await query('SELECT id FROM contributions WHERE member_id = $1 LIMIT 1', [req.params.id]);
    if (hasHistory.rows.length > 0) {
      return res.status(400).json({ error: 'Cannot delete member with payment history. Please use "Mark as Moved Out" instead.' });
    }

    await query('DELETE FROM members WHERE id = $1', [req.params.id]);
    res.json({ message: 'Member permanently deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete member' });
  }
});

// Reset password for a member and show it
router.post('/:id/reset-password', staff, async (req, res) => {
  const tempPassword = crypto.randomBytes(6).toString('hex');
  const password_hash = bcrypt.hashSync(tempPassword, 10);

  const { rows } = await query(
    `UPDATE users SET password_hash = $1 WHERE member_id = $2 RETURNING email`,
    [password_hash, req.params.id]
  );
  
  if (rows.length === 0) return res.status(404).json({ error: 'No login found for this member' });
  
  res.json({ 
    message: `Password reset for ${rows[0].email}! New temporary password: ${tempPassword}` 
  });
});

module.exports = router;