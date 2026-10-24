const express = require('express');
const { query } = require('../db');
const { authenticate } = require('../auth');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const viewing = req.query.viewing || 'this_month';

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Build date filter based on viewing parameter
    let yearFilter = '';
    let monthFilter = '';
    let params = [userId];

    switch (viewing) {
      case 'this_month':
        yearFilter = 'AND c.period_year = $2';
        monthFilter = 'AND c.period_month = $3';
        params.push(currentYear, currentMonth);
        break;
      case 'last_month':
        const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
        yearFilter = 'AND c.period_year = $2';
        monthFilter = 'AND c.period_month = $3';
        params.push(lastMonthYear, lastMonth);
        break;
      case 'last_3_months':
        const threeMonthsAgo = currentMonth - 3;
        if (threeMonthsAgo <= 0) {
          yearFilter = 'AND ((c.period_year = $2 AND c.period_month >= $3) OR c.period_year = $4)';
          params.push(currentYear, threeMonthsAgo + 12, currentYear - 1);
        } else {
          yearFilter = 'AND c.period_year = $2';
          monthFilter = 'AND c.period_month >= $3';
          params.push(currentYear, threeMonthsAgo);
        }
        break;
      case 'last_6_months':
        const sixMonthsAgo = currentMonth - 6;
        if (sixMonthsAgo <= 0) {
          yearFilter = 'AND ((c.period_year = $2 AND c.period_month >= $3) OR c.period_year = $4)';
          params.push(currentYear, sixMonthsAgo + 12, currentYear - 1);
        } else {
          yearFilter = 'AND c.period_year = $2';
          monthFilter = 'AND c.period_month >= $3';
          params.push(currentYear, sixMonthsAgo);
        }
        break;
      case 'year_to_date':
        yearFilter = 'AND c.period_year = $2';
        params.push(currentYear);
        break;
      default:
        yearFilter = 'AND c.period_year = $2';
        monthFilter = 'AND c.period_month = $3';
        params.push(currentYear, currentMonth);
    }

    // 1. Get member info
    const memberRes = await query(`
      SELECT id, house_number, household_name, monthly_due, active
      FROM members WHERE id = $1
    `, [userId]);

    if (memberRes.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const member = memberRes.rows[0];

    // 2. Summary
    const summaryRes = await query(`
      SELECT 
        COALESCE(SUM(c.amount_due), 0) AS total_due,
        COALESCE(SUM(c.amount_paid), 0) AS total_paid,
        COALESCE(SUM(c.amount_due), 0) - COALESCE(SUM(c.amount_paid), 0) AS outstanding
      FROM contributions c
      WHERE c.member_id = $1 ${yearFilter} ${monthFilter}
    `, params);

    const summary = {
      total_due: parseFloat(summaryRes.rows[0].total_due) || 0,
      total_paid: parseFloat(summaryRes.rows[0].total_paid) || 0,
      outstanding: parseFloat(summaryRes.rows[0].outstanding) || 0
    };

    // 3. Payment History (Last 6 Months)
    const historyRes = await query(`
      WITH RECURSIVE months AS (
        SELECT date_trunc('month', CURRENT_DATE) - INTERVAL '5 months' AS month_start
        UNION ALL
        SELECT month_start + INTERVAL '1 month' FROM months WHERE month_start < date_trunc('month', CURRENT_DATE)
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
      GROUP BY m.month_start
      ORDER BY m.month_start ASC
    `, [userId]);

    const payment_history = historyRes.rows.map(r => ({
      month: r.month,
      short_month: r.short_month,
      amount_paid: parseFloat(r.amount_paid) || 0,
      amount_due: parseFloat(r.amount_due) || 0
    }));

    // 4. Contributions by Type
    const typeRes = await query(`
      SELECT 
        COALESCE(c.type, 'monthly') AS type,
        SUM(c.amount_paid) AS total
      FROM contributions c
      WHERE c.member_id = $1 ${yearFilter} ${monthFilter}
      GROUP BY c.type
      ORDER BY total DESC
    `, params);

    const contributions_by_type = typeRes.rows.map(r => ({
      type: r.type,
      total: parseFloat(r.total) || 0
    }));

    // 5. Recent Payments - FIXED: removed p.status (column doesn't exist)
    const paymentsRes = await query(`
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
      WHERE c.member_id = $1
      ORDER BY p.paid_at DESC
      LIMIT 10
    `, [userId]);

    const recent_payments = paymentsRes.rows.map(r => ({
      id: r.id,
      amount: parseFloat(r.amount) || 0,
      payment_date: r.payment_date,
      status: 'completed', // ✅ Hardcoded since column doesn't exist
      method: r.method,
      reference: r.reference,
      period: r.period,
      type: r.type || 'monthly'
    }));

    res.json({
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