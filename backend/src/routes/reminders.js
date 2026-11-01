const express = require('express');
const { query } = require('../db');
const { authenticate, staff } = require('../auth');
const { runReminders, COOLDOWN_DAYS } = require('../reminders');

const router = express.Router();
router.use(authenticate, staff);

// POST /api/reminders/send?dryRun=1
// dryRun lists who WOULD be reminded (same selection the cron uses) without
// sending or logging anything; the real run sends and records each send.
router.post('/send', async (req, res) => {
  try {
    const dryRun = req.query.dryRun === '1' || req.query.dryRun === 'true';
    const summary = await runReminders({ dryRun });
    res.json({ ...summary, cooldown_days: COOLDOWN_DAYS });
  } catch (err) {
    console.error('Reminders send error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reminders — recent reminder audit log
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT pr.id, pr.channel, pr.fund, pr.outstanding_at_send, pr.sent_at,
              m.household_name, m.house_number,
              c.period_year, c.period_month
         FROM payment_reminders pr
         JOIN members m ON m.id = pr.member_id
         JOIN contributions c ON c.id = pr.contribution_id
        ORDER BY pr.sent_at DESC
        LIMIT 100`
    );
    res.json({ reminders: rows });
  } catch (err) {
    console.error('Reminders log error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
