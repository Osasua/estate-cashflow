const { Client } = require('pg');
require('dotenv').config();

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function clearData() {
  await client.connect();
  console.log('Connected to database. Starting cleanup...');

  // ⚠️ REPLACE THESE TABLE NAMES with the actual names from your seed.js file!
  // The order matters (delete children before parents if you have foreign keys)
  await client.query('DELETE FROM contributions');
  await client.query('DELETE FROM expenses');
  await client.query('DELETE FROM categories'); // Only if you want to reset categories too

  console.log('✅ Test data cleared successfully!');
  await client.end();
}

clearData().catch(console.error);