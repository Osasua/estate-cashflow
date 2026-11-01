const express = require('express');
const { query } = require('../db');
const { authenticate, staff } = require('../auth');

const router = express.Router();
router.use(authenticate);

// GET /api/budgets?year=2026
// Every active category with its budget for the year, what has actually been
// spent (all funds), and the variance — one round trip for the budget panel.
router.get('/', async (req, res) => {
  const year = +req.query.year || new Date().getFullYear();
  try {
    const { rows } = await query(
      `SELECT c.id AS category_id, c.name,
              COALESCE(b.amount, 0) AS budget,
              COALESCE((
                SELECT SUM(e.amount) FROM expenses e
                 WHERE e.category_id = c.id
                   AND EXTRACT(YEAR FROM e.spent_on) = $1
              ), 0) AS spent
         FROM categories c
         LEFT JOIN category_budgets b ON b.category_id = c.id AND b.budget_year = $1
        WHERE c.is_active = true
        ORDER BY c.name`,
      [year]
    );
    res.json({
      year,
      budgets: rows.map((r) => {
        const budget = parseFloat(r.budget) || 0;
        const spent = parseFloat(r.spent) || 0;
        return {
          category_id: r.category_id,
          name: r.name,
          budget,
          spent,
          remaining: budget - spent,
          used_pct: budget > 0 ? parseFloat(((spent / budget) * 100).toFixed(1)) : null,
        };
      }),
    });
  } catch (err) {
    console.error('Budgets error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/budgets  { category_id, year, amount }  (upsert)
router.post('/', staff, async (req, res) => {
  const { category_id, year, amount } = req.body || {};
  if (!category_id || !year || amount === undefined || isNaN(amount)) {
    return res.status(400).json({ error: 'category_id, year and a numeric amount are required' });
  }
  try {
    const { rows } = await query(
      `INSERT INTO category_budgets (category_id, budget_year, amount, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (category_id, budget_year) DO UPDATE
         SET amount = EXCLUDED.amount, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [category_id, +year, Number(amount)]
    );
    res.json({ budget: rows[0] });
  } catch (err) {
    console.error('Budget save error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/budgets/:categoryId/:year
router.delete('/:categoryId/:year', staff, async (req, res) => {
  try {
    await query(
      `DELETE FROM category_budgets WHERE category_id = $1 AND budget_year = $2`,
      [req.params.categoryId, req.params.year]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Budget delete error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
