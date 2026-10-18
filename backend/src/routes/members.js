const express = require('express');
const { query } = require('../db');
const { authenticate, staff } = require('../auth');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { sendWelcomeEmail } = require('../mailer');

const router = express.Router();
router.use(authenticate);

// GET all members with their linked user info
// ✅ Updated to pull opening_balance directly from the 'arrears' contribution row
router.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT m.*, 
            u.email AS user_email, 
            u.name AS user_name,
            COALESCE((SELECT amount_due - amount_paid FROM contributions WHERE member_id = m.id AND type = 'arrears' LIMIT 1), 0) AS opening_balance,
            (SELECT COALESCE(SUM(amount_due), 0) FROM contributions WHERE member_id = m.id AND type != 'arrears') AS total_monthly_due,
            (SELECT COALESCE(SUM(amount_paid), 0) FROM contributions WHERE member_id = m.id) AS total_paid,
            ((SELECT COALESCE(SUM(amount_due), 0) FROM contributions WHERE member_id = m.id) - 
             (SELECT COALESCE(SUM(amount_paid), 0) FROM contributions WHERE member_id = m.id)) AS outstanding_balance
       FROM members m 
       LEFT JOIN users u ON u.member_id = m.id
      ORDER BY m.house_number`
  );
  res.json({ members: rows });
});

// UPDATE a member's details
router.put('/:id', staff, async (req, res) => {
  const { household_name, house_number, phone, email, monthly_due, active, opening_balance } = req.body || {};

  // ✅ Sync Arrears: If opening_balance is edited, update the 'arrears' contribution row
  if (opening_balance !== undefined) {
    const val = Math.max(0, Number(opening_balance) || 0);
    const lastYear = new Date().getFullYear() - 1;
    await query(
      `INSERT INTO contributions (member_id, type, period_year, period_month, amount_due, amount_paid)
       VALUES ($1, 'arrears', $2, 12, $3, 0)
       ON CONFLICT (member_id, type, period_year, period_month)
       DO UPDATE SET amount_due = COALESCE(contributions.amount_paid, 0) + EXCLUDED.amount_due`,
      [req.params.id, lastYear, val]
    );
  }

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
  const arrears = Math.max(0, Number(opening_balance) || 0);
  
  try {
    const { rows } = await query(
      `INSERT INTO members (household_name, house_number, phone, email, monthly_due, active, opening_balance)
       VALUES ($1, $2, $3, $4, $5, true, $6) RETURNING *`,
      [household_name, house_number, phone || null, email || null, monthly_due, arrears]
    );
    
    // If there's arrears on a new member, create the contribution row immediately
    if (arrears > 0) {
      const lastYear = new Date().getFullYear() - 1;
      await query(
        `INSERT INTO contributions (member_id, type, period_year, period_month, amount_due, amount_paid)
         VALUES ($1, 'arrears', $2, 12, $3, 0)
         ON CONFLICT (member_id, type, period_year, period_month) DO NOTHING`,
        [rows[0].id, lastYear, arrears]
      );
    }
    
    res.status(201).json({ member: rows[0] });
  } catch (e) {
    if (e.code === '23505') {
      // Find which member already has this house number
      const existing = await query(
        `SELECT id, house_number, household_name, active FROM members WHERE house_number = $1`,
        [house_number]
      );
      if (existing.rows.length > 0) {
        const m = existing.rows[0];
        const status = m.active ? 'active' : 'inactive (moved out)';
        return res.status(409).json({ 
          error: `House number '${house_number}' is already assigned to '${m.household_name}' (House ${m.house_number}, ${status}).` 
        });
      }
      return res.status(409).json({ error: 'House number already exists' });
    }
    throw e;
  }
});
    
    res.status(201).json({ member: rows[0] });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'House number already exists' });
    throw e;
  }
});

// Create login (Fire-and-forget email to prevent timeouts)
router.post('/:id/create-login', staff, async (req, res) => {
  const member = await query('SELECT * FROM members WHERE id = $1', [req.params.id]);
  if (!member.rows[0]) return res.status(404).json({ message: 'Member not found' });
  
  const m = member.rows[0];
  if (!m.email) return res.status(400).json({ message: 'Member must have an email address to create a login.' });

  const existingUser = await query('SELECT id FROM users WHERE member_id = $1', [m.id]);
  if (existingUser.rows[0]) return res.status(409).json({ message: 'A login account already exists for this member.' });

  const tempPassword = crypto.randomBytes(6).toString('hex'); 
  const password_hash = bcrypt.hashSync(tempPassword, 10);

  await query(
    `INSERT INTO users (name, email, password_hash, role, member_id) 
     VALUES ($1, $2, $3, 'member', $4)`,
    [m.household_name, m.email.toLowerCase().trim(), password_hash, m.id]
  );

  res.json({ 
    message: `Login created for ${m.email}! New temporary password: ${tempPassword}. (Email is being sent in the background)` 
  });

  const loginUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  sendWelcomeEmail(m.email, tempPassword, loginUrl)
    .then(() => console.log('✅ Background email sent successfully to', m.email))
    .catch((emailErr) => console.error('❌ Background email failed for', m.email, ':', emailErr.message || emailErr));
});

// DELETE a member permanently
router.delete('/:id', staff, async (req, res) => {
  try {
    const hasHistory = await query('SELECT id FROM contributions WHERE member_id = $1 LIMIT 1', [req.params.id]);
    if (hasHistory.rows.length > 0) {
      return res.status(400).json({ message: 'Cannot delete member with payment history.' });
    }
    await query('DELETE FROM members WHERE id = $1', [req.params.id]);
    res.json({ message: 'Member permanently deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete member' });
  }
});

// MINIMAL Reset Password Route (Fire-and-forget email to prevent timeouts)
router.post('/:id/reset-password', staff, async (req, res) => {
  try {
    const tempPassword = crypto.randomBytes(6).toString('hex');
    const password_hash = bcrypt.hashSync(tempPassword, 10);

    const result = await query(
      `UPDATE users SET password_hash = $1 WHERE member_id = $2 RETURNING email`,
      [password_hash, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No login found for this member' });
    }

    const userEmail = result.rows[0].email;

    res.json({ 
      message: `Password reset successful for ${userEmail}! New temporary password: ${tempPassword}. (Email is being sent in the background)` 
    });

    const loginUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    sendWelcomeEmail(userEmail, tempPassword, loginUrl)
      .then(() => console.log('✅ Background email sent successfully to', userEmail))
      .catch((emailErr) => console.error('❌ Background email failed for', userEmail, ':', emailErr.message || emailErr));

  } catch (err) {
    console.error('Critical error in reset-password:', err);
    res.status(500).json({ message: `Error: ${err.message}` });
  }
});

module.exports = router;