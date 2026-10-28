// Migration: add the secretary role
// Run: DATABASE_URL=... node scripts/add-secretary-role.js
const { Client } = require('pg');
require('dotenv').config();

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'secretary'`);
  console.log("✅ user_role now includes 'secretary'");
  await client.end();
})().catch((e) => { console.error('❌ Migration failed:', e.message); process.exit(1); });
