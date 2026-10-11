const { Client } = require('pg');
require('dotenv').config();

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function updateSchema() {
  await client.connect();
  console.log('Updating users table...');

  try {
    // Add move_in_date (defaults to today for existing users)
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS move_in_date DATE DEFAULT CURRENT_DATE,
      ADD COLUMN IF NOT EXISTS move_out_date DATE;
    `);
    console.log('✅ Successfully added move_in_date and move_out_date columns!');
  } catch (err) {
    console.error('❌ Error updating schema:', err.message);
  }

  await client.end();
}

updateSchema();