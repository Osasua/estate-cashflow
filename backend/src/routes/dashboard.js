const express = require('express');
const { query } = require('../db');
const { authenticate, staff } = require('../auth');

const router = express.Router();
router.use(authenticate);

router.get('/summary', async (req, res) => {
  try {
    const { startDate, endDate, categories, timeframe } = req.query;
    
    // Default to current month if no dates provided
    const now = new Date();
    const defaultStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const defaultEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`;
    
    const start = startDate || defaultStart;
    const end = endDate || defaultEnd;
    
    const categoryList = categories ? categories.split(',') : [];
    
    // Build WHERE clauses
    const expenseWhere = [`e.spent_on BETWEEN $1 AND $2`];
    const contributionWhere = [`c.period_year >= EXTRACT(YEAR FROM $1::date)::int AND c.period_year <= EXTRACT(YEAR FROM $2::date)::int`];
    const params = [start, end];
    
    if (categoryList.length > 0) {
      params.push(...categoryList);
      expenseWhere.push(`e.category_id = ANY($${params.length})`);
    }
    
    // 1. KPIs - Accurate calculations
    const [openingBalanceRes, totalReceivedRes, totalExpensesRes, closingBalanceRes] = await Promise.all([
      // Opening balance: Balance before the start date
      query(`
        SELECT COALESCE(SUM(amount_paid), 0) - COALESCE((SELECT SUM(amount) FROM expenses WHERE spent_on < $1), 0) AS balance
        FROM contributions
        WHERE (period_year < EXTRACT(YEAR FROM $1::date)::int OR (period_year = EXTRACT(YEAR FROM $1::date)::int AND period_month < EXTRACT(MONTH FROM $1::date)::int))
      `, [start]),
      
      // Total received during period
      query(`
        SELECT COALESCE(SUM(amount_paid), 0) AS total
        FROM contributions
        WHERE period_year >= EXTRACT(YEAR FROM $1::date)::int 
          AND period_year <= EXTRACT(YEAR FROM $2::date)::int
          AND (period_year > EXTRACT(YEAR FROM $1::date)::int OR period_month >= EXTRACT(MONTH FROM $1::date)::int)
          AND (period_year < EXTRACT(YEAR FROM $2::date)::int OR period_month <= EXTRACT(MONTH FROM $2::date)::int)
      `, [start, end]),
      
      // Total expenses during period
      query(`
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM expenses e
        WHERE ${expenseWhere.join(' AND ')}
      `, params),
      
      // Closing balance: Balance at end of period
      query(`
        SELECT COALESCE(SUM(amount_paid), 0) - COALESCE((SELECT SUM(amount) FROM expenses WHERE spent_on <= $1), 0) AS balance
        FROM contributions
        WHERE period_year <= EXTRACT(YEAR FROM $1::date)::int
          AND (period_year < EXTRACT(YEAR FROM $1::date)::int OR period_month <= EXTRACT(MONTH FROM $1::date)::int)
      `, [end])
    ]);
    
    const openingBalance = parseFloat(openingBalanceRes.rows[0].balance) || 0;
    const totalReceived = parseFloat(totalReceivedRes.rows[0].total) || 0;
    const totalExpenses = parseFloat(totalExpensesRes.rows[0].total) || 0;
    const closingBalance = parseFloat(closingBalanceRes.rows[0].balance) || 0;
    const netFlow = totalReceived - totalExpenses;
    
    // 2. Monthly trend - Accurate aggregation
    const trendRes = await query(`
      WITH RECURSIVE months AS (
        SELECT date_trunc('month', $1::date) AS month_start
        UNION ALL
        SELECT month_start + INTERVAL '1 month'
        FROM months
        WHERE month_start < date_trunc('month', $2::date)
      ),
      contributions_agg AS (
        SELECT 
          period_year AS yr,
          period_month AS mo,
          SUM(amount_paid) AS total_paid
        FROM contributions
        GROUP BY period_year, period_month
      ),
      expenses_agg AS (
        SELECT 
          EXTRACT(YEAR FROM spent_on)::int AS yr,
          EXTRACT(MONTH FROM spent_on)::int AS mo,
          SUM(amount) AS total_spent
        FROM expenses
        WHERE ${expenseWhere.join(' AND ')}
        GROUP BY EXTRACT(YEAR FROM spent_on), EXTRACT(MONTH FROM spent_on)
      )
      SELECT 
        TO_CHAR(m.month_start, 'YYYY-MM') AS month,
        TO_CHAR(m.month_start, 'Mon YYYY') AS label,
        COALESCE(c.total_paid, 0) AS income,
        COALESCE(e.total_spent, 0) AS expense
      FROM months m
      LEFT JOIN contributions_agg c 
        ON EXTRACT(YEAR FROM m.month_start)::int = c.yr 
        AND EXTRACT(MONTH FROM m.month_start)::int = c.mo
      LEFT JOIN expenses_agg e 
        ON EXTRACT(YEAR FROM m.month_start)::int = e.yr 
        AND EXTRACT(MONTH FROM m.month_start)::int = e.mo
      ORDER BY m.month_start ASC
    `, [start, end, ...params.slice(2)]);
    
    const trend = trendRes.rows.map(r => ({
      month: r.month,
      label: r.label,
      income: parseFloat(r.income) || 0,
      expense: parseFloat(r.expense) || 0,
      net: (parseFloat(r.income) || 0) - (parseFloat(r.expense) || 0)
    }));
    
    // 3. Category breakdown
    const categoryRes = await query(`
      SELECT 
        COALESCE(c.name, 'Uncategorized') AS name,
        COALESCE(SUM(e.amount), 0) AS total
      FROM expenses e
      LEFT JOIN categories c ON e.category_id = c.id
      WHERE ${expenseWhere.join(' AND ')}
      GROUP BY c.name
      ORDER BY total DESC
    `, params);
    
    const categoryBreakdown = categoryRes.rows.map(r => ({
      name: r.name,
      total: parseFloat(r.total) || 0,
      percentage: totalExpenses > 0 ? ((parseFloat(r.total) || 0) / totalExpenses * 100).toFixed(1) : 0
    }));
    
    // 4. Top expenses
    const topExpensesRes = await query(`
      SELECT 
        e.description,
        e.amount,
        e.spent_on,
        COALESCE(c.name, 'Uncategorized') AS category,
        e.vendor
      FROM expenses e
      LEFT JOIN categories c ON e.category_id = c.id
      WHERE ${expenseWhere.join(' AND ')}
      ORDER BY e.amount DESC
      LIMIT 10
    `, params);
    
    const topExpenses = topExpensesRes.rows.map(r => ({
      description: r.description,
      amount: parseFloat(r.amount) || 0,
      date: r.spent_on,
      category: r.category,
      vendor: r.vendor
    }));
    
    // 5. Daily expenses for bar chart
    const dailyRes = await query(`
      SELECT 
        TO_CHAR(spent_on, 'DD Mon') AS day,
        COALESCE(SUM(amount), 0) AS total
      FROM expenses
      WHERE ${expenseWhere.join(' AND ')}
      GROUP BY spent_on
      ORDER BY spent_on ASC
    `, params);
    
    const daily = dailyRes.rows.map(r => ({
      day: r.day,
      total: parseFloat(r.total) || 0
    }));
    
    // 6. All categories for filter
    const allCategoriesRes = await query(`SELECT id, name FROM categories ORDER BY name`);
    const allCategories = allCategoriesRes.rows;
    
    res.json({
      kpis: {
        openingBalance,
        totalReceived,
        totalExpenses,
        closingBalance,
        netFlow
      },
      trend,
      categoryBreakdown,
      topExpenses,
      daily,
      allCategories,
      filters: { start, end, categories: categoryList, timeframe: timeframe || 'monthly' }
    });
    
  } catch (err) {
    console.error('Reports error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;