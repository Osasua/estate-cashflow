const { Client } = require('pg');
require('dotenv').config();

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS estate_opening_balance (
        id SERIAL PRIMARY KEY,
        opening_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
        effective_date DATE NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert default row if table is empty
    const checkResult = await client.query('SELECT COUNT(*) FROM estate_opening_balance');
    if (parseInt(checkResult.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO estate_opening_balance (opening_balance, effective_date, notes)
        VALUES (0, '2026-01-01', 'System initialized')
      `);
      console.log('✅ Created estate_opening_balance table with default row');
    } else {
      console.log('✅ estate_opening_balance table already exists');
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
})();