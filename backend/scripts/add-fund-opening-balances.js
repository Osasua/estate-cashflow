/**
 * Migration: per-fund opening balances.
 *
 * Creates fund_opening_balances and, on first run, seeds the 'estate' row from
 * the legacy estate_opening_balance table so existing figures are preserved.
 * Idempotent — safe to re-run.
 *
 *   node scripts/add-fund-opening-balances.js
 */
const { Client } = require('pg');
require('dotenv').config();

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS fund_opening_balances (
        fund_type       TEXT PRIMARY KEY,
        opening_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
        effective_date  DATE NOT NULL DEFAULT '2026-01-01',
        notes           TEXT,
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const existing = await client.query(`SELECT COUNT(*)::int AS n FROM fund_opening_balances`);
    if (existing.rows[0].n === 0) {
      const legacy = await client.query(
        `SELECT opening_balance, effective_date, notes FROM estate_opening_balance WHERE id = 1`
      );
      const row = legacy.rows[0];
      await client.query(
        `INSERT INTO fund_opening_balances (fund_type, opening_balance, effective_date, notes)
         VALUES ('estate', $1, $2, $3)`,
        [
          row ? row.opening_balance : 0,
          row ? row.effective_date : '2026-01-01',
          row ? row.notes : 'Migrated from estate_opening_balance',
        ]
      );
      console.log('✅ Created fund_opening_balances; migrated estate opening from legacy table');
    } else {
      console.log('✅ fund_opening_balances already present');
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
