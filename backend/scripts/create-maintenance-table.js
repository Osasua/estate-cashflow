/**
 * Migration: maintenance requests (member self-service).
 * Idempotent — safe to re-run.
 *
 *   node scripts/create-maintenance-table.js
 */
const { Client } = require('pg');
require('dotenv').config();

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS maintenance_requests (
        id SERIAL PRIMARY KEY,
        member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'new'
          CHECK (status IN ('new', 'in-progress', 'resolved')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_maintenance_member ON maintenance_requests(member_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_requests(status)`);
    console.log('✅ maintenance_requests table ready');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
