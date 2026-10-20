const express = require('express');
const { query } = require('../db');
const { authenticate, staff } = require('../auth');

const router = express.Router();
router.use(authenticate);

router.get('/summary', staff, async (req, res) => {
  try {
    const { startDate, endDate, category_id } = req.query;
    
    const now = new Date();
    const start = startDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const end = endDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`;

    // 1. Opening Balance
    const openingBalanceRes = await query(`
      SELECT 
        COALESCE((SELECT SUM(amount_paid) FROM contributions WHERE period_year || '-' || LPAD(period_month::text, 2, '0') < $1), 0) -
        COALESCE((SELECT SUM(amount) FROM expenses WHERE spent_on::text < $1), 0) AS balance
    `, [start]);

    // 2. Total Received
    const totalReceivedRes = await query(`
      SELECT COALESCE(SUM(amount_paid), 0) AS total
      FROM contributions
      WHERE period_year || '-' || LPAD(period_month::text, 2, '0') BETWEEN $1 AND $2
    `, [start, end]);

    // 3. Total Expenses
    let expenseQuery = `
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM expenses
      WHERE spent_on::text BETWEEN $1 AND $2
    `;
    const expenseParams = [start, end];
    
    if (category_id) {
      expenseQuery += ` AND category_id = $3`;
      expenseParams.push(category_id);
    }
    
    const totalExpensesRes = await query(expenseQuery, expenseParams);

    // 4. Closing Balance
    const closingBalanceRes = await query(`
      SELECT 
        COALESCE((SELECT SUM(amount_paid) FROM contributions WHERE period_year || '-' || LPAD(period_month::text, 2, '0') <= $1), 0) -
        COALESCE((SELECT SUM(amount) FROM expenses WHERE spent_on::text <= $1), 0) AS balance
    `, [end]);

    // 5. Expense Breakdown
    let breakdownQuery = `
      SELECT 
        COALESCE(c.name, 'Uncategorized') AS name,
        COALESCE(SUM(e.amount), 0) AS total,
        COUNT(e.id)::int AS count
      FROM expenses e
      LEFT JOIN categories c ON e.category_id = c.id
      WHERE e.spent_on::text BETWEEN $1 AND $2
    `;
    const breakdownParams = [start, end];
    
    if (category_id) {
      breakdownQuery += ` AND e.category_id = $3`;
      breakdownParams.push(category_id);
    }
    
    breakdownQuery += ` GROUP BY c.name ORDER BY total DESC`;
    
    const breakdownRes = await query(breakdownQuery, breakdownParams);

    // 6. Daily trend
    let dailyTrendQuery = `
      SELECT 
        TO_CHAR(spent_on, 'YYYY-MM-DD') AS date,
        TO_CHAR(spent_on, 'DD Mon') AS label,
        COALESCE(SUM(amount), 0) AS total
      FROM expenses
      WHERE spent_on::text BETWEEN $1 AND $2
    `;
    const dailyTrendParams = [start, end];
    
    if (category_id) {
      dailyTrendQuery += ` AND category_id = $3`;
      dailyTrendParams.push(category_id);
    }
    
    dailyTrendQuery += ` GROUP BY spent_on ORDER BY spent_on ASC`;
    
    const dailyTrendRes = await query(dailyTrendQuery, dailyTrendParams);

    // 7. Top expenses
    let topExpensesQuery = `
      SELECT 
        e.id,
        e.description,
        e.amount,
        e.spent_on,
        e.vendor,
        c.name AS category_name
      FROM expenses e
      LEFT JOIN categories c ON e.category_id = c.id
      WHERE e.spent_on::text BETWEEN $1 AND $2
    `;
    const topExpensesParams = [start, end];
    
    if (category_id) {
      topExpensesQuery += ` AND e.category_id = $3`;
      topExpensesParams.push(category_id);
    }
    
    topExpensesQuery += ` ORDER BY e.amount DESC LIMIT 10`;
    
    const topExpensesRes = await query(topExpensesQuery, topExpensesParams);

    // 8. Categories
    const categoriesRes = await query(`SELECT id, name FROM categories WHERE is_active = true ORDER BY name`);

    const openingBalance = parseFloat(openingBalanceRes.rows[0].balance) || 0;
    const totalReceived = parseFloat(totalReceivedRes.rows[0].total) || 0;
    const totalExpenses = parseFloat(totalExpensesRes.rows[0].total) || 0;
    const closingBalance = parseFloat(closingBalanceRes.rows[0].balance) || 0;

    res.json({
      kpis: {
        opening_balance: openingBalance,
        total_received: totalReceived,
        total_expenses: totalExpenses,
        closing_balance: closingBalance
      },
      expense_breakdown: breakdownRes.rows.map(r => ({
        name: r.name,
        total: parseFloat(r.total) || 0,
        count: parseInt(r.count) || 0
      })),
      daily_trend: dailyTrendRes.rows.map(r => ({
        date: r.date,
        label: r.label,
        total: parseFloat(r.total) || 0
      })),
      top_expenses: topExpensesRes.rows.map(r => ({
        id: r.id,
        description: r.description,
        amount: parseFloat(r.amount) || 0,
        spent_on: r.spent_on,
        vendor: r.vendor,
        category_name: r.category_name
      })),
      categories: categoriesRes.rows,
      filters: {
        start_date: start,
        end_date: end,
        category_id: category_id || null
      }
    });

  } catch (err) {
    console.error('Reports error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;