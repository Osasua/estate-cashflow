const express = require('express');
const { pool, query } = require('../db');
const { authenticate, staff } = require('../auth');
const { audit } = require('../audit');

const router = express.Router();
router.use(authenticate);

const statusOf = (r) =>
  r.amount_paid >= r.amount_due && r.amount_due > 0 ? 'paid'
  : r.amount_paid > 0 ? 'partial' : 'pending';

// UPDATED: Now filters by 'type' AND ensures member is active
router.get('/', async (req, res) => {
  const year = +req.query.year || new Date().getFullYear();
  const month = +req.query.month || new Date().getMonth() + 1;
  const type = req.query.type || 'monthly'; // Default to monthly if not specified

  const { rows } = await query(
    `SELECT c.*, m.household_name, m.house_number
       FROM contributions c JOIN members m ON m.id = c.member_id
      WHERE c.period_year = $1 AND c.period_month = $2 AND c.type = $3 AND m.active = true
      ORDER BY m.house_number`,
    [year, month, type]
  );
  res.json({
    month, year, type,
    contributions: rows.map((r) => ({ ...r, status: statusOf(r) })),
  });
});

// UPDATED: Ensures defaulters list only shows ACTIVE members
router.get('/defaulters', async (req, res) => {
  const monthsBack = Math.min(+req.query.months || 3, 24);
  const { rows } = await query(
    `SELECT m.household_name, m.house_number,
            COUNT(*)::int AS unpaid_months,
            SUM(c.amount_due - c.amount_paid) AS total_owed
       FROM contributions c JOIN members m ON m.id = c.member_id
      WHERE c.amount_due > c.amount_paid
        AND m.active = true
        AND make_date(c.period_year, c.period_month, 1)
            >= date_trunc('month', CURRENT_DATE) - ($1 || ' months')::interval
      GROUP BY m.id ORDER BY total_owed DESC`,
    [monthsBack]
  );
  res.json({ defaulters: rows });
});

// UPDATED: Now generates bills for a specific 'type' (Already had WHERE active, kept as is)
router.post('/generate', staff, async (req, res) => {
  const { month, year, type = 'monthly', amount } = req.body || {};
  if (!(month >= 1 && month <= 12) || !(year >= 2000 && year <= 2100))
    return res.status(400).json({ error: 'Valid month (1-12) and year are required' });
  
  const { rowCount } = await query(
    `INSERT INTO contributions (member_id, type, period_year, period_month, amount_due)
       SELECT id, $1, $2, $3, CASE WHEN $4 > 0 THEN $4 ELSE monthly_due END FROM members WHERE active = true
     ON CONFLICT (member_id, type, period_year, period_month) DO NOTHING`,
    [type, year, month, amount]
  );
  await audit(req.user.id, 'generate', 'contributions', null, null, { month, year, type, count: rowCount });
  res.json({ generated: rowCount });
});

// UPDATED: Now records payments against a specific 'type'
router.post('/payments', staff, async (req, res) => {
  const { member_id, month, year, type = 'monthly', amount, method = 'cash', reference, note } = req.body || {};
  const amt = Number(amount);
  if (!member_id || !(month >= 1 && month <= 12) || !(year >= 2000 && year <= 2100) || !(amt > 0))
    return res.status(400).json({ error: 'member_id, month, year and a positive amount are required' });
  if (reference) {
    const existing = await query('SELECT id FROM payments WHERE reference = $1', [reference]);
    if (existing.rows[0]) return res.status(409).json({ error: 'Duplicate payment reference' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO contributions (member_id, type, period_year, period_month, amount_due)
         VALUES ($1, $2, $3, $4, (SELECT monthly_due FROM members WHERE id = $1 AND active = true))
       ON CONFLICT (member_id, type, period_year, period_month) DO NOTHING`,
      [member_id, type, year, month]
    );
    const { rows: [contrib] } = await client.query(
      `SELECT id FROM contributions WHERE member_id = $1 AND type = $2 AND period_year = $3 AND period_month = $4`,
      [member_id, type, year, month]
    );
    
    if (!contrib) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot record payment for an inactive member.' });
    }

    const { rows: [payment] } = await client.query(
      `INSERT INTO payments (contribution_id, amount, method, reference, note, recorded_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [contrib.id, amt, method, reference || null, note || null, req.user.id]
    );
    const { rows: [updated] } = await client.query(
      `UPDATE contributions SET amount_paid = amount_paid + $1 WHERE id = $2 RETURNING *`,
      [amt, contrib.id]
    );
    await client.query(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, new_value)
       VALUES ($1, 'payment', 'payments', $2, $3)`,
      [req.user.id, payment.id, JSON.stringify({ member_id, month, year, type, amount: amt, method })]
    );
    await client.query('COMMIT');
    res.status(201).json({ payment, contribution: { ...updated, status: statusOf(updated) } });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

module.exports = router;