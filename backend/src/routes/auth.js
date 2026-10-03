const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit'); // NEW: Import rate limiter
const { query } = require('../db');
const { sign, authenticate } = require('../auth');
const { sendResetEmail } = require('../mailer');

const router = express.Router();

// NEW: Rate limiter configuration
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: 'Too many attempts from this IP, please try again after 15 minutes.'
});

// UPDATED: Added authLimiter
router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });
  const { rows } = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
  const user = rows[0];
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: 'Invalid email or password' });
  res.json({
    token: sign(user),
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

router.get('/me', authenticate, (req, res) => res.json({ user: req.user }));

// UPDATED: Added authLimiter
router.post('/forgot-password', authLimiter, async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const { rows } = await query('SELECT id, email FROM users WHERE email = $1', [email.toLowerCase().trim()]);
  const user = rows[0];

  if (!user) {
    return res.json({ message: 'If an account exists with this email, a reset link has been sent.' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 3600000);

  await query(
    'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
    [token, expires, user.id]
  );

  try {
    await sendResetEmail(user.email, token);
    res.json({ message: 'If an account exists with this email, a reset link has been sent.' });
  } catch (error) {
    console.error('Email sending failed:', error);
    res.status(500).json({ error: 'Failed to send reset email. Please try again later.' });
  }
});

router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }

  const { rows } = await query(
    'SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
    [token]
  );
  const user = rows[0];

  if (!user) {
    return res.status(400).json({ error: 'Invalid or expired reset token' });
  }

  const password_hash = bcrypt.hashSync(newPassword, 10);

  await query(
    'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
    [password_hash, user.id]
  );

  res.json({ message: 'Password has been successfully reset. You can now log in.' });
});

module.exports = router;