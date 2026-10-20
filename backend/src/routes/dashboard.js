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

    const [kpisQuery, trendQuery, dailyQuery, weeklyQuery, categoriesQuery] = await Promise.all([
      query(`
        SELECT 
          COALESCE((SELECT SUM(amount_paid) FROM contributions), 0) - 
          COALESCE((SELECT SUM(amount) FROM expenses), 0) AS balance,
          COALESCE((SELECT SUM(amount_paid) FROM contributions 
            WHERE period_year = $1 AND period_month = $2), 0) AS month_in,
          COALESCE((SELECT SUM(monthly_due) FROM members WHERE active = true), 0) AS month_due,
          COALESCE((SELECT SUM(amount) FROM expenses 
            WHERE EXTRACT(YEAR FROM spent_on) = $1 AND EXTRACT(MONTH FROM spent_on) = $2), 0) AS month_expense,
          COALESCE((SELECT COUNT(DISTINCT member_id) FROM contributions
            WHERE period_year = $1 AND period_month = $2 AND type = 'monthly' AND amount_paid < amount_due), 0)::int AS pending_count
      `, [currentYear, currentMonth]),
      
      query(`
        WITH RECURSIVE months AS (
          SELECT date_trunc('month', CURRENT_DATE) - INTERVAL '5 months' AS month_start
          UNION ALL
          SELECT month_start + INTERVAL '1 month' FROM months WHERE month_start < date_trunc('month', CURRENT_DATE)
        )
        SELECT 
          TO_CHAR(m.month_start, 'YYYY-MM') AS month,
          TO_CHAR(m.month_start, 'Mon') AS short_month,
          TO_CHAR(m.month_start, 'Month') AS full_month,
          EXTRACT(MONTH FROM m.month_start)::int AS month_num,
          EXTRACT(YEAR FROM m.month_start)::int AS year_num,
          COALESCE(SUM(c.amount_paid), 0) AS income,
          COALESCE(SUM(e.amount), 0) AS expense
        FROM months m
        LEFT JOIN contributions c 
          ON EXTRACT(YEAR FROM m.month_start) = c.period_year 
          AND EXTRACT(MONTH FROM m.month_start) = c.period_month
          AND c.type = 'monthly'
        LEFT JOIN expenses e 
          ON DATE_TRUNC('month', e.spent_on) = m.month_start
        GROUP BY m.month_start
        ORDER BY m.month_start ASC
      `),
      
      query(`
        SELECT TO_CHAR(spent_on, 'DD Mon') AS day, COALESCE(SUM(amount), 0) AS total
        FROM expenses WHERE spent_on >= CURRENT_DATE - INTERVAL '13 days'
        GROUP BY spent_on ORDER BY spent_on ASC
      `),
      
      query(`
        SELECT 'Wk ' || EXTRACT(WEEK FROM spent_on)::text AS week, COALESCE(SUM(amount), 0) AS total
        FROM expenses WHERE spent_on >= CURRENT_DATE - INTERVAL '7 weeks'
        GROUP BY EXTRACT(WEEK FROM spent_on) ORDER BY EXTRACT(WEEK FROM spent_on) ASC
      `),
      
      query(`
        SELECT COALESCE(c.name, 'Uncategorized') AS name, COALESCE(SUM(e.amount), 0) AS total
        FROM expenses e LEFT JOIN categories c ON e.category_id = c.id
        WHERE EXTRACT(YEAR FROM e.spent_on) = $1 AND EXTRACT(MONTH FROM e.spent_on) = $2
        GROUP BY c.name ORDER BY total DESC
      `, [currentYear, currentMonth])
    ]);

    const kpis = kpisQuery.rows[0];
    const trend = trendQuery.rows.map(r => ({
      month: r.month,
      short_month: r.short_month,
      full_month: r.full_month.trim(),
      year_num: parseInt(r.year_num),
      month_num: parseInt(r.month_num),
      income: parseFloat(r.income) || 0,
      expense: parseFloat(r.expense) || 0,
      net: (parseFloat(r.income) || 0) - (parseFloat(r.expense) || 0)
    }));

    const daily = dailyQuery.rows.map(r => ({ day: r.day, total: parseFloat(r.total) || 0 }));
    const weekly = weeklyQuery.rows.map(r => ({ week: r.week, total: parseFloat(r.total) || 0 }));
    const categories = categoriesQuery.rows.map(r => ({ name: r.name, total: parseFloat(r.total) || 0 }));

    res.json({
      kpis: {
        balance: parseFloat(kpis.balance) || 0,
        month_in: parseFloat(kpis.month_in) || 0,
        month_due: parseFloat(kpis.month_due) || 0,
        month_expense: parseFloat(kpis.month_expense) || 0,
        pending_count: parseInt(kpis.pending_count) || 0
      },
      trend, daily, weekly, categories
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;