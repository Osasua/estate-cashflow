const express = require('express');
const { query } = require('../db');
const { authenticate, staff } = require('../auth');

const router = express.Router();
router.use(authenticate);

router.get('/summary', staff, async (req, res) => {
  try {
    const { startDate, endDate, category_id, type } = req.query;
    const FUND_TYPES = ['monthly', 'float', 'projects', 'end-of-year', 'welfare'];
    
    // Default to current year if not provided (better for Float/Projects)
    const now = new Date();
    const start = startDate || `${now.getFullYear()}-01-01`;
    const end = endDate || `${now.getFullYear()}-12-31`;
    
    const reportType = (type && FUND_TYPES.includes(type)) ? type : 'monthly';
    const [startYear, startMonth] = start.split('-').map(Number);
    const [endYear, endMonth] = end.split('-').map(Number);

    console.log('=== REPORTS DEBUG ===');
    console.log('Type:', reportType, 'Start:', start, 'End:', end);

    // 1. Get Manual Opening Balance for this specific fund type
    const openingRes = await query(`
      SELECT opening_balance, effective_date 
      FROM estate_opening_balance 
      WHERE type = $1 
      ORDER BY effective_date DESC 
      LIMIT 1
    `, [reportType]);
    
    const manualOpening = parseFloat(openingRes.rows[0]?.opening_balance) || 0;
    const effectiveDate = openingRes.rows[0]?.effective_date || start;
    
    // 2. Calculate balance from transactions BEFORE the start date
    const calculatedOpeningRes = await query(`
      SELECT 
        COALESCE((SELECT SUM(amount_paid) FROM contributions WHERE ((period_year < $1) OR (period_year = $1 AND period_month < $2)) AND type = $3), 0) -
        COALESCE((SELECT SUM(amount) FROM expenses WHERE (spent_on < $4::date) AND type = $3), 0) AS balance
    `, [startYear, startMonth, reportType, start]);

    const calculatedOpening = parseFloat(calculatedOpeningRes.rows[0].balance) || 0;
    const openingBalance = manualOpening + calculatedOpening;

    // 3. Total Received (within date range)
    const totalReceivedRes = await query(`
      SELECT COALESCE(SUM(amount_paid), 0) AS total
      FROM contributions
      WHERE ((period_year > $1) OR (period_year = $1 AND period_month >= $2))
        AND ((period_year < $3) OR (period_year = $3 AND period_month <= $4))
        AND type = $5
    `, [startYear, startMonth, endYear, endMonth, reportType]);

    const totalReceived = parseFloat(totalReceivedRes.rows[0].total) || 0;

    // 4. Total Expenses (within date range)
    let expenseQuery = `
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM expenses
      WHERE spent_on BETWEEN $1::date AND $2::date AND type = $3
    `;
    const expenseParams = [start, end, reportType];
    if (category_id) {
      expenseQuery += ` AND category_id = $4`;
      expenseParams.push(category_id);
    }
    const totalExpensesRes = await query(expenseQuery, expenseParams);
    const totalExpenses = parseFloat(totalExpensesRes.rows[0].total) || 0;

    // 5. Closing Balance
    const calculatedClosingRes = await query(`
      SELECT 
        COALESCE((SELECT SUM(amount_paid) FROM contributions WHERE ((period_year < $1) OR (period_year = $1 AND period_month <= $2)) AND type = $3), 0) -
        COALESCE((SELECT SUM(amount) FROM expenses WHERE (spent_on <= $4::date) AND type = $3), 0) AS balance
    `, [endYear, endMonth, reportType, end]);

    const calculatedClosing = parseFloat(calculatedClosingRes.rows[0].balance) || 0;
    const closingBalance = manualOpening + calculatedClosing;

    // 6. Expense Breakdown
    let breakdownQuery = `
      SELECT COALESCE(c.name, 'Uncategorized') AS name, COALESCE(SUM(e.amount), 0) AS total, COUNT(e.id)::int AS count
      FROM expenses e
      LEFT JOIN categories c ON e.category_id = c.id
      WHERE e.spent_on BETWEEN $1::date AND $2::date AND e.type = $3
    `;
    const breakdownParams = [start, end, reportType];
    if (category_id) {
      breakdownQuery += ` AND e.category_id = $4`;
      breakdownParams.push(category_id);
    }
    breakdownQuery += ` GROUP BY c.name ORDER BY total DESC`;
    const breakdownRes = await query(breakdownQuery, breakdownParams);

    // 7. Daily Trend
    let dailyTrendQuery = `
      SELECT TO_CHAR(spent_on, 'YYYY-MM-DD') AS date, TO_CHAR(spent_on, 'DD Mon') AS label, COALESCE(SUM(amount), 0) AS total
      FROM expenses
      WHERE spent_on BETWEEN $1::date AND $2::date AND type = $3
    `;
    const dailyTrendParams = [start, end, reportType];
    if (category_id) {
      dailyTrendQuery += ` AND category_id = $4`;
      dailyTrendParams.push(category_id);
    }
    dailyTrendQuery += ` GROUP BY spent_on, date, label ORDER BY spent_on ASC`;
    const dailyTrendRes = await query(dailyTrendQuery, dailyTrendParams);

    console.log('=== END DEBUG ===');

    res.json({
      kpis: {
        opening_balance: openingBalance,
        total_received: totalReceived,
        total_expenses: totalExpenses,
        closing_balance: closingBalance,
        manual_opening_balance: manualOpening,
        effective_date: effectiveDate
      },
      expense_breakdown: breakdownRes.rows.map(r => ({ name: r.name, total: parseFloat(r.total) || 0, count: parseInt(r.count) || 0 })),
      daily_trend: dailyTrendRes.rows.map(r => ({ date: r.date, label: r.label, total: parseFloat(r.total) || 0 })),
      filters: { start_date: start, end_date: end, category_id: category_id || null, type: reportType }
    });

  } catch (err) {
    console.error('Reports error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST endpoint to update opening balance PER FUND TYPE
router.post('/opening-balance', staff, async (req, res) => {
  try {
    const { amount, effective_date, notes, type } = req.body;
    if (!amount || isNaN(amount)) return res.status(400).json({ error: 'Valid amount is required' });

    const fundType = type || 'monthly';
    const date = effective_date || '2025-12-31';
    const note = notes || 'Manual update';

    const result = await query(`
      INSERT INTO estate_opening_balance (type, opening_balance, effective_date, notes, updated_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (type) 
      DO UPDATE SET opening_balance = $2, effective_date = $3, notes = $4, updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [fundType, amount, date, note]);

    res.json({ success: true, opening_balance: parseFloat(result.rows[0].opening_balance), type: result.rows[0].type });
  } catch (err) {
    console.error('Update opening balance error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;