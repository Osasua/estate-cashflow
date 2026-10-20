const express = require('express');
const { query } = require('../db');
const { authenticate } = require('../auth');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // 1. KPIs - Simple, isolated queries (no JOINs)
    const [balanceRes, monthInRes, monthDueRes, monthExpenseRes, pendingRes] = await Promise.all([
      query(`SELECT COALESCE(SUM(amount_paid), 0) - COALESCE((SELECT SUM(amount) FROM expenses), 0) AS balance FROM contributions`),
      query(`SELECT COALESCE(SUM(amount_paid), 0) AS total FROM contributions WHERE period_year = $1 AND period_month = $2`, [currentYear, currentMonth]),
      query(`SELECT COALESCE(SUM(monthly_due), 0) AS total FROM members WHERE active = true`),
      query(`SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE EXTRACT(YEAR FROM spent_on) = $1 AND EXTRACT(MONTH FROM spent_on) = $2`, [currentYear, currentMonth]),
      query(`SELECT COUNT(DISTINCT member_id)::int AS count FROM contributions WHERE period_year = $1 AND period_month = $2 AND type = 'monthly' AND amount_paid < amount_due`, [currentYear, currentMonth])
    ]);

    const kpis = {
      balance: parseFloat(balanceRes.rows[0].balance) || 0,
      month_in: parseFloat(monthInRes.rows[0].total) || 0,
      month_due: parseFloat(monthDueRes.rows[0].total) || 0,
      month_expense: parseFloat(monthExpenseRes.rows[0].total) || 0,
      pending_count: parseInt(pendingRes.rows[0].count) || 0
    };

    // 2. Trend - Last 6 months (FIXED: Separate aggregations to avoid Cartesian product)
    const trendRes = await query(`
      WITH RECURSIVE months AS (
        SELECT date_trunc('month', CURRENT_DATE) - INTERVAL '5 months' AS month_start
        UNION ALL
        SELECT month_start + INTERVAL '1 month' FROM months WHERE month_start < date_trunc('month', CURRENT_DATE)
      ),
      contributions_agg AS (
        SELECT 
          EXTRACT(YEAR FROM make_date(period_year, period_month, 1)) AS yr,
          EXTRACT(MONTH FROM make_date(period_year, period_month, 1)) AS mo,
          SUM(amount_paid) AS total_paid
        FROM contributions
        WHERE type = 'monthly'
        GROUP BY period_year, period_month
      ),
      expenses_agg AS (
        SELECT 
          EXTRACT(YEAR FROM spent_on) AS yr,
          EXTRACT(MONTH FROM spent_on) AS mo,
          SUM(amount) AS total_spent
        FROM expenses
        GROUP BY EXTRACT(YEAR FROM spent_on), EXTRACT(MONTH FROM spent_on)
      )
      SELECT 
        TO_CHAR(m.month_start, 'YYYY-MM') AS month,
        TO_CHAR(m.month_start, 'Mon') AS short_month,
        TO_CHAR(m.month_start, 'Month') AS full_month,
        EXTRACT(MONTH FROM m.month_start)::int AS month_num,
        EXTRACT(YEAR FROM m.month_start)::int AS year_num,
        COALESCE(c.total_paid, 0) AS income,
        COALESCE(e.total_spent, 0) AS expense
      FROM months m
      LEFT JOIN contributions_agg c 
        ON EXTRACT(YEAR FROM m.month_start) = c.yr 
        AND EXTRACT(MONTH FROM m.month_start) = c.mo
      LEFT JOIN expenses_agg e 
        ON EXTRACT(YEAR FROM m.month_start) = e.yr 
        AND EXTRACT(MONTH FROM m.month_start) = e.mo
      ORDER BY m.month_start ASC
    `);

    const trend = trendRes.rows.map(r => ({
      month: r.month,
      short_month: r.short_month,
      full_month: r.full_month.trim(),
      year_num: parseInt(r.year_num),
      month_num: parseInt(r.month_num),
      income: parseFloat(r.income) || 0,
      expense: parseFloat(r.expense) || 0,
      net: (parseFloat(r.income) || 0) - (parseFloat(r.expense) || 0)
    }));

    // 3. Daily Expenses - Last 14 days
    const dailyRes = await query(`
      SELECT TO_CHAR(spent_on, 'DD Mon') AS day, COALESCE(SUM(amount), 0) AS total
      FROM expenses WHERE spent_on >= CURRENT_DATE - INTERVAL '13 days'
      GROUP BY spent_on ORDER BY spent_on ASC
    `);
    const daily = dailyRes.rows.map(r => ({ day: r.day, total: parseFloat(r.total) || 0 }));

    // 4. Weekly Expenses - Last 8 weeks (FIXED: Generate all weeks, even empty ones)
    const weeklyRes = await query(`
      WITH RECURSIVE weeks AS (
        SELECT date_trunc('week', CURRENT_DATE) - INTERVAL '7 weeks' AS week_start
        UNION ALL
        SELECT week_start + INTERVAL '1 week' FROM weeks WHERE week_start < date_trunc('week', CURRENT_DATE)
      )
      SELECT 
        'Wk ' || EXTRACT(WEEK FROM w.week_start)::text AS week,
        COALESCE(SUM(e.amount), 0) AS total
      FROM weeks w
      LEFT JOIN expenses e ON DATE_TRUNC('week', e.spent_on) = w.week_start
      GROUP BY w.week_start
      ORDER BY w.week_start ASC
    `);
    const weekly = weeklyRes.rows.map(r => ({ week: r.week, total: parseFloat(r.total) || 0 }));

    // 5. Categories - This month
    const categoriesRes = await query(`
      SELECT COALESCE(c.name, 'Uncategorized') AS name, COALESCE(SUM(e.amount), 0) AS total
      FROM expenses e LEFT JOIN categories c ON e.category_id = c.id
      WHERE EXTRACT(YEAR FROM e.spent_on) = $1 AND EXTRACT(MONTH FROM e.spent_on) = $2
      GROUP BY c.name ORDER BY total DESC
    `, [currentYear, currentMonth]);
    const categories = categoriesRes.rows.map(r => ({ name: r.name, total: parseFloat(r.total) || 0 }));

    res.json({ kpis, trend, daily, weekly, categories });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;