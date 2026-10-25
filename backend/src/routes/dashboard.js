const express = require('express');
const { query } = require('../db');
const { authenticate } = require('../auth');

const router = express.Router();
router.use(authenticate);

// Helper: get KPIs for a specific contribution type
async function getTypeKpis(type, year, month) {
  const res = await query(`
    SELECT 
      COALESCE(SUM(amount_due), 0) AS total_due,
      COALESCE(SUM(amount_paid), 0) AS total_paid,
      COUNT(DISTINCT CASE WHEN amount_due > amount_paid THEN member_id END) AS pending_count
    FROM contributions
    WHERE period_year = $1 AND period_month = $2 AND type = $3
  `, [year, month, type]);
  const row = res.rows[0];
  const due = parseFloat(row.total_due) || 0;
  const paid = parseFloat(row.total_paid) || 0;
  return {
    due,
    paid,
    outstanding: due - paid,
    pending_count: parseInt(row.pending_count) || 0
  };
}

// Helper: get 6-month trend for a specific contribution type
async function getTypeTrend(type) {
  const res = await query(`
    SELECT period_year, period_month, COALESCE(SUM(amount_paid), 0) AS contributions
    FROM contributions
    WHERE type = $1
    GROUP BY period_year, period_month
    ORDER BY period_year DESC, period_month DESC
    LIMIT 6
  `, [type]);
  
  const trendMap = {};
  res.rows.forEach(r => {
    const key = `${r.period_year}-${String(r.period_month).padStart(2, '0')}`;
    trendMap[key] = {
      month: key,
      short_month: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][r.period_month - 1],
      income: parseFloat(r.contributions) || 0,
      expense: 0
    };
  });
  return Object.values(trendMap).sort((a, b) => a.month.localeCompare(b.month));
}

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

    // 2. Get KPIs for each contribution type
    const types = ['monthly', 'float', 'projects', 'end-of-year', 'welfare'];
    const kpis = {};
    for (const type of types) {
      kpis[type] = await getTypeKpis(type, currentYear, currentMonth);
    }

    // 3. Total cash balance (all types combined)
    const totalPaid = Object.values(kpis).reduce((sum, k) => sum + k.paid, 0);
    
    // 4. Expenses for current month
    let totalExpenses = 0;
    try {
      const expRes = await query(`SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE EXTRACT(YEAR FROM date) = $1 AND EXTRACT(MONTH FROM date) = $2`, [currentYear, currentMonth]);
      totalExpenses = parseFloat(expRes.rows[0].total) || 0;
    } catch (e) {}

    const cashBalance = openingBalance + totalPaid - totalExpenses;

    // 5. Get trends for each type
    const trend = {};
    for (const type of types) {
      trend[type] = await getTypeTrend(type);
    }

    // 6. Merge expenses into each type's trend
    try {
      const expTrendRes = await query(`SELECT TO_CHAR(date, 'YYYY-MM') as month, COALESCE(SUM(amount), 0) as total FROM expenses GROUP BY TO_CHAR(date, 'YYYY-MM')`);
      const expMap = {};
      expTrendRes.rows.forEach(r => { expMap[r.month] = parseFloat(r.total) || 0; });
      
      for (const type of types) {
        trend[type].forEach(t => {
          t.expense = expMap[t.month] || 0;
          t.net = t.income - t.expense;
        });
      }
    } catch (e) {}

    // 7. Daily expenses
    let daily = [];
    try {
      const dailyRes = await query(`SELECT TO_CHAR(date, 'YYYY-MM-DD') as day, COALESCE(SUM(amount), 0) as total FROM expenses WHERE date >= CURRENT_DATE - INTERVAL '14 days' GROUP BY date ORDER BY date`);
      daily = dailyRes.rows.map(r => ({ day: r.day, total: parseFloat(r.total) || 0 }));
    } catch (e) {}

    // 8. Weekly expenses
    let weekly = [];
    try {
      const weeklyRes = await query(`SELECT DATE_TRUNC('week', date)::date as week, COALESCE(SUM(amount), 0) as total FROM expenses WHERE date >= CURRENT_DATE - INTERVAL '8 weeks' GROUP BY DATE_TRUNC('week', date) ORDER BY DATE_TRUNC('week', date)`);
      weekly = weeklyRes.rows.map(r => ({ week: r.week, total: parseFloat(r.total) || 0 }));
    } catch (e) {}

    // 9. Categories
    let categories = [];
    try {
      const catRes = await query(`SELECT c.name, COALESCE(SUM(e.amount), 0) AS total FROM expenses e LEFT JOIN categories c ON e.category_id = c.id WHERE EXTRACT(YEAR FROM e.date) = $1 AND EXTRACT(MONTH FROM e.date) = $2 GROUP BY c.name ORDER BY total DESC`, [currentYear, currentMonth]);
      categories = catRes.rows.map(r => ({ name: r.name || 'Uncategorized', total: parseFloat(r.total) || 0 }));
    } catch (e) {}

    res.json({
      cash_balance: cashBalance,
      total_expenses: totalExpenses,
      kpis,
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

// GET monthly expense breakdown
router.get('/monthly-breakdown', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const columnRes = await query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'expenses' AND column_name IN ('expense_date', 'date', 'created_at', 'paid_date', 'payment_date', 'transaction_date')
      ORDER BY CASE column_name WHEN 'expense_date' THEN 1 WHEN 'date' THEN 2 WHEN 'created_at' THEN 3 WHEN 'paid_date' THEN 4 WHEN 'payment_date' THEN 5 WHEN 'transaction_date' THEN 6 END
      LIMIT 1
    `);
    const dateColumn = columnRes.rows[0]?.column_name || 'created_at';

    const expenseBreakdown = await query(`
      SELECT c.name, COALESCE(SUM(e.amount), 0) AS total
      FROM expenses e
      LEFT JOIN categories c ON e.category_id = c.id
      WHERE e.${dateColumn}::date >= $1::date AND e.${dateColumn}::date <= $2::date
      GROUP BY c.name
      ORDER BY total DESC
    `, [startDate, endDate]);

    res.json({
      expense_breakdown: expenseBreakdown.rows.map(r => ({
        name: r.name || 'Uncategorized',
        total: parseFloat(r.total) || 0
      }))
    });
  } catch (err) {
    console.error('Monthly breakdown error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;