const express = require('express');
const { query } = require('../db');
const { authenticate, staff } = require('../auth');
const { FUND_KEYS, FUND_LABELS, getManualOpenings, manualForScope, setManualOpening } = require('../opening');

const router = express.Router();
router.use(authenticate);

router.get('/summary', staff, async (req, res) => {
  try {
    const { startDate, endDate, category_id } = req.query;
    const type = req.query.type;
    const FUND_TYPES = ['monthly', 'float', 'projects', 'end-of-year', 'welfare'];
    if (type && !FUND_TYPES.includes(type)) {
      return res.status(400).json({ error: `Invalid type. Expected one of: ${FUND_TYPES.join(', ')}` });
    }
    const scoped = !!type;
    // fund filter fragment; $n is filled per-query below
    const fundFrag = (n, alias) => ` AND ${alias ? alias + '.' : ''}type = $${n}::contribution_type`;
    
    const now = new Date();
    const start = startDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const end = endDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`;

    const [startYear, startMonth] = start.split('-').map(Number);
    const [endYear, endMonth] = end.split('-').map(Number);


    // Manual (brought-forward) openings, per fund — single source of truth
    // shared with the Dashboard so both surfaces agree.
    const { amounts: manualAmounts, meta: manualMeta } = await getManualOpenings();
    const manualOpening = manualForScope(manualAmounts, type || null);

    const estateOpening = manualAmounts.estate;
    const estateEffectiveDate = manualMeta.estate?.effective_date || '2026-01-01';


    // Calculate balance from transactions
    const calculatedOpeningRes = await query(`
      SELECT 
        COALESCE((
          SELECT SUM(amount_paid) 
          FROM contributions 
          WHERE ((period_year < $1) OR (period_year = $1 AND period_month < $2))${scoped ? fundFrag(4) : ''}
        ), 0) -
        COALESCE((
          SELECT SUM(amount) 
          FROM expenses 
          WHERE (spent_on < $3::date)${scoped ? fundFrag(4) : ''}
        ), 0) AS balance
    `, scoped ? [startYear, startMonth, start, type] : [startYear, startMonth, start]);

    const calculatedOpening = parseFloat(calculatedOpeningRes.rows[0].balance) || 0;

    // Opening = manual (brought-forward) cash for this view + prior activity.
    // manualForScope() decides which manual pots belong here: the whole estate
    // sees every pot, Monthly carries the estate pot, other funds only their own.
    const openingBalance = manualOpening + calculatedOpening;

    // Total Received
    const totalReceivedRes = await query(`
      SELECT COALESCE(SUM(amount_paid), 0) AS total
      FROM contributions
      WHERE 
        ((period_year > $1) OR (period_year = $1 AND period_month >= $2))
        AND 
        ((period_year < $3) OR (period_year = $3 AND period_month <= $4))
        ${scoped ? fundFrag(5) : ''}
    `, scoped ? [startYear, startMonth, endYear, endMonth, type] : [startYear, startMonth, endYear, endMonth]);

    const totalReceived = parseFloat(totalReceivedRes.rows[0].total) || 0;

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
    if (scoped) {
      expenseParams.push(type);
      expenseQuery += fundFrag(expenseParams.length);
    }
    const totalExpensesRes = await query(expenseQuery, expenseParams);
    const totalExpenses = parseFloat(totalExpensesRes.rows[0].total) || 0;

    // Closing Balance
    const closingBalanceRes = await query(`
      SELECT 
        COALESCE((
          SELECT SUM(amount_paid) 
          FROM contributions 
          WHERE ((period_year < $1) OR (period_year = $1 AND period_month <= $2))${scoped ? fundFrag(4) : ''}
        ), 0) -
        COALESCE((
          SELECT SUM(amount) 
          FROM expenses 
          WHERE (spent_on <= $3::date)${scoped ? fundFrag(4) : ''}
        ), 0) AS balance
    `, scoped ? [endYear, endMonth, end, type] : [endYear, endMonth, end]);

    const calculatedClosing = parseFloat(closingBalanceRes.rows[0].balance) || 0;
    const closingBalance = manualOpening + calculatedClosing;

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
    if (scoped) {
      breakdownParams.push(type);
      breakdownQuery += fundFrag(breakdownParams.length, 'e');
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
    if (scoped) {
      dailyTrendParams.push(type);
      dailyTrendQuery += fundFrag(dailyTrendParams.length);
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
    if (scoped) {
      topExpensesParams.push(type);
      topExpensesQuery += fundFrag(topExpensesParams.length, 'e');
    }
    topExpensesQuery += ` ORDER BY e.amount DESC LIMIT 10`;
    const topExpensesRes = await query(topExpensesQuery, topExpensesParams);

    // Categories for filter
    const categoriesRes = await query(`SELECT id, name FROM categories WHERE is_active = true ORDER BY name`);

    res.json({
      kpis: {
        opening_balance: openingBalance,
        total_received: totalReceived,
        total_expenses: totalExpenses,
        closing_balance: closingBalance,
        // Breakdown so the UI can explain the opening figure in plain words:
        // "Manual ₦X + prior activity ₦Y" — for every fund, not just Monthly.
        opening_manual: manualOpening,
        opening_prior_activity: calculatedOpening,
        closing_prior_activity: calculatedClosing,
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
        category_id: category_id || null,
        type: scoped ? type : null
      }
    });

  } catch (err) {
    console.error('Reports error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET all per-fund manual openings (for the Opening Balances panel)
router.get('/opening-balances', staff, async (req, res) => {
  try {
    const { amounts, meta } = await getManualOpenings();
    res.json({
      funds: FUND_KEYS.map((key) => ({
        fund: key,
        label: FUND_LABELS[key],
        opening_balance: amounts[key],
        effective_date: meta[key]?.effective_date || null,
        notes: meta[key]?.notes || null,
      })),
    });
  } catch (err) {
    console.error('Opening balances error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST upsert one fund's opening balance.
// body: { amount, effective_date?, notes?, fund? } — fund defaults to 'estate'
router.post('/opening-balance', staff, async (req, res) => {
  try {
    const { amount, effective_date, notes, fund } = req.body;

    if (amount === undefined || amount === null || isNaN(amount)) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }
    const target = fund || 'estate';
    if (!FUND_KEYS.includes(target)) {
      return res.status(400).json({ error: `Unknown fund. Expected one of: ${FUND_KEYS.join(', ')}` });
    }

    const date = effective_date || '2026-01-01';
    const note = notes || 'Manual update';

    const row = await setManualOpening(target, Number(amount), date, note);

    res.json({
      success: true,
      fund: row.fund_type,
      opening_balance: parseFloat(row.opening_balance),
      effective_date: row.effective_date
    });
  } catch (err) {
    console.error('Update opening balance error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;