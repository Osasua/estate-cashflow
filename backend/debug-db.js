const { query } = require('./src/db');

async function debug() {
  console.log('🔍 Checking Database for October Contributions...\n');

  // 1. Check what period_month values exist
  const months = await query(`
    SELECT period_month, period_year, COUNT(*) 
    FROM contributions 
    GROUP BY period_month, period_year 
    ORDER BY period_year DESC, period_month DESC
  `);
  console.log('📅 Contributions by Month/Year:', months.rows);

  // 2. Check the 'type' column values
  const types = await query(`SELECT DISTINCT type FROM contributions`);
  console.log('️ Distinct Types in DB:', types.rows.map(r => r.type));

  process.exit();
}

debug();