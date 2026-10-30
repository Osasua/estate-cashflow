const express = require('express');
const { query } = require('../db');
const { authenticate } = require('../auth');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    // Occasional funds report all-time (their activations are sparse);
    // monthly/overview honour the viewing window as before.
    const OCCASIONAL = ['float', 'projects', 'end-of-year', 'welfare'];
    const requestedType = req.query.type;
    const viewing = (requestedType && OCCASIONAL.includes(requestedType))
      ? 'all_time'
      : (req.query.viewing || 'this_month');
    const type = req.query.type;
    const ACCOUNT_TYPES = ['monthly', 'float', 'projects', 'end-of-year', 'welfare'];
    if (type && !ACCOUNT_TYPES.includes(type)) {
      return res.status(400).json({ error: `Invalid type. Expected one of: ${ACCOUNT_TYPES.join(', ')}` });
    }
    const scoped = !!type;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // ✅ STEP 1: Find the correct member for this user
    // Try multiple strategies to link user to member
    let memberRes = await query(`
      SELECT m.id, m.house_number, m.household_name, m.monthly_due, m.active
      FROM members m
      WHERE m.id = (SELECT member_id FROM users WHERE id = $1)
    `, [userId]);

    // Fallback: match by email if member_id column doesn't exist
    if (memberRes.rows.length === 0) {
      memberRes = await query(`
        SELECT m.id, m.house_number, m.household_name, m.monthly_due, m.active
        FROM members m
        WHERE m.email = (SELECT email FROM users WHERE id = $1)
      `, [userId]);
    }

    // Fallback: match by household_name
    if (memberRes.rows.length === 0) {
      memberRes = await query(`
        SELECT m.id, m.house_number, m.household_name, m.monthly_due, m.active
        FROM members m
        WHERE m.household_name = (SELECT name FROM users WHERE id = $1)
      `, [userId]);
    }

    if (memberRes.rows.length === 0) {
      return res.status(404).json({ error: 'No member record found for this user' });
    }

    const member = memberRes.rows[0];
    const memberId = member.id;

    console.log(`My Account: User ${userId} linked to Member ${memberId} (${member.household_name})`);

    // ✅ STEP 2: Build date filter
    let yearFilter = '';
    let monthFilter = '';
    let params = [memberId];

    switch (viewing) {
  case 'all_time':
    break;
  case 'this_month':
    yearFilter = 'AND c.period_year = $2';
    monthFilter = 'AND c.period_month = $3';
    params.push(currentYear, currentMonth);
    break;
  case 'last_month': {
    const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    yearFilter = 'AND c.period_year = $2';
    monthFilter = 'AND c.period_month = $3';
    params.push(lastMonthYear, lastMonth);
    break;
  }
  case 'last_3_months': {
    // ✅ FIX: Include current month + 2 previous months = 3 months total
    const startMonth = currentMonth - 2;
    if (startMonth <= 0) {
      // Spans across year boundary
      yearFilter = 'AND ((c.period_year = $2 AND c.period_month >= $3) OR c.period_year = $4)';
      params.push(currentYear, startMonth + 12, currentYear - 1);
    } else {
      yearFilter = 'AND c.period_year = $2';
      monthFilter = 'AND c.period_month >= $3';
      params.push(currentYear, startMonth);
    }
    break;
  }
  case 'last_6_months': {
    // ✅ FIX: Include current month + 5 previous months = 6 months total
    const startMonth = currentMonth - 5;
    if (startMonth <= 0) {
      // Spans across year boundary
      yearFilter = 'AND ((c.period_year = $2 AND c.period_month >= $3) OR c.period_year = $4)';
      params.push(currentYear, startMonth + 12, currentYear - 1);
    } else {
      yearFilter = 'AND c.period_year = $2';
      monthFilter = 'AND c.period_month >= $3';
      params.push(currentYear, startMonth);
    }
    break;
  }
  case 'year_to_date':
    yearFilter = 'AND c.period_year = $2';
    params.push(currentYear);
    break;
  default:
    yearFilter = 'AND c.period_year = $2';
    monthFilter = 'AND c.period_month = $3';
    params.push(currentYear, currentMonth);
}

    let typeFilter = '';
    if (scoped) {
      params.push(type);
      typeFilter = ` AND c.type = $${params.length}::contribution_type`;
    }

    // ✅ STEP 3: Summary
    const summaryRes = await query(`
      SELECT 
        COALESCE(SUM(c.amount_due), 0) AS total_due,
        COALESCE(SUM(c.amount_paid), 0) AS total_paid,
        COALESCE(SUM(c.amount_due), 0) - COALESCE(SUM(c.amount_paid), 0) AS outstanding
      FROM contributions c
      WHERE c.member_id = $1 ${yearFilter} ${monthFilter}${typeFilter}
    `, params);

    const summary = {
      total_due: parseFloat(summaryRes.rows[0].total_due) || 0,
      total_paid: parseFloat(summaryRes.rows[0].total_paid) || 0,
      outstanding: parseFloat(summaryRes.rows[0].outstanding) || 0
    };

    // ✅ STEP 4: Payment History (Last 6 Months) - includes current month
    const historyRes = await query(`
      WITH RECURSIVE months AS (
        SELECT date_trunc('month', CURRENT_DATE) - INTERVAL '5 months' AS month_start
        UNION ALL
        SELECT month_start + INTERVAL '1 month' 
        FROM months 
        WHERE month_start < date_trunc('month', CURRENT_DATE)
      )
      SELECT 
        TO_CHAR(m.month_start, 'YYYY-MM') AS month,
        TO_CHAR(m.month_start, 'Mon') AS short_month,
        COALESCE(SUM(c.amount_paid), 0) AS amount_paid,
        COALESCE(SUM(c.amount_due), 0) AS amount_due
      FROM months m
      LEFT JOIN contributions c 
        ON c.member_id = $1
        AND EXTRACT(YEAR FROM m.month_start)::int = c.period_year
        AND EXTRACT(MONTH FROM m.month_start)::int = c.period_month
        ${scoped ? 'AND c.type = $2::contribution_type' : ''}
      GROUP BY m.month_start
      ORDER BY m.month_start ASC
    `, scoped ? [memberId, type] : [memberId]);

    const payment_history = historyRes.rows.map(r => ({
      month: r.month,
      short_month: r.short_month,
      amount_paid: parseFloat(r.amount_paid) || 0,
      amount_due: parseFloat(r.amount_due) || 0
    }));

    // ✅ STEP 5: Contributions by Type
    const typeRes = await query(`
      SELECT 
        COALESCE(c.type, 'monthly') AS type,
        SUM(c.amount_paid) AS total
      FROM contributions c
      WHERE c.member_id = $1 ${yearFilter} ${monthFilter}${typeFilter}
      GROUP BY c.type
      ORDER BY total DESC
    `, params);

    const contributions_by_type = typeRes.rows.map(r => ({
      type: r.type,
      total: parseFloat(r.total) || 0
    }));

    // ✅ STEP 6: Recent Payments
    let paymentsRes;
    try {
      paymentsRes = await query(`
        SELECT 
          p.id,
          p.amount,
          p.paid_at AS payment_date,
          p.method,
          p.reference,
          c.period_year,
          c.period_month,
          c.type,
          TO_CHAR(make_date(c.period_year, c.period_month, 1), 'Month YYYY') AS period
        FROM payments p
        JOIN contributions c ON p.contribution_id = c.id
        WHERE c.member_id = $1 ${scoped ? 'AND c.type = $2::contribution_type' : ''}
        ORDER BY p.paid_at DESC
        LIMIT 10
      `, scoped ? [memberId, type] : [memberId]);
    } catch (e) {
      // If payments table structure is different, return empty
      console.warn('Payments query failed:', e.message);
      paymentsRes = { rows: [] };
    }

    const recent_payments = paymentsRes.rows.map(r => ({
      id: r.id,
      amount: parseFloat(r.amount) || 0,
      payment_date: r.payment_date,
      status: 'completed',
      method: r.method,
      reference: r.reference,
      period: r.period,
      type: r.type || 'monthly'
    }));

    // ✅ STEP 7: the member's own activations (scoped tabs only)
    let occasions = [];
    if (scoped) {
      const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      const occRes = await query(`
        SELECT c.id, c.period_year, c.period_month, c.amount_due, c.amount_paid, c.note,
               (SELECT string_agg(p.reference, ', ' ORDER BY p.id)
                  FROM payments p WHERE p.contribution_id = c.id) AS references
        FROM contributions c
        WHERE c.member_id = $1 AND c.type = $2
        ORDER BY c.period_year ASC, c.period_month ASC
      `, [memberId, type]);
     occasions = occRes.rows.map(r => {
  const due = parseFloat(r.amount_due) || 0;
  const paid = parseFloat(r.amount_paid) || 0;
  return {
    id: r.id, // ✅ CRITICAL FIX: Added the database ID here
    period: `${r.period_year}-${String(r.period_month).padStart(2, '0')}`,
    label: `${MONTHS[r.period_month - 1]} ${r.period_year}`,
    short: `${MONTHS[r.period_month - 1].slice(0, 3)} ${String(r.period_year).slice(2)}`,
    due,
    paid,
    outstanding: due - paid,
    status: due > 0 && paid >= due ? 'paid' : paid > 0 ? 'partial' : 'pending',
    references: r.references || r.note || null
  };
});

    res.json({
      ...(scoped ? { scope: { type }, occasions } : {}),
      member: {
        id: member.id,
        house_number: member.house_number,
        household_name: member.household_name,
        monthly_due: parseFloat(member.monthly_due) || 0,
        active: member.active
      },
      summary,
      payment_history,
      contributions_by_type,
      recent_payments
    });

  } catch (err) {
    console.error('My Account error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;