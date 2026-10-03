const express = require('express');
const { query } = require('../db');
const { authenticate } = require('../auth');

const router = express.Router();
router.use(authenticate);

router.get('/summary', async (req, res) => {
  const { startDate, endDate, year, month, category_ids } = req.query;
  
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'startDate and endDate are required' });
  }

  // Parse category_ids if provided (e.g., "1,2,3" -> [1, 2, 3])
  let categoryFilter = '';
  let categoryParams = [];
  if (category_ids) {
    const ids = category_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    if (ids.length > 0) {
      categoryFilter = `AND e.category_id = ANY($${3}::int[])`;
      categoryParams = [ids];
    }
  }

  // 1. Opening Balance
  const opening = await query(
    `SELECT ((SELECT COALESCE(SUM(amount), 0) FROM payments WHERE paid_at::date < $1::date)
             - (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE spent_on < $1::date))::float8 AS v`,
    [startDate]
  );

  // 2. Received (Payments)
  const received = await query(
    `SELECT COALESCE(SUM(amount), 0)::float8 AS v FROM payments WHERE paid_at::date >= $1::date AND paid_at::date <= $2::date`,
    [startDate, endDate]
  );

  // 3. Expected & Members (Monthly only)
  let expected = 0;
  let members = [];
  if (year && month) {
    const expRes = await query(
      `SELECT COALESCE(SUM(amount_due), 0)::float8 AS v FROM contributions WHERE period_year = $1 AND period_month = $2`,
      [year, month]
    );
    expected = expRes.rows[0].v || 0;
    
    const memRes = await query(
      `SELECT m.household_name, m.house_number, c.amount_due::float8, c.amount_paid::float8
         FROM contributions c JOIN members m ON m.id = c.member_id
        WHERE c.period_year = $1 AND c.period_month = $2
        ORDER BY m.house_number`,
      [year, month]
    );
    members = memRes.rows.map((r) => ({
      ...r,
      status: r.amount_paid >= r.amount_due && r.amount_due > 0 ? 'paid'
            : r.amount_paid > 0 ? 'partial' : 'pending',
    }));
  }

  // 4. Expenses (WITH CATEGORY FILTER)
  // We use a dynamic query string here to inject the category filter safely
  const expenseQuery = `
    SELECT COALESCE(c.name, 'Uncategorised') AS name, SUM(e.amount)::float8 AS total
    FROM expenses e LEFT JOIN categories c ON c.id = e.category_id
    WHERE e.spent_on >= $1::date AND e.spent_on <= $2::date ${categoryFilter}
    GROUP BY 1 ORDER BY 2 DESC
  `;
  
  const expenseListQuery = `
    SELECT e.spent_on::text AS day, e.amount::float8 AS amount, e.description, e.vendor,
           COALESCE(c.name, 'Uncategorised') AS category
    FROM expenses e LEFT JOIN categories c ON c.id = e.category_id
    WHERE e.spent_on >= $1::date AND e.spent_on <= $2::date ${categoryFilter}
    ORDER BY e.spent_on DESC, e.id DESC
  `;

  // Combine base params with category params
  const baseParams = [startDate, endDate, ...categoryParams];

  const expenseRows = await query(expenseQuery, baseParams);
  const expenseList = await query(expenseListQuery, baseParams);

  const openingBalance = opening.rows[0].v || 0;
  const receivedAmount = received.rows[0].v || 0;
  const totalExpenses = expenseRows.rows.reduce((s, r) => s + (r.total || 0), 0);

  res.json({
    startDate,
    endDate,
    opening_balance: openingBalance,
    expected: expected,
    received: receivedAmount,
    total_expenses: totalExpenses,
    closing_balance: openingBalance + receivedAmount - totalExpenses,
    expense_breakdown: expenseRows.rows,
    expenses: expenseList.rows,
    members: members,
  });
});

module.exports = router;