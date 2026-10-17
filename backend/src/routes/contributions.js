const express = require('express');
const { pool, query } = require('../db');
const { authenticate, staff } = require('../auth');
const { audit } = require('../audit');

const router = express.Router();
router.use(authenticate);

const statusOf = (r) =>
  r.amount_paid >= r.amount_due && r.amount_due > 0 ? 'paid'
  : r.amount_paid > 0 ? 'partial' : 'pending';

// GET contributions for a specific month/year/type
router.get('/', async (req, res) => {
  const year = +req.query.year || new Date().getFullYear();
  const month = +req.query.month || new Date().getMonth() + 1;
  const type = req.query.type || 'monthly';

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

// GET defaulters list
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

// POST generate monthly bills
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

// POST record payment (HYBRID WATERFALL ALLOCATION)
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

    // 1. Verify member is active and get their monthly due
    const { rows: [member] } = await client.query(
      'SELECT id, monthly_due FROM members WHERE id = $1 AND active = true',
      [member_id]
    );
    if (!member) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot record payment for an inactive member.' });
    }

    const monthlyDue = member.monthly_due || 0;
    let remaining = amt;
    const allocations = []; // Tracks { contrib_id, amount, year, month }

    // 2. Get all existing contributions for this member (oldest first)
    const { rows: existingContribs } = await client.query(
      `SELECT id, period_year, period_month, amount_due, amount_paid 
         FROM contributions 
        WHERE member_id = $1 AND type = $2 
        ORDER BY period_year ASC, period_month ASC`,
      [member_id, type]
    );

    // 3. Allocate to oldest unpaid/partial months first (Clears Arrears)
    for (const c of existingContribs) {
      if (remaining <= 0) break;
      const owed = c.amount_due - c.amount_paid;
      if (owed > 0) {
        const allocate = Math.min(remaining, owed);
        allocations.push({ contrib_id: c.id, amount: allocate, year: c.period_year, month: c.period_month });
        remaining -= allocate;
      }
    }

    // 4. If money remains, allocate to future months (up to 24 months ahead)
    if (remaining > 0) {
      let anchorDate = new Date(year, month - 1, 1);
      const today = new Date(); today.setDate(1);
      if (anchorDate < today) anchorDate = today; // Start from current month if payload date is in the past

      let monthsAhead = 0;
      while (remaining > 0 && monthsAhead < 24) {
        const fYear = anchorDate.getFullYear();
        const fMonth = anchorDate.getMonth() + 1;

        // Ensure future contribution row exists
        await client.query(
          `INSERT INTO contributions (member_id, type, period_year, period_month, amount_due, amount_paid)
             VALUES ($1, $2, $3, $4, $5, 0)
           ON CONFLICT (member_id, type, period_year, period_month) DO NOTHING`,
          [member_id, type, fYear, fMonth, monthlyDue]
        );

        const { rows: [fc] } = await client.query(
          `SELECT id, amount_due, amount_paid FROM contributions 
             WHERE member_id = $1 AND type = $2 AND period_year = $3 AND period_month = $4`,
          [member_id, type, fYear, fMonth]
        );

        if (fc) {
          const owed = fc.amount_due - fc.amount_paid;
          if (owed > 0) {
            const allocate = Math.min(remaining, owed);
            allocations.push({ contrib_id: fc.id, amount: allocate, year: fYear, month: fMonth });
            remaining -= allocate;
          }
        }
        anchorDate.setMonth(anchorDate.getMonth() + 1);
        monthsAhead++;
      }
    }

    // 5. Fallback: If still remaining (e.g. they paid 25 months in advance), dump it into the requested month as an overpayment (Credit Balance)
    if (allocations.length === 0 && remaining > 0) {
      await client.query(
        `INSERT INTO contributions (member_id, type, period_year, period_month, amount_due, amount_paid)
           VALUES ($1, $2, $3, $4, $5, 0)
         ON CONFLICT (member_id, type, period_year, period_month) DO NOTHING`,
        [member_id, type, year, month, monthlyDue]
      );
      const { rows: [fallback] } = await client.query(
        `SELECT id FROM contributions WHERE member_id = $1 AND type = $2 AND period_year = $3 AND period_month = $4`,
        [member_id, type, year, month]
      );
      allocations.push({ contrib_id: fallback.id, amount: remaining, year, month });
      remaining = 0;
    }

    // 6. Update contributions and insert payment records
    const baseRef = reference || `PAY-${Date.now()}`;
    for (let i = 0; i < allocations.length; i++) {
      const alloc = allocations[i];
      // Append -1, -2 etc to reference if the payment was split across multiple months
      const allocRef = allocations.length > 1 ? `${baseRef}-${i + 1}` : baseRef;
      
      await client.query(
        `UPDATE contributions SET amount_paid = amount_paid + $1 WHERE id = $2`,
        [alloc.amount, alloc.contrib_id]
      );

      await client.query(
        `INSERT INTO payments (contribution_id, amount, method, reference, note, recorded_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [alloc.contrib_id, alloc.amount, method, allocRef, note || null, req.user.id]
      );
    }

    // Audit log
    await client.query(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, new_value)
       VALUES ($1, 'payment', 'payments', $2, $3)`,
      [req.user.id, member_id, JSON.stringify({ 
        member_id, total_amount: amt, method, allocations 
      })]
    );

    await client.query('COMMIT');

    res.status(201).json({ 
      message: `Payment of ₦${amt.toLocaleString()} allocated successfully.`,
      allocations,
      credit_balance: remaining // Will be 0 unless they paid >24 months in advance
    });

  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

// GET Credit Balance for a member
router.get('/credit-balance/:member_id', async (req, res) => {
  const { rows } = await query(
    `SELECT COALESCE(SUM(amount_paid - amount_due), 0) AS credit_balance
       FROM contributions 
      WHERE member_id = $1 AND amount_paid > amount_due`,
    [req.params.member_id]
  );
  res.json({ credit_balance: rows[0].credit_balance || 0 });
});

module.exports = router;