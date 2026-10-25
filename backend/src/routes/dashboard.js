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

    // 1. Opening balance
    let openingBalance = 0;
    try {
      const balRes = await query(`SELECT value FROM settings WHERE key = 'opening_balance'`);
      openingBalance = parseFloat(balRes.rows[0]?.value) || 0;
    } catch (e) {}

    // 2. Monthly contributions for current month
    const monthlyRes = await query(`
      SELECT COALESCE(SUM(amount_due), 0) AS total_due, COALESCE(SUM(amount_paid), 0) AS total_paid
      FROM contributions WHERE period_year = $1 AND period_month = $2 AND type = 'monthly'
    `, [currentYear, currentMonth]);
    const monthlyDue = parseFloat(monthlyRes.rows[0].total_due) || 0;
    const monthlyPaid = parseFloat(monthlyRes.rows[0].total_paid) || 0;

    // 3. Occasional contributions for current month
    const occasionalRes = await query(`
      SELECT COALESCE(SUM(amount_due), 0) AS total_due, COALESCE(SUM(amount_paid), 0) AS total_paid
      FROM contributions WHERE period_year = $1 AND period_month = $2 AND type != 'monthly'
    `, [currentYear, currentMonth]);
    const occasionalDue = parseFloat(occasionalRes.rows[0].total_due) || 0;
    const occasionalPaid = parseFloat(occasionalRes.rows[0].total_paid) || 0;

    // 4. Total expenses for current month - USE expense_date (ORIGINAL)
    let totalExpenses = 0;
    try {
      const expRes = await query(`
        SELECT COALESCE(SUM(amount), 0) AS total 
        FROM expenses 
        WHERE EXTRACT(YEAR FROM expense_date) = $1 
        AND EXTRACT(MONTH FROM expense_date) = $2
      `, [currentYear, currentMonth]);
      totalExpenses = parseFloat(expRes.rows[0].total) || 0;
    } catch (e) {}

    // 5. Cash balance = opening + all collected (monthly + occasional) - expenses
    const cashBalance = openingBalance + monthlyPaid + occasionalPaid - totalExpenses;

    // 6. Households owing (monthly only)
    const owingRes = await query(`
      SELECT COUNT(DISTINCT member_id) AS count 
      FROM contributions 
      WHERE period_year = $1 AND period_month = $2 AND type = 'monthly' AND amount_due > amount_paid
    `, [currentYear, currentMonth]);
    const householdsOwing = parseInt(owingRes.rows[0].count) || 0;

    // 7. Cash Flow Trend - LAST 6 MONTHS with monthly/occasional split
    // Get contributions for last 6 months
    const trendContribRes = await query(`
      SELECT period_year, period_month, type, COALESCE(SUM(amount_paid), 0) AS contributions
      FROM contributions
      WHERE (period_year = $1 AND period_month <= $2)
        OR period_year < $1
      GROUP BY period_year, period_month, type
      ORDER BY period_year DESC, period_month DESC
      LIMIT 100
    `, [currentYear, currentMonth]);

    // Get expenses for last 6 months
    const trendExpRes = await query(`
      SELECT EXTRACT(YEAR FROM expense_date) as year, EXTRACT(MONTH FROM expense_date) as month, COALESCE(SUM(amount), 0) as total
      FROM expenses
      WHERE (EXTRACT(YEAR FROM expense_date) = $1 AND EXTRACT(MONTH FROM expense_date) <= $2)
        OR EXTRACT(YEAR FROM expense_date) < $1
      GROUP BY EXTRACT(YEAR FROM expense_date), EXTRACT(MONTH FROM expense_date)
      ORDER BY year DESC, month DESC
      LIMIT 100
    `, [currentYear, currentMonth]);

    // Build trend map
    const trendMap = {};
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    trendContribRes.rows.forEach(r => {
      const key = `${r.period_year}-${String(r.period_month).padStart(2, '0')}`;
      if (!trendMap[key]) {
        trendMap[key] = { 
          month: key, 
          short_month: monthNames[r.period_month - 1],
          income: 0, expense: 0, monthly: 0, occasional: 0
        };
      }
      if (r.type === 'monthly') {
        trendMap[key].monthly += parseFloat(r.contributions) || 0;
      } else {
        trendMap[key].occasional += parseFloat(r.contributions) || 0;
      }
      trendMap[key].income = trendMap[key].monthly + trendMap[key].occasional;
    });

    trendExpRes.rows.forEach(r => {
      const key = `${r.year}-${String(parseInt(r.month)).padStart(2, '0')}`;
      if (trendMap[key]) {
        trendMap[key].expense = parseFloat(r.total) || 0;
      } else {
        trendMap[key] = {
          month: key,
          short_month: monthNames[parseInt(r.month) - 1],
          income: 0, expense: parseFloat(r.total) || 0, monthly: 0, occasional: 0
        };
      }
    });

    // Sort and take last 6 months
    const trend = Object.values(trendMap)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6)
      .map(t => ({ ...t, net: t.income - t.expense }));

    // 8. Daily expenses - LAST 14 DAYS (USE expense_date)
    let daily = [];
    try {
      const dailyRes = await query(`
        SELECT TO_CHAR(expense_date, 'YYYY-MM-DD') as day, COALESCE(SUM(amount), 0) as total 
        FROM expenses 
        WHERE expense_date >= CURRENT_DATE - INTERVAL '14 days' 
        GROUP BY expense_date 
        ORDER BY expense_date
      `);
      daily = dailyRes.rows.map(r => ({ day: r.day, total: parseFloat(r.total) || 0 }));
    } catch (e) {}

    // 9. Weekly expenses - LAST 8 WEEKS (USE expense_date)
    let weekly = [];
    try {
      const weeklyRes = await query(`
        SELECT DATE_TRUNC('week', expense_date)::date as week, COALESCE(SUM(amount), 0) as total 
        FROM expenses 
        WHERE expense_date >= CURRENT_DATE - INTERVAL '8 weeks' 
        GROUP BY DATE_TRUNC('week', expense_date) 
        ORDER BY DATE_TRUNC('week', expense_date)
      `);
      weekly = weeklyRes.rows.map(r => ({ week: r.week, total: parseFloat(r.total) || 0 }));
    } catch (e) {}

    // 10. Spending by Category - CURRENT MONTH (USE expense_date)
    let categories = [];
    try {
      const catRes = await query(`
        SELECT c.name, COALESCE(SUM(e.amount), 0) AS total 
        FROM expenses e 
        LEFT JOIN categories c ON e.category_id = c.id 
        WHERE EXTRACT(YEAR FROM e.expense_date) = $1 
        AND EXTRACT(MONTH FROM e.expense_date) = $2 
        GROUP BY c.name 
        ORDER BY total DESC
      `, [currentYear, currentMonth]);
      categories = catRes.rows.map(r => ({ name: r.name || 'Uncategorized', total: parseFloat(r.total) || 0 }));
    } catch (e) {}

    res.json({
      kpis: {
        balance: cashBalance,
        month_in: monthlyPaid,
        month_due: monthlyDue,
        month_expense: totalExpenses,
        pending_count: householdsOwing,
        occasional_in: occasionalPaid,
        occasional_due: occasionalDue
      },
      trend,
      daily,
      weekly,
      categories
    });

  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;