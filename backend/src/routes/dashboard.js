const express = require('express');
const { query } = require('../db');
const { authenticate } = require('../auth');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const [kpis, daily, weekly, categories, trend] = await Promise.all([
      query(`
        SELECT
          ((SELECT COALESCE(SUM(amount), 0) FROM payments)
           - (SELECT COALESCE(SUM(amount), 0) FROM expenses))::float8 AS balance,
          
          -- ✅ FIX: Strictly sum amount_paid for the CURRENT calendar month from contributions
          (SELECT COALESCE(SUM(amount_paid), 0) FROM contributions
            WHERE period_year = EXTRACT(YEAR FROM now())::int
              AND period_month = EXTRACT(MONTH FROM now())::int)::float8 AS month_in,
              
          (SELECT COALESCE(SUM(amount), 0) FROM expenses
            WHERE date_trunc('month', spent_on) = date_trunc('month', now()))::float8 AS month_expense,
          
          (SELECT COALESCE(SUM(amount_due), 0) FROM contributions
            WHERE (type = 'monthly' OR type IS NULL)
              AND period_year = EXTRACT(YEAR FROM now())::int
              AND period_month = EXTRACT(MONTH FROM now())::int)::float8 AS month_due,
          
          (SELECT COUNT(DISTINCT c.member_id)::int FROM contributions c
            WHERE (c.type = 'monthly' OR c.type IS NULL)
              AND c.period_year = EXTRACT(YEAR FROM now())::int
              AND c.period_month = EXTRACT(MONTH FROM now())::int
              AND c.amount_paid < c.amount_due) AS pending_count
      `),
      query(`
        SELECT to_char(spent_on, 'DD Mon') AS day, COALESCE(SUM(amount), 0)::float8 AS total
          FROM expenses
         WHERE spent_on >= CURRENT_DATE - INTERVAL '13 days'
         GROUP BY spent_on ORDER BY spent_on
      `),
      query(`
        SELECT 'Wk ' || EXTRACT(WEEK FROM spent_on) AS week, COALESCE(SUM(amount), 0)::float8 AS total
          FROM expenses
         WHERE spent_on >= date_trunc('week', CURRENT_DATE) - INTERVAL '7 weeks'
         GROUP BY EXTRACT(WEEK FROM spent_on) ORDER BY EXTRACT(WEEK FROM spent_on)
      `),
      query(`
        SELECT COALESCE(c.name, 'Uncategorised') AS name, COALESCE(SUM(e.amount), 0)::float8 AS total
          FROM expenses e LEFT JOIN categories c ON c.id = e.category_id
         WHERE date_trunc('month', e.spent_on) = date_trunc('month', CURRENT_DATE)
         GROUP BY c.name ORDER BY total DESC
      `),
      query(`
        SELECT to_char(months.m, 'YYYY-MM') AS month,
               to_char(months.m, 'Mon') AS short_month,
               COALESCE(p.total, 0)::float8 AS income, 
               COALESCE(e.total, 0)::float8 AS expense
          FROM generate_series(date_trunc('month', now()) - INTERVAL '5 months',
                               date_trunc('month', now()), '1 month') AS months(m)
          LEFT JOIN (SELECT date_trunc('month', paid_at) m, SUM(amount)::float8 AS total
                       FROM payments GROUP BY 1) p ON p.m = months.m
          LEFT JOIN (SELECT date_trunc('month', spent_on) m, SUM(amount)::float8 AS total
                       FROM expenses GROUP BY 1) e ON e.m = months.m
         ORDER BY months.m
      `),
    ]);
    
    // ✅ SAFETY NET: Force everything to be a strict JavaScript Number to prevent frontend NaN/blank issues
    const safeKpis = {
      balance: Number(kpis.rows[0].balance) || 0,
      month_in: Number(kpis.rows[0].month_in) || 0,
      month_expense: Number(kpis.rows[0].month_expense) || 0,
      month_due: Number(kpis.rows[0].month_due) || 0,
      pending_count: Number(kpis.rows[0].pending_count) || 0,
    };

    const safeTrend = trend.rows.map(r => ({
      month: String(r.month),
      short_month: String(r.short_month),
      income: Number(r.income) || 0,
      expense: Number(r.expense) || 0
    }));

    const safeDaily = daily.rows.map(r => ({
      day: String(r.day),
      total: Number(r.total) || 0
    }));

    const safeWeekly = weekly.rows.map(r => ({
      week: String(r.week),
      total: Number(r.total) || 0
    }));

    const safeCategories = categories.rows.map(r => ({
      name: String(r.name),
      total: Number(r.total) || 0
    }));

    res.json({
      kpis: safeKpis,
      daily: safeDaily,
      weekly: safeWeekly,
      categories: safeCategories,
      trend: safeTrend,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;