const express = require('express');
const { query } = require('../db');
const { authenticate } = require('../auth');

const router = express.Router();
router.use(authenticate);

// Contribution types exposed on the dashboard tabs (mirrors the frontend
// TAB_TO_TYPE map). Anything else is rejected with 400.
const DASHBOARD_TYPES = ['monthly', 'float', 'projects', 'end-of-year', 'welfare'];

router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const type = req.query.type;
    if (type !== undefined && !DASHBOARD_TYPES.includes(type)) {
      return res.status(400).json({
        error: `Invalid type. Expected one of: ${DASHBOARD_TYPES.join(', ')}`
      });
    }
    const scoped = type !== undefined;

    // 1. KPIs - Include estate opening balance
    //    Without ?type: identical to the previous behaviour (month_due from
    //    active members, pending_count from monthly bills).
    //    With ?type: contribution-side figures (month_in, month_due,
    //    pending_count) scope to that type's bills, plus a new all-time
    //    collected total; balance and month_expense stay estate-wide.
    const kpisSql = scoped ? `
      SELECT 
        COALESCE((SELECT opening_balance FROM estate_opening_balance WHERE id = 1), 0) +
        COALESCE((SELECT SUM(amount_paid) FROM contributions), 0) -
        COALESCE((SELECT SUM(amount) FROM expenses), 0) AS balance,
        
        COALESCE((
          SELECT SUM(amount_paid) 
          FROM contributions 
          WHERE period_year = $1 AND period_month = $2 AND type = $3
        ), 0) AS month_in,
        
        COALESCE((
          SELECT SUM(amount_due) 
          FROM contributions 
          WHERE period_year = $1 AND period_month = $2 AND type = $3
        ), 0) AS month_due,
        
        COALESCE((
          SELECT SUM(amount) 
          FROM expenses 
          WHERE EXTRACT(YEAR FROM spent_on) = $1 
            AND EXTRACT(MONTH FROM spent_on) = $2
        ), 0) AS month_expense,
        
        COALESCE((
          SELECT COUNT(DISTINCT member_id)
          FROM contributions
          WHERE period_year = $1 
            AND period_month = $2 
            AND type = $3 
            AND amount_due > 0
            AND amount_paid < amount_due
        ), 0)::int AS pending_count,

        COALESCE((
          SELECT SUM(amount_paid)
          FROM contributions
          WHERE type = $3
        ), 0) AS type_all_time_collected
    ` : `
      SELECT 
        COALESCE((SELECT opening_balance FROM estate_opening_balance WHERE id = 1), 0) +
        COALESCE((SELECT SUM(amount_paid) FROM contributions), 0) -
        COALESCE((SELECT SUM(amount) FROM expenses), 0) AS balance,
        
        COALESCE((
          SELECT SUM(amount_paid) 
          FROM contributions 
          WHERE period_year = $1 AND period_month = $2
        ), 0) AS month_in,
        
        COALESCE((
          SELECT SUM(monthly_due) 
          FROM members 
          WHERE active = true
        ), 0) AS month_due,
        
        COALESCE((
          SELECT SUM(amount) 
          FROM expenses 
          WHERE EXTRACT(YEAR FROM spent_on) = $1 
            AND EXTRACT(MONTH FROM spent_on) = $2
        ), 0) AS month_expense,
        
        COALESCE((
          SELECT COUNT(DISTINCT member_id)
          FROM contributions
          WHERE period_year = $1 
            AND period_month = $2 
            AND type = 'monthly' 
            AND amount_paid < amount_due
        ), 0)::int AS pending_count
    `;

    const kpisRes = await query(
      kpisSql,
      scoped ? [currentYear, currentMonth, type] : [currentYear, currentMonth]
    );

    const kpis = {
      balance: parseFloat(kpisRes.rows[0].balance) || 0,
      month_in: parseFloat(kpisRes.rows[0].month_in) || 0,
      month_due: parseFloat(kpisRes.rows[0].month_due) || 0,
      month_expense: parseFloat(kpisRes.rows[0].month_expense) || 0,
      pending_count: parseInt(kpisRes.rows[0].pending_count) || 0
    };
    if (scoped) {
      kpis.type_all_time_collected =
        parseFloat(kpisRes.rows[0].type_all_time_collected) || 0;
    }

    // 2. Trend - Last 6 months (GUARANTEED to return all 6 months even with zero data)
    //    Unscoped keeps the legacy behaviour: income = 'monthly' bills only.
    //    Scoped: income/due/outstanding come from that type's bills.
    //    Expenses stay estate-wide in both modes.
    const trendRes = await query(`
      WITH RECURSIVE months AS (
        SELECT date_trunc('month', CURRENT_DATE - INTERVAL '5 months') AS month_start
        UNION ALL
        SELECT month_start + INTERVAL '1 month' 
        FROM months 
        WHERE month_start < date_trunc('month', CURRENT_DATE)
      ),
      contributions_agg AS (
        SELECT 
          period_year AS yr,
          period_month AS mo,
          SUM(amount_paid) AS total_paid,
          SUM(amount_due) AS total_due
        FROM contributions
        WHERE type = $1
        GROUP BY period_year, period_month
      ),
      expenses_agg AS (
        SELECT 
          EXTRACT(YEAR FROM spent_on)::int AS yr,
          EXTRACT(MONTH FROM spent_on)::int AS mo,
          SUM(amount) AS total_spent
        FROM expenses
        GROUP BY EXTRACT(YEAR FROM spent_on), EXTRACT(MONTH FROM spent_on)
      )
      SELECT 
        TO_CHAR(m.month_start, 'YYYY-MM') AS month,
        TO_CHAR(m.month_start, 'Mon') AS short_month,
        EXTRACT(MONTH FROM m.month_start)::int AS month_num,
        EXTRACT(YEAR FROM m.month_start)::int AS year_num,
        COALESCE(c.total_paid, 0) AS income,
        COALESCE(c.total_due, 0) AS due,
        COALESCE(e.total_spent, 0) AS expense
      FROM months m
      LEFT JOIN contributions_agg c 
        ON EXTRACT(YEAR FROM m.month_start)::int = c.yr 
        AND EXTRACT(MONTH FROM m.month_start)::int = c.mo
      LEFT JOIN expenses_agg e 
        ON EXTRACT(YEAR FROM m.month_start)::int = e.yr 
        AND EXTRACT(MONTH FROM m.month_start)::int = e.mo
      ORDER BY m.month_start ASC
    `, [scoped ? type : 'monthly']);

    const trend = trendRes.rows.map(r => {
      const income = parseFloat(r.income) || 0;
      const due = parseFloat(r.due) || 0;
      const expense = parseFloat(r.expense) || 0;
      return {
        month: r.month,
        short_month: r.short_month,
        year_num: parseInt(r.year_num),
        month_num: parseInt(r.month_num),
        income,
        due,
        outstanding: due - income,
        expense,
        net: income - expense
      };
    });

    console.log('Trend data:', trend); // Debug log

    // 3. Daily Expenses
    const dailyRes = await query(`
      SELECT TO_CHAR(spent_on, 'DD Mon') AS day, COALESCE(SUM(amount), 0) AS total
      FROM expenses WHERE spent_on >= CURRENT_DATE - INTERVAL '13 days'
      GROUP BY spent_on ORDER BY spent_on ASC
    `);
    const daily = dailyRes.rows.map(r => ({ day: r.day, total: parseFloat(r.total) || 0 }));

    // 4. Weekly Expenses
    const weeklyRes = await query(`
      WITH RECURSIVE weeks AS (
        SELECT date_trunc('week', CURRENT_DATE) - INTERVAL '7 weeks' AS week_start
        UNION ALL
        SELECT week_start + INTERVAL '1 week' FROM weeks WHERE week_start < date_trunc('week', CURRENT_DATE)
      )
      SELECT 
        'Wk ' || EXTRACT(WEEK FROM w.week_start)::text AS week,
        COALESCE(SUM(e.amount), 0) AS total
      FROM weeks w
      LEFT JOIN expenses e ON DATE_TRUNC('week', e.spent_on) = w.week_start
      GROUP BY w.week_start
      ORDER BY w.week_start ASC
    `);
    const weekly = weeklyRes.rows.map(r => ({ week: r.week, total: parseFloat(r.total) || 0 }));

    // 5. Categories
    const categoriesRes = await query(`
      SELECT COALESCE(c.name, 'Uncategorized') AS name, COALESCE(SUM(e.amount), 0) AS total
      FROM expenses e LEFT JOIN categories c ON e.category_id = c.id
      WHERE EXTRACT(YEAR FROM e.spent_on) = $1 AND EXTRACT(MONTH FROM e.spent_on) = $2
      GROUP BY c.name ORDER BY total DESC
    `, [currentYear, currentMonth]);
    const categories = categoriesRes.rows.map(r => ({ name: r.name, total: parseFloat(r.total) || 0 }));

    if (scoped) {
      // Scope echo: the frontend relies on this to refuse displaying
      // estate-wide aggregates as if they were type-scoped.
      return res.json({ scope: { type }, kpis, trend, daily, weekly, categories });
    }
    res.json({ kpis, trend, daily, weekly, categories });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET monthly expense breakdown (accessible to all authenticated users)
router.get('/monthly-breakdown', authenticate, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const breakdownRes = await query(`
      SELECT 
        COALESCE(c.name, 'Uncategorized') AS name,
        COALESCE(SUM(e.amount), 0) AS total,
        COUNT(e.id)::int AS count
      FROM expenses e
      LEFT JOIN categories c ON e.category_id = c.id
      WHERE e.spent_on BETWEEN $1::date AND $2::date
      GROUP BY c.name
      ORDER BY total DESC
    `, [startDate, endDate]);

    const totalExpensesRes = await query(`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM expenses
      WHERE spent_on BETWEEN $1::date AND $2::date
    `, [startDate, endDate]);

    res.json({
      expense_breakdown: breakdownRes.rows.map(r => ({
        name: r.name,
        total: parseFloat(r.total) || 0,
        count: parseInt(r.count) || 0
      })),
      total_expenses: parseFloat(totalExpensesRes.rows[0].total) || 0
    });
  } catch (err) {
    console.error('Monthly breakdown error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
