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

    const [startYear, startMonth] = start.split('-').map(Number);
    const [endYear, endMonth] = end.split('-').map(Number);

    // Get the estate opening balance
    const estateOpeningRes = await query(`
      SELECT opening_balance, effective_date FROM estate_opening_balance WHERE id = 1
    `);
    const estateOpening = parseFloat(estateOpeningRes.rows[0]?.opening_balance) || 0;
    const estateEffectiveDate = estateOpeningRes.rows[0]?.effective_date || '2026-01-01';

    // Calculate balance from transactions (contributions - expenses)
    const calculatedOpeningRes = await query(`
      SELECT 
        COALESCE((
          SELECT SUM(amount_paid) 
          FROM contributions 
          WHERE (period_year < $1) OR (period_year = $1 AND period_month < $2)
        ), 0) -
        COALESCE((
          SELECT SUM(amount) 
          FROM expenses 
          WHERE spent_on < $3::date
        ), 0) AS balance
    `, [startYear, startMonth, start]);

    const calculatedOpening = parseFloat(calculatedOpeningRes.rows[0].balance) || 0;

    // Final opening balance = estate opening + calculated from transactions
    const openingBalance = estateOpening + calculatedOpening;

    // Total Received
    const totalReceivedRes = await query(`
      SELECT COALESCE(SUM(amount_paid), 0) AS total
      FROM contributions
      WHERE 
        ((period_year > $1) OR (period_year = $1 AND period_month >= $2))
        AND 
        ((period_year < $3) OR (period_year = $3 AND period_month <= $4))
    `, [startYear, startMonth, endYear, endMonth]);

    // Total Expenses
    let expenseQuery = `
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM expenses
      WHERE spent_on BETWEEN $1::date AND $2::date
    `;
    const expenseParams = [start, end];
    if (category_id) {
      expenseQuery += ` AND category_id = $3`;
      expenseParams.push(category_id);
    }
    const totalExpensesRes = await query(expenseQuery, expenseParams);

    // Closing Balance
    const closingBalanceRes = await query(`
      SELECT 
        COALESCE((
          SELECT SUM(amount_paid) 
          FROM contributions 
          WHERE (period_year < $1) OR (period_year = $1 AND period_month <= $2)
        ), 0) -
        COALESCE((
          SELECT SUM(amount) 
          FROM expenses 
          WHERE spent_on <= $3::date
        ), 0) AS balance
    `, [endYear, endMonth, end]);

    const calculatedClosing = parseFloat(closingBalanceRes.rows[0].balance) || 0;
    const closingBalance = estateOpening + calculatedClosing;

    // Expense Breakdown
    let breakdownQuery = `
      SELECT 
        COALESCE(c.name, 'Uncategorized') AS name,
        COALESCE(SUM(e.amount), 0) AS total,
        COUNT(e.id)::int AS count
      FROM expenses e
      LEFT JOIN categories c ON e.category_id = c.id
      WHERE e.spent_on BETWEEN $1::date AND $2::date
    `;
    const breakdownParams = [start, end];
    if (category_id) {
      breakdownQuery += ` AND e.category_id = $3`;
      breakdownParams.push(category_id);
    }
    breakdownQuery += ` GROUP BY c.name ORDER BY total DESC`;
    const breakdownRes = await query(breakdownQuery, breakdownParams);

    // Daily trend
    let dailyTrendQuery = `
      SELECT 
        TO_CHAR(spent_on, 'YYYY-MM-DD') AS date,
        TO_CHAR(spent_on, 'DD Mon') AS label,
        COALESCE(SUM(amount), 0) AS total
      FROM expenses
      WHERE spent_on BETWEEN $1::date AND $2::date
    `;
    const dailyTrendParams = [start, end];
    if (category_id) {
      dailyTrendQuery += ` AND category_id = $3`;
      dailyTrendParams.push(category_id);
    }
    dailyTrendQuery += ` GROUP BY spent_on ORDER BY spent_on ASC`;
    const dailyTrendRes = await query(dailyTrendQuery, dailyTrendParams);

    // Top expenses
    let topExpensesQuery = `
      SELECT 
        e.id, e.description, e.amount, e.spent_on, e.vendor,
        c.name AS category_name
      FROM expenses e
      LEFT JOIN categories c ON e.category_id = c.id
      WHERE e.spent_on BETWEEN $1::date AND $2::date
    `;
    const topExpensesParams = [start, end];
    if (category_id) {
      topExpensesQuery += ` AND e.category_id = $3`;
      topExpensesParams.push(category_id);
    }
    topExpensesQuery += ` ORDER BY e.amount DESC LIMIT 10`;
    const topExpensesRes = await query(topExpensesQuery, topExpensesParams);

    // Categories for filter
    const categoriesRes = await query(`SELECT id, name FROM categories WHERE is_active = true ORDER BY name`);

    const totalReceived = parseFloat(totalReceivedRes.rows[0].total) || 0;
    const totalExpenses = parseFloat(totalExpensesRes.rows[0].total) || 0;

    res.json({
      kpis: {
        opening_balance: openingBalance,
        total_received: totalReceived,
        total_expenses: totalExpenses,
        closing_balance: closingBalance,
        estate_opening_balance: estateOpening,
        estate_effective_date: estateEffectiveDate
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

// POST endpoint to update opening balance
router.post('/opening-balance', staff, async (req, res) => {
  try {
    const { amount, effective_date, notes } = req.body;
    
    if (!amount || isNaN(amount)) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    const date = effective_date || '2026-01-01';
    const note = notes || 'Manual update';

    const result = await query(`
      UPDATE estate_opening_balance 
      SET opening_balance = $1, effective_date = $2, notes = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
      RETURNING *
    `, [amount, date, note]);

    res.json({ 
      success: true, 
      opening_balance: parseFloat(result.rows[0].opening_balance),
      effective_date: result.rows[0].effective_date
    });
  } catch (err) {
    console.error('Update opening balance error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;