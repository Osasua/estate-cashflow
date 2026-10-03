const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query } = require('../db');
const { sendResetEmail } = require('../mailer');

const router = express.Router();

// 1. Request Password Reset
router.post('/forgot', async (req, res) => {
  const { email } = req.body;

  try {
    // Find user by email
    const { rows } = await query('SELECT id, name, email FROM users WHERE email = $1', [email]);
    
    // Security: Always return success, even if email doesn't exist
    if (rows.length === 0) {
      return res.json({ message: 'If an account exists with this email, a reset link has been sent.' });
    }

    const user = rows[0];

    // Generate a secure, short-lived token (15 minutes)
    const token = jwt.sign(
      { userId: user.id }, 
      process.env.JWT_SECRET, 
      { expiresIn: '15m' }
    );

    // Create the reset link
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    // Send the email
    await sendResetEmail(user.email, user.name, resetLink);

    res.json({ message: 'If an account exists with this email, a reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// 2. Reset Password with Token
router.post('/reset', async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }

  try {
    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // Hash the new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update the database
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);

    res.json({ message: 'Password updated successfully. You can now log in.' });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });
    }
    console.error('Reset password error:', error);
    res.status(400).json({ error: 'Invalid or expired reset token' });
  }
});

module.exports = router;