/**
 * Migration: reminder audit log + spam cooldown.
 * Idempotent — safe to re-run.
 *
 *   node scripts/create-payment-reminders-table.js
 */
const { Client } = require('pg');
require('dotenv').config();

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_reminders (
        id BIGSERIAL PRIMARY KEY,
        member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        contribution_id INTEGER NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
        channel TEXT NOT NULL DEFAULT 'email',
        fund TEXT,
        outstanding_at_send NUMERIC(12,2),
        sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_reminders_contribution ON payment_reminders(contribution_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_reminders_sent_at ON payment_reminders(sent_at)`);
    console.log('✅ payment_reminders table ready');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
