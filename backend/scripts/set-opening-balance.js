const { Client } = require('pg');
require('dotenv').config();

// Usage: node set-opening-balance.js <amount> <date> [notes]
const amount = process.argv[2];
const date = process.argv[3] || '2026-01-01';
const notes = process.argv[4] || 'Manual opening balance entry';

if (!amount) {
  console.log('Usage: node set-opening-balance.js <amount> [date] [notes]');
  console.log('Example: node set-opening-balance.js 500000 2026-01-01 "Initial estate fund"');
  process.exit(1);
}

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const result = await client.query(`
      UPDATE estate_opening_balance 
      SET opening_balance = $1, effective_date = $2, notes = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
      RETURNING *
    `, [amount, date, notes]);

    console.log(`✅ Opening balance set to ₦${Number(amount).toLocaleString()} effective ${date}`);
    console.log(`   Notes: ${notes}`);
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
})();