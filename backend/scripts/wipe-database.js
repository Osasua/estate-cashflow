const { Client } = require('pg');
require('dotenv').config();

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function wipeDatabase() {
  await client.connect();
  console.log('🧨 Starting database wipe...');

  // We use TRUNCATE CASCADE to wipe the tables and reset ID counters to 1
  // Order doesn't strictly matter with CASCADE, but this is logical.
  const tables = ['audit_logs', 'expenses', 'payments', 'contributions', 'categories', 'users'];
  
  for (const table of tables) {
    try {
      await client.query(`TRUNCATE TABLE ${table} CASCADE`);
      console.log(`✅ Cleared table: ${table}`);
    } catch (err) {
      console.log(`⚠️ Could not clear ${table} (it might not exist yet): ${err.message}`);
    }
  }

  console.log('\n🎉 Database is completely clean!');
  await client.end();
}

wipeDatabase().catch(console.error);