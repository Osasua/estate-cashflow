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

    // 1. Get opening balance
    let openingBalance = 0;
    try {
      const balRes = await query(`SELECT value FROM settings WHERE key = 'opening_balance'`);
      openingBalance = parseFloat(balRes.rows[0]?.value) || 0;
    } catch (e) {
      openingBalance = 0;
    }

    // 2. Get Monthly contributions for current month
    const monthlyRes = await query(`
      SELECT 
        COALESCE(SUM(amount_due), 0) AS total_due,
        COALESCE(SUM(amount_paid), 0) AS total_paid
      FROM contributions
      WHERE period_year = $1 AND period_month = $2 AND type = 'monthly'
    `, [currentYear, currentMonth]);

    const monthlyDue = parseFloat(monthlyRes.rows[0].total_due) || 0;
    const monthlyPaid = parseFloat(monthlyRes.rows[0].total_paid) || 0;

    // 3. Get Occasional contributions for current month (all non-monthly types)
    const occasionalRes = await query(`
      SELECT 
        COALESCE(SUM(amount_due), 0) AS total_due,
        COALESCE(SUM(amount_paid), 0) AS total_paid
      FROM contributions
      WHERE period_year = $1 AND period_month = $2 AND type != 'monthly'
    `, [currentYear, currentMonth]);

    const occasionalDue = parseFloat(occasionalRes.rows[0].total_due) || 0;
    const occasionalPaid = parseFloat(occasionalRes.rows[0].total_paid) || 0;

    // 4. Total collections
    const totalDue = monthlyDue + occasionalDue;
    const totalPaid = monthlyPaid + occasionalPaid;

    // 5. Get total expenses for current month
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

    // 6. Cash balance = opening + all collected - all expenses
    const cashBalance = openingBalance + totalPaid - totalExpenses;

    // 7. Households owing (monthly only for current month)
    const owingRes = await query(`
      SELECT COUNT(DISTINCT member_id) AS count
      FROM contributions
      WHERE period_year = $1 
        AND period_month = $2 
        AND type = 'monthly'
        AND amount_due > amount_paid
    `, [currentYear, currentMonth]);
    const householdsOwing = parseInt(owingRes.rows[0].count) || 0;

    // 8. Cash Flow Trend (last 6 months) - separate monthly and occasional
    const trendRes = await query(`
      SELECT 
        period_year,
        period_month,
        type,
        COALESCE(SUM(amount_paid), 0) AS contributions
      FROM contributions
      WHERE (period_year = $1 AND period_month >= $2) 
         OR period_year < $1
      GROUP BY period_year, period_month, type
      ORDER BY period_year DESC, period_month DESC
    `, [currentYear, currentMonth]);

    // Group by month and separate monthly vs occasional
    const trendMap = {};
    trendRes.rows.forEach(r => {
      const key = `${r.period_year}-${r.period_month}`;
      if (!trendMap[key]) {
        trendMap[key] = { year: r.period_year, month: r.period_month, monthly: 0, occasional: 0 };
      }
      if (r.type === 'monthly') {
        trendMap[key].monthly += parseFloat(r.contributions) || 0;
      } else {
        trendMap[key].occasional += parseFloat(r.contributions) || 0;
      }
    });

    const trend = Object.values(trendMap)
      .sort((a, b) => a.year - b.year || a.month - b.month)
      .slice(-6)
      .map(t => ({
        month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][t.month - 1],
        Monthly: t.monthly,
        Occasional: t.occasional
      }));

    // 9. Spending by Category
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
      monthly: {
        due: monthlyDue,
        paid: monthlyPaid
      },
      occasional: {
        due: occasionalDue,
        paid: occasionalPaid
      },
      total: {
        due: totalDue,
        paid: totalPaid
      },
      spent_this_month: totalExpenses,
      households_owing: householdsOwing,
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