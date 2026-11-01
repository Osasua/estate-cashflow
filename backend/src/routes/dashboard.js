const express = require('express');
const { query } = require('../db');
const { authenticate } = require('../auth');
const { getManualOpenings, manualForScope } = require('../opening');

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

    // 1. KPIs
    //    balance is computed WITHOUT any manual opening here; the opening pots
    //    are added below via src/opening.js so Reports and Dashboard always use
    //    the same source of truth.
    //    Without ?type: month_due from active members, pending_count from
    //    monthly bills. With ?type: contribution-side figures scope to that
    //    type's bills, plus all-time collected/spent and the fund's own
    //    balance (its manual opening + everything it raised - everything it
    //    spent).
    const kpisSql = scoped ? `
      SELECT 
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
            AND type = $3
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
        ), 0) AS type_all_time_collected,

        COALESCE((
          SELECT SUM(amount)
          FROM expenses
          WHERE type = $3
        ), 0) AS type_all_time_spent
    ` : `
      SELECT 
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

    // Manual openings (single source of truth, shared with Reports).
    const { amounts: manualAmounts } = await getManualOpenings();
    // Estate cash in the bank = every manual pot + all receipts - all spending.
    kpis.balance = manualForScope(manualAmounts, null) + kpis.balance;

    if (scoped) {
      const collected = parseFloat(kpisRes.rows[0].type_all_time_collected) || 0;
      const spent = parseFloat(kpisRes.rows[0].type_all_time_spent) || 0;
      kpis.type_all_time_collected = collected;
      kpis.type_all_time_spent = spent;
      // The fund's own position — what the Float/Projects/... tab must show:
      // what it brought in + what it raised - what it spent.
      kpis.fund_opening = manualForScope(manualAmounts, type);
      kpis.fund_balance = kpis.fund_opening + collected - spent;
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
        ${scoped ? 'WHERE type = CAST($2 AS contribution_type)' : ''}
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
    `, scoped ? [type, type] : ['monthly']);

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


    // 3. Daily Expenses
    const dailyRes = await query(`
      SELECT TO_CHAR(spent_on, 'DD Mon') AS day, COALESCE(SUM(amount), 0) AS total
      FROM expenses WHERE spent_on >= CURRENT_DATE - INTERVAL '13 days' ${scoped ? 'AND type = $1' : ''}
      GROUP BY spent_on ORDER BY spent_on ASC
    `, scoped ? [type] : []);
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
      LEFT JOIN expenses e ON DATE_TRUNC('week', e.spent_on) = w.week_start ${scoped ? 'AND e.type = $1' : ''}
      GROUP BY w.week_start
      ORDER BY w.week_start ASC
    `, scoped ? [type] : []);
    const weekly = weeklyRes.rows.map(r => ({ week: r.week, total: parseFloat(r.total) || 0 }));

    // 5. Categories
    const categoriesRes = await query(`
      SELECT COALESCE(c.name, 'Uncategorized') AS name, COALESCE(SUM(e.amount), 0) AS total
      FROM expenses e LEFT JOIN categories c ON e.category_id = c.id
      WHERE EXTRACT(YEAR FROM e.spent_on) = $1 AND EXTRACT(MONTH FROM e.spent_on) = $2 ${scoped ? 'AND e.type = $3' : ''}
      GROUP BY c.name ORDER BY total DESC
    `, scoped ? [currentYear, currentMonth, type] : [currentYear, currentMonth]);
    const categories = categoriesRes.rows.map(r => ({ name: r.name, total: parseFloat(r.total) || 0 }));

    // 6. Collections by fund (same 6-month window as the trend) — Overview only
    let funds = [];
    if (!scoped) {
      const fundsRes = await query(`
        SELECT type::text AS key, COALESCE(SUM(amount_paid), 0) AS total
        FROM contributions
        WHERE (period_year * 12 + period_month) BETWEEN ($1 * 12 + $2) - 5 AND ($1 * 12 + $2)
        GROUP BY type
        HAVING COALESCE(SUM(amount_paid), 0) > 0
        ORDER BY total DESC
      `, [currentYear, currentMonth]);
      funds = fundsRes.rows.map(r => ({ key: r.key, total: parseFloat(r.total) || 0 }));
    }

    if (scoped) {
      // Scope echo: the frontend relies on this to refuse displaying
      // estate-wide aggregates as if they were type-scoped.
      return res.json({ scope: { type }, kpis, trend, daily, weekly, categories });
    }
    res.json({ kpis, trend, daily, weekly, categories, funds });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET occasion-based analytics for occasional contribution types
// (Float / Projects / End of Year): one entry per activation, instead of a
// fixed monthly window that would be mostly zeros for these funds.
router.get('/occasions', async (req, res) => {
  const type = req.query.type;
  if (!type || !DASHBOARD_TYPES.includes(type)) {
    return res.status(400).json({
      error: `Invalid or missing type. Expected one of: ${DASHBOARD_TYPES.join(', ')}`
    });
  }

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  try {
    const { rows } = await query(`
      SELECT
        period_year,
        period_month,
        COALESCE(SUM(amount_due), 0)  AS expected,
        COALESCE(SUM(amount_paid), 0) AS collected,
        COUNT(*)::int AS households,
        COUNT(*) FILTER (WHERE amount_due > 0 AND amount_paid >= amount_due)::int AS paid,
        COUNT(*) FILTER (WHERE amount_paid > 0 AND amount_paid < amount_due)::int AS partial,
        COUNT(*) FILTER (WHERE amount_paid = 0)::int AS pending,
        MIN(created_at) AS billed_at
      FROM contributions
      WHERE type = $1
      GROUP BY period_year, period_month
      ORDER BY period_year ASC, period_month ASC
    `, [type]);

    const occasions = rows.map(r => {
      const expected = parseFloat(r.expected) || 0;
      const collected = parseFloat(r.collected) || 0;
      return {
        period: `${r.period_year}-${String(r.period_month).padStart(2, '0')}`,
        label: `${MONTHS[r.period_month - 1]} ${r.period_year}`,
        short: `${MONTHS[r.period_month - 1].slice(0, 3)} ${String(r.period_year).slice(2)}`,
        expected,
        collected,
        outstanding: expected - collected,
        rate: expected > 0 ? parseFloat(((collected / expected) * 100).toFixed(1)) : null,
        households: {
          total: parseInt(r.households) || 0,
          paid: parseInt(r.paid) || 0,
          partial: parseInt(r.partial) || 0,
          pending: parseInt(r.pending) || 0
        },
        billed_at: r.billed_at
      };
    });

    const withRate = occasions.filter(o => o.rate !== null);

    // --- Cash movement for this fund, by month -----------------------------
    // Money IN is dated by payment (payments.paid_at), money OUT by spend date.
    // This is what lets an occasional fund tell its whole story: one levy in,
    // spending dripping out across the months that follow.
    const { amounts: manualAmounts, meta: manualMeta } = await getManualOpenings();
    const fundOpening = manualForScope(manualAmounts, type);

    const [inRes, outRes, catRes] = await Promise.all([
      query(`
        SELECT TO_CHAR(p.paid_at, 'YYYY-MM') AS month, COALESCE(SUM(p.amount), 0) AS total
        FROM payments p JOIN contributions c ON c.id = p.contribution_id
        WHERE c.type = $1
        GROUP BY 1 ORDER BY 1`, [type]),
      query(`
        SELECT TO_CHAR(spent_on, 'YYYY-MM') AS month, COALESCE(SUM(amount), 0) AS total
        FROM expenses WHERE type = $1
        GROUP BY 1 ORDER BY 1`, [type]),
      query(`
        SELECT COALESCE(c.name, 'Uncategorized') AS name,
               COALESCE(SUM(e.amount), 0) AS total, COUNT(e.id)::int AS count
        FROM expenses e LEFT JOIN categories c ON c.id = e.category_id
        WHERE e.type = $1
        GROUP BY 1 ORDER BY 2 DESC`, [type]),
    ]);
    const inByMonth = new Map(inRes.rows.map(r => [r.month, parseFloat(r.total) || 0]));
    const outByMonth = new Map(outRes.rows.map(r => [r.month, parseFloat(r.total) || 0]));

    const monthIndex = (ym) => { const [y, m] = ym.split('-').map(Number); return y * 12 + (m - 1); };
    const fromIndex = (i) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
    const monthLabel = (ym) => {
      const [y, m] = ym.split('-').map(Number);
      return `${MONTHS[m - 1].slice(0, 3)} ${String(y).slice(2)}`;
    };

    const now = new Date();
    const nowYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const nowIdx = monthIndex(nowYm);

    const activityIdx = [...inByMonth.keys(), ...outByMonth.keys()].map(monthIndex);
    const startIdx = Math.min(
      occasions.length ? monthIndex(occasions[0].period) : nowIdx,
      activityIdx.length ? Math.min(...activityIdx) : nowIdx
    );

    // Month-by-month statement with a running balance (opening carried in).
    const monthly = [];
    let running = fundOpening;
    for (let i = startIdx; i <= nowIdx; i++) {
      const ym = fromIndex(i);
      const moneyIn = inByMonth.get(ym) || 0;
      const spent = outByMonth.get(ym) || 0;
      running += moneyIn - spent;
      monthly.push({ month: ym, label: monthLabel(ym), in: moneyIn, spent, balance: running });
    }

    // Attribute spending to the activation whose window it falls in:
    // window = [activation month, next activation month) — the last runs open.
    const windowStart = occasions.map(o => monthIndex(o.period));
    occasions.forEach((o, i) => {
      const from = windowStart[i];
      const to = i + 1 < occasions.length ? windowStart[i + 1] : nowIdx + 1;
      let spent = 0;
      for (let m = from; m < to; m++) spent += outByMonth.get(fromIndex(m)) || 0;
      o.spent = spent;
      // Running balance at the end of this activation's window
      const last = monthly.filter(row => monthIndex(row.month) < to).pop();
      o.balance_after = last ? last.balance : fundOpening;
    });

    const allTimeSpent = [...outByMonth.values()].reduce((s, v) => s + v, 0);
    const totals = {
      occasions: occasions.length,
      all_time_expected: occasions.reduce((s2, o) => s2 + o.expected, 0),
      all_time_collected: occasions.reduce((s2, o) => s2 + o.collected, 0),
      all_time_spent: allTimeSpent,
      fund_opening: fundOpening,
      fund_opening_effective_date: manualMeta[type]?.effective_date || null,
      fund_balance: fundOpening + occasions.reduce((s2, o) => s2 + o.collected, 0) - allTimeSpent,
      avg_collection_rate: withRate.length
        ? parseFloat((withRate.reduce((s2, o) => s2 + o.rate, 0) / withRate.length).toFixed(1))
        : null,
      latest: occasions.length ? occasions[occasions.length - 1].period : null
    };
    totals.spend_ratio = totals.all_time_collected > 0
      ? parseFloat(((allTimeSpent / totals.all_time_collected) * 100).toFixed(1))
      : null;

    res.json({
      scope: { type },
      totals,
      occasions,
      monthly,
      categories: catRes.rows.map(r => ({
        name: r.name, total: parseFloat(r.total) || 0, count: parseInt(r.count) || 0
      })),
    });
  } catch (err) {
    console.error('Occasions error:', err);
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
