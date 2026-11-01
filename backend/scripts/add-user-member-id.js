/**
 * Migration: users.member_id (+ move dates) — the link between a login and
 * its household. schema.sql always had it implied (seed.js inserts it and
 * My Account resolves the household through it) but nothing ever created it
 * on databases built from schema.sql alone.
 * Idempotent — safe to re-run.
 *
 *   node scripts/add-user-member-id.js
 */
const { Client } = require('pg');
require('dotenv').config();

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS member_id INTEGER,
        ADD COLUMN IF NOT EXISTS move_in_date DATE,
        ADD COLUMN IF NOT EXISTS move_out_date DATE
    `);
    console.log('✅ users.member_id / move dates ready');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
