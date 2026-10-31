const express = require('express');
const { query } = require('../db');
const { authenticate, staff } = require('../auth');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { sendWelcomeEmail } = require('../mailer');

const router = express.Router();
router.use(authenticate);

// GET all members
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT m.*, 
              u.email AS user_email, 
              u.name AS user_name,
              COALESCE((SELECT amount_due - amount_paid FROM contributions WHERE member_id = m.id AND type = 'arrears' LIMIT 1), 0) AS opening_balance,
              ((SELECT COALESCE(SUM(amount_due), 0) FROM contributions WHERE member_id = m.id) - 
               (SELECT COALESCE(SUM(amount_paid), 0) FROM contributions WHERE member_id = m.id)) AS outstanding_balance
         FROM members m 
         LEFT JOIN users u ON u.member_id = m.id
        ORDER BY m.house_number`
    );
    res.json({ members: rows });
  } catch (err) {
    console.error('GET members error:', err);
    res.status(500).json({ error: err.message });
  }
});

// UPDATE a member
router.put('/:id', staff, async (req, res) => {
  try {
    const { household_name, house_number, phone, email, monthly_due, active, opening_balance = 0} = req.body || {};

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
  } catch (err) {
    console.error('PUT member error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ADD a new member
router.post('/', staff, async (req, res) => {
  try {
    const { household_name, house_number, phone, email, monthly_due, opening_balance } = req.body || {};
    const due = Number(monthly_due) || 10000;
    const arrears = Math.max(0, Number(opening_balance) || 0);

    const { rows } = await query(
      `INSERT INTO members (household_name, house_number, phone, email, monthly_due, active, opening_balance)
       VALUES ($1, $2, $3, $4, $5, true, $6) RETURNING *`,
      [household_name, house_number, phone || null, email || null, due, arrears]
    );

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
      try {
        const existing = await query(
          `SELECT house_number, household_name, active FROM members WHERE house_number = $1`,
          [req.body.house_number]
        );
        if (existing.rows.length > 0) {
          const m = existing.rows[0];
          const status = m.active ? 'Active' : 'Inactive (Moved Out)';
          return res.status(409).json({
            error: `House number '${req.body.house_number}' is already assigned to '${m.household_name}' (${status}). Reactivate them from the list, or use a different house number.`
          });
        }
      } catch (lookupErr) {
        console.error('Lookup error:', lookupErr);
      }
      return res.status(409).json({ error: 'House number already exists' });
    }
    console.error('POST member error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Create login
router.post('/:id/create-login', staff, async (req, res) => {
  try {
    const member = await query('SELECT * FROM members WHERE id = $1', [req.params.id]);
    if (!member.rows[0]) return res.status(404).json({ message: 'Member not found' });

    const m = member.rows[0];
    if (!m.email) return res.status(400).json({ message: 'Member must have an email address.' });

    const existingUser = await query('SELECT id FROM users WHERE member_id = $1', [m.id]);
    if (existingUser.rows[0]) return res.status(409).json({ message: 'Login already exists.' });

    const tempPassword = crypto.randomBytes(6).toString('hex');
    const password_hash = bcrypt.hashSync(tempPassword, 10);

    await query(
      `INSERT INTO users (name, email, password_hash, role, member_id) 
       VALUES ($1, $2, $3, 'member', $4)`,
      [m.household_name, m.email.toLowerCase().trim(), password_hash, m.id]
    );

    res.json({ message: `Login created for ${m.email}! Temp password: ${tempPassword}` });

    // ✅ Send Welcome Email using Brevo HTTP API (Guaranteed to work)
    const loginUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const BREVO_API_KEY = process.env.BREVO_API_KEY;
    const senderEmail = process.env.SMTP_FROM_EMAIL || 'your-verified-email@domain.com';
    const senderName = process.env.SMTP_FROM_NAME || 'Estate Management';

    if (BREVO_API_KEY) {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #166534; text-align: center;">Welcome to Ferrano Court Portal</h2>
          <p>Dear <strong>${m.household_name}</strong>,</p>
          <p>Your login credentials for the estate portal have been created successfully.</p>
          
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6366f1;">
            <p style="margin: 8px 0;"><strong>📧 Email:</strong> ${m.email}</p>
            <p style="margin: 8px 0;"><strong>🔑 Temporary Password:</strong> <code style="background: #fff; padding: 4px 8px; border-radius: 4px; font-size: 1.1em;">${tempPassword}</code></p>
            <p style="margin: 8px 0;"><strong>🔗 Login URL:</strong> <a href="${loginUrl}" style="color: #6366f1;">${loginUrl}</a></p>
          </div>

          <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h3 style="margin: 0 0 12px 0; color: #92400e; font-size: 1.1em;">⚠️ Important: Change Your Password</h3>
            <p style="margin: 0 0 12px 0; color: #92400e;">For security reasons, you <strong>must</strong> change your temporary password upon first login.</p>
            
            <h4 style="margin: 16px 0 8px 0; color: #92400e; font-size: 1em;">Steps to change your password:</h4>
            <ol style="margin: 0; padding-left: 20px; color: #92400e;">
              <li>Log in to the portal using the temporary password above</li>
              <li>Click on <strong>"My Profile"</strong> in the left sidebar menu</li>
              <li>Click the <strong>"Change Password"</strong> button</li>
              <li>Enter your current (temporary) password</li>
              <li>Enter your new password (minimum 8 characters)</li>
              <li>Confirm your new password</li>
              <li>Click <strong>"Update Password"</strong></li>
            </ol>
          </div>

          <p style="color: #6b7280; font-size: 0.95em; margin-top: 24px;">
            If you have any questions or need assistance, please contact the estate management office.
          </p>
          
          <p style="color: #9ca3af; font-size: 0.85em; text-align: center; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
            This is an automated message. Please do not reply to this email.
          </p>
        </div>
      `;

      fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'api-key': BREVO_API_KEY
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: m.email, name: m.household_name }],
          subject: 'Welcome to Ferrano Court Portal - Your Login Credentials',
          htmlContent: emailHtml
        })
      })
      .then(response => {
        if (response.ok) console.log('✅ Welcome email sent to', m.email);
        else response.json().then(err => console.error('❌ Brevo API Error:', err));
      })
      .catch(err => console.error('❌ Network error sending email:', err.message));
    } else {
      console.error('❌ BREVO_API_KEY is missing in environment variables');
    }

  } catch (err) {
    console.error('Create login error:', err);
    res.status(500).json({ message: err.message });
  }
});

// DELETE a member
router.delete('/:id', staff, async (req, res) => {
  try {
    const hasHistory = await query('SELECT id FROM contributions WHERE member_id = $1 LIMIT 1', [req.params.id]);
    if (hasHistory.rows.length > 0) {
      return res.status(400).json({ message: 'Cannot delete member with payment history.' });
    }
    await query('DELETE FROM members WHERE id = $1', [req.params.id]);
    res.json({ message: 'Member deleted' });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Reset password
router.post('/:id/reset-password', staff, async (req, res) => {
  try {
    const tempPassword = crypto.randomBytes(6).toString('hex');
    const password_hash = bcrypt.hashSync(tempPassword, 10);

    const result = await query(
      `UPDATE users SET password_hash = $1 WHERE member_id = $2 RETURNING email`,
      [password_hash, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No login found.' });
    }

    const userEmail = result.rows[0].email;
    res.json({ message: `Password reset for ${userEmail}! New password: ${tempPassword}` });

    const loginUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    sendWelcomeEmail(userEmail, tempPassword, loginUrl)
      .then(() => console.log('✅ Email sent to', userEmail))
      .catch((err) => console.error('❌ Email failed:', err.message));
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;