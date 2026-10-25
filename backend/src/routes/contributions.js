const express = require('express');
const { pool, query } = require('../db');
const { authenticate, staff } = require('../auth');

const router = express.Router();
router.use(authenticate);

const statusOf = (r) => {
  const paid = Number(r.amount_paid || 0);
  const due = Number(r.amount_due || 0);
  if (due > 0 && paid >= due) return 'paid';
  if (paid > 0) return 'partial';
  return 'pending';
};

// GET contributions
router.get('/', async (req, res) => {
  const year = +req.query.year || new Date().getFullYear();
  const month = +req.query.month || new Date().getMonth() + 1;
  const type = req.query.type || 'monthly';

  try {
    const { rows } = await query(
      `SELECT c.*, m.household_name, m.house_number, m.active,
              COALESCE(c.note, (SELECT string_agg(reference, ', ' ORDER BY id) 
                 FROM payments WHERE contribution_id = c.id)) AS references
         FROM contributions c JOIN members m ON m.id = c.member_id
        WHERE c.period_year = $1 AND c.period_month = $2 AND c.type = $3
        ORDER BY m.house_number`,
      [year, month, type]
    );
    res.json({
      month, year, type,
      contributions: rows.map((r) => ({ ...r, status: statusOf(r) })),
    });
  } catch (err) {
    console.error('GET contributions error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET occasional contribution activation period
router.get('/activation-period', async (req, res) => {
  const type = req.query.type;
  if (!type) return res.status(400).json({ error: 'Type required' });

  try {
    const { rows } = await query(
      `SELECT DISTINCT period_year, period_month 
         FROM contributions 
        WHERE type = $1 
        ORDER BY period_year DESC, period_month DESC 
        LIMIT 1`,
      [type]
    );
    res.json(rows[0] || null);
  } catch (err) {
    console.error('GET activation period error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST generate bills (improved for occasional contributions)
router.post('/generate', staff, async (req, res) => {
  const { month, year, type = 'monthly', amount } = req.body || {};
  if (!(month >= 1 && month <= 12) || !(year >= 2000 && year <= 2100))
    return res.status(400).json({ error: 'Valid month (1-12) and year are required' });

  try {
    let rowCount;
    
    // For occasional contributions, check if already activated
    if (type !== 'monthly') {
      const { rows: existing } = await query(
        `SELECT COUNT(*) as count FROM contributions WHERE type = $1 AND period_year = $2 AND period_month = $3`,
        [type, year, month]
      );
      
      if (existing[0].count > 0) {
        return res.status(409).json({ 
          error: `${type} contribution already activated for ${month}/${year}. Use Edit to modify amounts.` 
        });
      }
    }

    // Generate for currently active members
    const { rowCount: generated } = await query(
      `INSERT INTO contributions (member_id, type, period_year, period_month, amount_due)
         SELECT id, $1, $2, $3, CASE WHEN $4 > 0 THEN $4 ELSE monthly_due END FROM members WHERE active = true
       ON CONFLICT (member_id, type, period_year, period_month) DO NOTHING`,
      [type, year, month, Number(amount) || 0]
    );
    
    console.log(`✅ Generated ${generated} bills for ${type} ${month}/${year}`);
    res.json({ generated });
  } catch (err) {
    console.error('❌ Generate bills failed:', err);
    if (err.message.includes('invalid input value for enum')) {
      return res.status(400).json({ error: `Type '${type}' not allowed.` });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT edit contribution
router.put('/:id', staff, async (req, res) => {
  try {
    const { amount_due, amount_paid, note } = req.body || {};
    
    const newDue = amount_due !== undefined ? Number(amount_due) : null;
    const newPaid = amount_paid !== undefined ? Number(amount_paid) : null;
    
    if (newDue !== null && newDue < 0) return res.status(400).json({ error: 'Amount due cannot be negative' });
    if (newPaid !== null && newPaid < 0) return res.status(400).json({ error: 'Amount paid cannot be negative' });

    const { rows } = await query(
      `UPDATE contributions SET 
         amount_due = COALESCE($2, amount_due),
         amount_paid = COALESCE($3, amount_paid),
         note = COALESCE($4, note)
       WHERE id = $1 RETURNING *`,
      [req.params.id, newDue, newPaid, note !== undefined ? note : null]
    );
    
    if (rows.length === 0) return res.status(404).json({ error: 'Contribution not found' });
    
    res.json({ 
      contribution: { ...rows[0], status: statusOf(rows[0]) },
      message: 'Contribution updated successfully'
    });
  } catch (err) {
    console.error('PUT contribution error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST record payment
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

    const { rows: [member] } = await client.query(
      'SELECT id, monthly_due FROM members WHERE id = $1 AND active = true',
      [member_id]
    );
    if (!member) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot record payment for an inactive member.' });
    }

    const monthlyDue = Number(member.monthly_due || 0);
    let remaining = amt;
    const allocations = []; 

    // 1. Clear Previous-Year Arrears
    const { rows: [arrearsRow] } = await client.query(
      `SELECT id, period_year, period_month, amount_due, amount_paid
         FROM contributions
        WHERE member_id = $1 AND type = 'arrears'`,
      [member_id]
    );
    if (arrearsRow && remaining > 0) {
      const owed = Number(arrearsRow.amount_due) - Number(arrearsRow.amount_paid);
      if (owed > 0) {
        const allocate = Math.min(remaining, owed);
        allocations.push({ contrib_id: arrearsRow.id, amount: allocate, year: arrearsRow.period_year, month: arrearsRow.period_month, type: 'arrears' });
        remaining -= allocate;
      }
    }

    // 2. Allocate to oldest unpaid months
    const { rows: existingContribs } = await client.query(
      `SELECT id, period_year, period_month, amount_due, amount_paid
         FROM contributions
        WHERE member_id = $1 AND type = $2
        ORDER BY period_year ASC, period_month ASC`,
      [member_id, type]
    );
    for (const c of existingContribs) {
      if (remaining <= 0) break;
      const owed = Number(c.amount_due) - Number(c.amount_paid);
      if (owed > 0) {
        const allocate = Math.min(remaining, owed);
        allocations.push({ contrib_id: c.id, amount: allocate, year: c.period_year, month: c.period_month, type });
        remaining -= allocate;
      }
    }

    // 3. Future months
    if (remaining > 0 && type === 'monthly') {
      let anchorDate = new Date(year, month - 1, 1);
      const today = new Date(); today.setDate(1);
      if (anchorDate < today) anchorDate = today;

      let monthsAhead = 0;
      while (remaining > 0 && monthsAhead < 24) {
        const fYear = anchorDate.getFullYear();
        const fMonth = anchorDate.getMonth() + 1;

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
          const owed = Number(fc.amount_due) - Number(fc.amount_paid);
          if (owed > 0) {
            const allocate = Math.min(remaining, owed);
            allocations.push({ contrib_id: fc.id, amount: allocate, year: fYear, month: fMonth, type });
            remaining -= allocate;
          }
        }
        anchorDate.setMonth(anchorDate.getMonth() + 1);
        monthsAhead++;
      }
    }

    // 4. Fallback
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
      allocations.push({ contrib_id: fallback.id, amount: remaining, year, month, type });
      remaining = 0;
    }

    // 5. Update and insert records
    const baseRef = reference || `PAY-${Date.now()}`;
    for (let i = 0; i < allocations.length; i++) {
      const alloc = allocations[i];
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

    await client.query('COMMIT');

    res.status(201).json({ 
      message: `Payment of ₦${amt.toLocaleString()} allocated successfully.`,
      allocations,
      credit_balance: remaining
    });

  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Payment error:', e);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

module.exports = router;