const express = require('express');
const { query } = require('../db');
const { authenticate } = require('../auth');
const { sendBroadcastEmail } = require('../mailer');

const router = express.Router();
router.use(authenticate);

// Middleware to ensure only Admin or Treasurer can send broadcasts
const requireStaff = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'treasurer') {
    return res.status(403).json({ error: 'Access denied. Staff only.' });
  }
  next();
};

router.post('/', requireStaff, async (req, res) => {
  const { subject, message } = req.body;
  
  if (!subject || !message) {
    return res.status(400).json({ error: 'Subject and message are required.' });
  }

  try {
    // Fetch all members who have an email address
    const membersRes = await query('SELECT email, household_name FROM members WHERE email IS NOT NULL AND email != \'\'');
    const members = membersRes.rows;

    if (members.length === 0) {
      return res.json({ message: 'Broadcast complete, but no residents with email addresses were found.' });
    }

    let sentCount = 0;
    let failedCount = 0;

    // Send emails sequentially to avoid hitting Gmail rate limits
    for (const member of members) {
      try {
        await sendBroadcastEmail(member.email, subject, message, member.household_name);
        sentCount++;
      } catch (err) {
        console.error(`Failed to send to ${member.email}:`, err.message);
        failedCount++;
      }
    }

    res.json({ 
      message: `Broadcast complete! Successfully sent to ${sentCount} resident(s). Failed: ${failedCount}.` 
    });

  } catch (error) {
    console.error('Broadcast error:', error);
    res.status(500).json({ error: 'Failed to process broadcast.' });
  }
});

module.exports = router;