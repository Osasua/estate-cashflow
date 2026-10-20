const { Client } = require('pg');
require('dotenv').config();

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query(`ALTER TABLE contributions ADD COLUMN IF NOT EXISTS note TEXT`);
    console.log('✅ Added note column to contributions table');
  } catch (e) {
    console.error(' Error:', e.message);
  }

  await client.end();
})();