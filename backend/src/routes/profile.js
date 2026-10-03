const bcrypt = require('bcrypt');
const express = require('express');
const { query } = require('../db');
const { authenticate } = require('../auth');

const router = express.Router();

// All profile routes require authentication
router.use(authenticate);

// GET current profile data
router.get('/', async (req, res) => {
  try {
    // Fetch user details
    const userRes = await query('SELECT id, name, email FROM users WHERE id = $1', [req.user.id]);
    const user = userRes.rows[0];

    // Fetch member details (linked by email)
    const memberRes = await query('SELECT phone FROM members WHERE email = $1', [user.email]);
    const phone = memberRes.rows[0]?.phone || '';

    res.json({ ...user, phone });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// PUT update profile
router.put('/', async (req, res) => {
  const { name, email, phone } = req.body;
  const userId = req.user.id;
  const oldEmail = req.user.email; // The email they logged in with

  try {
    // 1. Update the Users table (Login credentials)
    await query('UPDATE users SET name = $1, email = $2 WHERE id = $3', [name, email, userId]);

    // 2. Update the Members table (Contact info)
    // We use the old email to find the record, in case they are changing their email
    await query('UPDATE members SET phone = $1, email = $2 WHERE email = $3', [phone, email, oldEmail]);

    // 3. Update the session token/user object if email changed (Optional but good practice)
    // For now, we just return success. The user might need to re-login if email changes significantly, 
    // but for this app, it usually works fine.

    res.json({ message: 'Profile updated successfully!' });
  } catch (error) {
    console.error('Profile update error:', error);
    // Handle duplicate email error specifically
    if (error.code === '23505') {
      return res.status(400).json({ error: 'This email is already in use by another account.' });
    }
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// PUT Change Password
router.put('/change-password', async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  try {
    // 1. Get the user's current password hash from DB
    const userRes = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    const user = userRes.rows[0];

    if (!user) return res.status(404).json({ error: 'User not found' });

    // 2. Verify the current password
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    // 3. Hash the new password and update
    const newHash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, userId]);

    res.json({ message: 'Password updated successfully!' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Failed to update password.' });
  }
});

module.exports = router;