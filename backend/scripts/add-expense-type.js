// Migration: associate every expense with the contribution type (fund) that
// paid for it. Existing expenses default to 'monthly', matching current
// behaviour ("only Monthly has expenses today").
//
// Run: DATABASE_URL=... node scripts/add-expense-type.js
const { Client } = require('pg');
require('dotenv').config();

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  await client.query(`
    ALTER TABLE expenses
      ADD COLUMN IF NOT EXISTS type contribution_type NOT NULL DEFAULT 'monthly'
  `);
  console.log('✅ expenses.type added — existing rows set to \'monthly\'');

  await client.end();
})().catch((e) => {
  console.error('❌ Migration failed:', e.message);
  process.exit(1);
});
