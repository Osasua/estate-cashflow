/**
 * Migration: per-category annual budgets.
 * Idempotent — safe to re-run.
 *
 *   node scripts/create-category-budgets-table.js
 */
const { Client } = require('pg');
require('dotenv').config();

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS category_budgets (
        id SERIAL PRIMARY KEY,
        category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
        budget_year INTEGER NOT NULL,
        amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (category_id, budget_year)
      )
    `);
    console.log('✅ category_budgets table ready');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
