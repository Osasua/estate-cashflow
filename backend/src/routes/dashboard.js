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

    // 1. Get opening balance (from settings or default)
    let openingBalance = 0;
    try {
      const balRes = await query(`SELECT value FROM settings WHERE key = 'opening_balance'`);
      openingBalance = parseFloat(balRes.rows[0]?.value) || 0;
    } catch (e) {
      openingBalance = 0;
    }

    // 2. Get ALL contributions for current month (all types)
    const contribRes = await query(`
      SELECT 
        COALESCE(SUM(amount_due), 0) AS total_due,
        COALESCE(SUM(amount_paid), 0) AS total_paid
      FROM contributions
      WHERE period_year = $1 AND period_month = $2
    `, [currentYear, currentMonth]);

    const totalDue = parseFloat(contribRes.rows[0].total_due) || 0;
    const totalPaid = parseFloat(contribRes.rows[0].total_paid) || 0;

    // 3. Get total expenses for current month
    let totalExpenses = 0;
    try {
      const expRes = await query(`
        SELECT COALESCE(SUM(amount), 0) AS total 
        FROM expenses 
        WHERE EXTRACT(YEAR FROM expense_date) = $1 
        AND EXTRACT(MONTH FROM expense_date) = $2
      `, [currentYear, currentMonth]);
      totalExpenses = parseFloat(expRes.rows[0].total) || 0;
    } catch (e) {
      totalExpenses = 0;
    }

    // 4. Cash balance = opening + all collected - all expenses
    const cashBalance = openingBalance + totalPaid - totalExpenses;

    // 5. Households owing (across ALL contribution types for current month)
    const owingRes = await query(`
      SELECT COUNT(DISTINCT member_id) AS count
      FROM contributions
      WHERE period_year = $1 
        AND period_month = $2 
        AND amount_due > amount_paid
    `, [currentYear, currentMonth]);
    const householdsOwing = parseInt(owingRes.rows[0].count) || 0;

    // 6. Cash Flow Trend (last 6 months) - ALL contribution types
    const trendRes = await query(`
      SELECT 
        period_year,
        period_month,
        COALESCE(SUM(amount_paid), 0) AS contributions,
        0 AS expenses
      FROM contributions
      WHERE (period_year = $1 AND period_month >= $2) 
         OR period_year < $1
      GROUP BY period_year, period_month
      ORDER BY period_year DESC, period_month DESC
      LIMIT 6
    `, [currentYear, currentMonth]);

    const trend = trendRes.rows.reverse().map(r => ({
      year: r.period_year,
      month: r.period_month,
      contributions: parseFloat(r.contributions) || 0,
      expenses: parseFloat(r.expenses) || 0
    }));

    // 7. Spending by Category (current month)
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
      categories = catRes.rows.map(r => ({
        name: r.name || 'Uncategorized',
        total: parseFloat(r.total) || 0
      }));
    } catch (e) {
      categories = [];
    }

    res.json({
      cash_balance: cashBalance,
      collected_this_month: totalPaid,
      spent_this_month: totalExpenses,
      households_owing: householdsOwing,
      expected_this_month: totalDue,
      trend,
      categories,
      date: now.toISOString()
    });

  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;