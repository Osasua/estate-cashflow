const { Client } = require('pg');
require('dotenv').config();

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log('🔍 DIAGNOSTIC: Checking for data before 2026...\n');

  // 1. Check contributions before 2026
  const contribResult = await client.query(`
    SELECT period_year, period_month, COUNT(*) AS count, SUM(amount_paid) AS total
    FROM contributions 
    WHERE period_year < 2026 
    GROUP BY period_year, period_month
    ORDER BY period_year, period_month
  `);

  if (contribResult.rows.length > 0) {
    console.log('📊 Contributions before 2026:');
    contribResult.rows.forEach(row => {
      console.log(`   - ${row.period_year}/${row.period_month}: ${row.count} records, ₦${Number(row.total).toLocaleString()}`);
    });
  } else {
    console.log('✅ No contributions before 2026');
  }

  // 2. Check expenses before Jan 2026
  const expenseResult = await client.query(`
    SELECT spent_on::date AS date, COUNT(*) AS count, SUM(amount) AS total
    FROM expenses 
    WHERE spent_on < '2026-01-01'
    GROUP BY spent_on
    ORDER BY spent_on
  `);

  if (expenseResult.rows.length > 0) {
    console.log('\n Expenses before Jan 2026:');
    expenseResult.rows.forEach(row => {
      console.log(`   - ${row.date}: ${row.count} records, ₦${Number(row.total).toLocaleString()}`);
    });
  } else {
    console.log('\n✅ No expenses before Jan 2026');
  }

  // 3. Check for payments linked to old contributions
  const paymentResult = await client.query(`
    SELECT COUNT(*) AS count, SUM(amount) AS total
    FROM payments p
    JOIN contributions c ON p.contribution_id = c.id
    WHERE c.period_year < 2026
  `);

  if (paymentResult.rows[0].count > 0) {
    console.log(`\n💳 Payments linked to old contributions: ${paymentResult.rows[0].count} records, ₦${Number(paymentResult.rows[0].total).toLocaleString()}`);
  } else {
    console.log('\n✅ No payments linked to old contributions');
  }

  // 4. Ask for confirmation before deleting
  if (contribResult.rows.length > 0 || expenseResult.rows.length > 0 || paymentResult.rows[0].count > 0) {
    console.log('\n️  Found old data that needs cleanup.');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to proceed with deletion...\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('🗑️  Deleting old data...\n');

    // Delete payments linked to old contributions FIRST (foreign key dependency)
    const deletePaymentResult = await client.query(`
      DELETE FROM payments 
      WHERE contribution_id IN (SELECT id FROM contributions WHERE period_year < 2026)
    `);
    console.log(`✅ Deleted ${deletePaymentResult.rowCount} payment record(s) linked to old contributions`);

    // Delete contributions before 2026
    const deleteContribResult = await client.query(`
      DELETE FROM contributions WHERE period_year < 2026
    `);
    console.log(`✅ Deleted ${deleteContribResult.rowCount} contribution record(s) before 2026`);

    // Delete expenses before Jan 2026
    const deleteExpenseResult = await client.query(`
      DELETE FROM expenses WHERE spent_on < '2026-01-01'
    `);
    console.log(`✅ Deleted ${deleteExpenseResult.rowCount} expense record(s) before Jan 2026`);

    console.log('\n✨ Cleanup complete! Refresh your Reports page to see 0.00 opening balance.');
  } else {
    console.log('\n✨ No cleanup needed. Your data is clean!');
  }

  await client.end();
})().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});