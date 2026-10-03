const express = require('express');
const { query } = require('../db');
const { authenticate } = require('../auth');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const [kpis, daily, weekly, categories, trend] = await Promise.all([
    query(`
      SELECT
        ((SELECT COALESCE(SUM(amount), 0) FROM payments)
         - (SELECT COALESCE(SUM(amount), 0) FROM expenses))::float8 AS balance,
        (SELECT COALESCE(SUM(amount), 0) FROM payments
          WHERE date_trunc('month', paid_at) = date_trunc('month', now()))::float8 AS month_in,
        (SELECT COALESCE(SUM(amount), 0) FROM expenses
          WHERE date_trunc('month', spent_on) = date_trunc('month', now()))::float8 AS month_expense,
        
        -- ✅ FIX: Only sum up MONTHLY dues for the "expected" amount
        (SELECT COALESCE(SUM(amount_due), 0) FROM contributions
          WHERE (type = 'monthly' OR type IS NULL)
            AND period_year = EXTRACT(YEAR FROM now())::int
            AND period_month = EXTRACT(MONTH FROM now())::int)::float8 AS month_due,
        
        -- ✅ FIX: Count DISTINCT households (member_id) owing on MONTHLY dues only
        (SELECT COUNT(DISTINCT c.member_id)::int FROM contributions c
          WHERE (c.type = 'monthly' OR c.type IS NULL)
            AND c.period_year = EXTRACT(YEAR FROM now())::int
            AND c.period_month = EXTRACT(MONTH FROM now())::int
            AND c.amount_paid < c.amount_due) AS pending_count
    `),
    query(`
      SELECT spent_on::text AS day, SUM(amount)::float8 AS total
        FROM expenses
       WHERE spent_on >= CURRENT_DATE - INTERVAL '13 days'
       GROUP BY spent_on ORDER BY spent_on
    `),
    query(`
      SELECT date_trunc('week', spent_on)::date::text AS week, SUM(amount)::float8 AS total
        FROM expenses
       WHERE spent_on >= date_trunc('week', CURRENT_DATE) - INTERVAL '7 weeks'
       GROUP BY 1 ORDER BY 1
    `),
    query(`
      SELECT COALESCE(c.name, 'Uncategorised') AS name, SUM(e.amount)::float8 AS total
        FROM expenses e LEFT JOIN categories c ON c.id = e.category_id
       WHERE date_trunc('month', e.spent_on) = date_trunc('month', CURRENT_DATE)
       GROUP BY 1 ORDER BY 2 DESC
    `),
    query(`
      SELECT to_char(months.m, 'YYYY-MM') AS month,
             COALESCE(p.total, 0) AS income, COALESCE(e.total, 0) AS expense
        FROM generate_series(date_trunc('month', now()) - INTERVAL '5 months',
                             date_trunc('month', now()), '1 month') AS months(m)
        LEFT JOIN (SELECT date_trunc('month', paid_at) m, SUM(amount)::float8 total
                     FROM payments GROUP BY 1) p ON p.m = months.m
        LEFT JOIN (SELECT date_trunc('month', spent_on) m, SUM(amount)::float8 total
                     FROM expenses GROUP BY 1) e ON e.m = months.m
       ORDER BY months.m
    `),
  ]);
  
  res.json({
    kpis: kpis.rows[0],
    daily: daily.rows,
    weekly: weekly.rows,
    categories: categories.rows,
    trend: trend.rows,
  });
});

module.exports = router;