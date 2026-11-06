const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit'); // NEW: Import rate limiter
const { query } = require('../db');
const { sign, authenticate } = require('../auth');
const { sendResetEmail } = require('../welcome-mail');
const { audit } = require('../audit');

const router = express.Router();

// Sign-in audit trail: which account signed in, when, from which client IP —
// and which attempts failed (brute-force visibility). Telemetry must never
// break authentication itself, so every write here is best-effort.
const clientMeta = (req) => ({
  ip: req.ip || null,
  user_agent: req.get('user-agent') || null,
});

async function recordSigninSuccess(user, req) {
  try {
    const meta = clientMeta(req);
    await query(
      `UPDATE users SET last_login_at = now(), last_login_ip = $2 WHERE id = $1`,
      [user.id, meta.ip]
    );
    await audit(user.id, 'LOGIN', 'users', user.id, null, { ...meta, role: user.role });
  } catch (err) {
    console.error('Sign-in audit (success) failed:', err.message);
  }
}

async function recordSigninFailure(req, email) {
  try {
    await audit(null, 'LOGIN_FAILED', 'users', null, null, {
      email: String(email === undefined || email === null ? '' : email).toLowerCase().trim().slice(0, 254),
      ...clientMeta(req),
    });
  } catch (err) {
    console.error('Sign-in audit (failure) failed:', err.message);
  }
}

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
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    await recordSigninFailure(req, email);
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  await recordSigninSuccess(user, req);
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