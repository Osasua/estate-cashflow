const express = require('express');
const { query } = require('../db');
const { authenticate } = require('../auth');
const { sendBroadcastEmail } = require('../mailer');
const { sendWhatsAppMessage, whatsappConfigured } = require('../whatsapp');

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
  const { subject, message, channels } = req.body;

  if (!subject || !message) {
    return res.status(400).json({ error: 'Subject and message are required.' });
  }

  const ALLOWED = ['email', 'whatsapp'];
  const chans = (Array.isArray(channels) ? channels : ['email']).filter((c) => ALLOWED.includes(c));
  if (chans.length === 0) {
    return res.status(400).json({ error: 'Select at least one channel (email or whatsapp).' });
  }

  const results = {
    email: chans.includes('email') ? { sent: 0, failed: 0 } : null,
    whatsapp: chans.includes('whatsapp') ? { sent: 0, failed: 0, no_phone: 0, unavailable: false } : null,
  };

  try {
    if (results.email) {
      const membersRes = await query('SELECT email, household_name FROM members WHERE email IS NOT NULL AND email != \'\'');
      for (const member of membersRes.rows) {
        try {
          await sendBroadcastEmail(member.email, subject, message, member.household_name);
          results.email.sent++;
        } catch (err) {
          console.error(`Failed to email ${member.email}:`, err.message);
          results.email.failed++;
        }
      }
    }

    if (results.whatsapp) {
      if (!whatsappConfigured()) {
        results.whatsapp.unavailable = true;
      } else {
        const phRes = await query('SELECT phone, household_name FROM members WHERE phone IS NOT NULL AND phone != \'\'');
        const allRes = await query('SELECT COUNT(*)::int AS n FROM members');
        results.whatsapp.no_phone = (allRes.rows[0]?.n || 0) - phRes.rows.length;
        for (const member of phRes.rows) {
          try {
            await sendWhatsAppMessage(member.phone, `${subject}\n\n${message}`);
            results.whatsapp.sent++;
          } catch (err) {
            console.error(`Failed to WhatsApp ${member.phone}:`, err.message);
            results.whatsapp.failed++;
          }
        }
      }
    }

    const parts = [];
    if (results.email) parts.push(`Email: ${results.email.sent} sent, ${results.email.failed} failed`);
    if (results.whatsapp) {
      parts.push(results.whatsapp.unavailable
        ? 'WhatsApp: Twilio not configured on server — use the wa.me composer below'
        : `WhatsApp: ${results.whatsapp.sent} sent, ${results.whatsapp.failed} failed, ${results.whatsapp.no_phone} without phone`);
    }
    res.json({ message: `Broadcast complete. ${parts.join(' · ')}.`, results });
  } catch (error) {
    console.error('Broadcast error:', error);
    res.status(500).json({ error: 'Failed to process broadcast.' });
  }
});

// GET /api/admin/broadcast/phones — staff only; contacts for the wa.me composer
router.get('/phones', requireStaff, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT household_name, phone FROM members
       WHERE phone IS NOT NULL AND phone != '' ORDER BY household_name`
    );
    const contacts = rows.map((r) => {
      let digits = String(r.phone).replace(/[^\d+]/g, '');
      if (digits.startsWith('+')) digits = digits.slice(1);
      else if (digits.startsWith('0')) digits = '234' + digits.slice(1);
      return { name: r.household_name, phone: r.phone, wa_digits: digits };
    });
    res.json({ contacts });
  } catch (err) {
    console.error('GET phones error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;