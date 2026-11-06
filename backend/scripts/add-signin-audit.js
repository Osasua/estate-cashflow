const { Client } = require('pg');
require('dotenv').config();

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function updateSchema() {
  await client.connect();
  console.log('Updating users table for the sign-in audit trail...');

  try {
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS last_login_ip TEXT;
    `);
    console.log('✅ Successfully added last_login_at and last_login_ip columns!');
  } catch (err) {
    console.error('❌ Error updating schema:', err.message);
  }

  await client.end();
}

updateSchema();
