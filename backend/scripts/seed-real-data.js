const { Client } = require('pg');
require('dotenv').config();

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function loadRealData() {
  await client.connect();
  console.log('Loading real data...');

  // 1. INSERT CATEGORIES (If you cleared them in Step 2)
  // await client.query(`INSERT INTO categories (name) VALUES ('Security'), ('Cleaning'), ('Repairs'), ('Diesel/Power')`);

  // 2. INSERT REAL EXPENSES (Example for 2025 and 2026)
  // Format: (date, category_id, description, amount)
  // Note: You'll need to find the actual ID of your categories from the database, 
  // or just use the category name if your table is set up that way.
  
  const realExpenses = [
    // ['2025-01-15', 1, 'January Security Payment', 50000],
    // ['2025-02-10', 2, 'February Cleaning Supplies', 15000],
    // ['2026-01-05', 1, 'January 2026 Security', 55000],
    // Add all your real expenses here...
  ];

  for (const exp of realExpenses) {
    await client.query(
      `INSERT INTO expenses (date, category_id, description, amount) VALUES ($1, $2, $3, $4)`,
      exp
    );
  }
  console.log(`✅ Loaded ${realExpenses.length} expenses.`);

  // 3. INSERT REAL CONTRIBUTIONS
  // Format: (date, user_id, amount, month_covered)
  const realContributions = [
    // ['2025-01-05', 2, 10000, '2025-01'], // user_id 2 is likely the treasurer
    // ['2025-02-05', 2, 10000, '2025-02'],
    // Add all your real contributions here...
  ];

  for (const cont of realContributions) {
    await client.query(
      `INSERT INTO contributions (date, user_id, amount, month_covered) VALUES ($1, $2, $3, $4)`,
      cont
    );
  }
  console.log(`✅ Loaded ${realContributions.length} contributions.`);

  await client.end();
  console.log('🎉 Real data loading complete!');
}

loadRealData().catch(console.error);