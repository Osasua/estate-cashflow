const { Client } = require('pg');
require('dotenv').config();

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log('🔍 Finding inactive members with future bills...\n');

  // Find all inactive members
  const { rows: inactiveMembers } = await client.query(
    `SELECT id, house_number, household_name FROM members WHERE active = false`
  );

  let totalDeleted = 0;

  for (const member of inactiveMembers) {
    // Find their contributions from May 2026 onwards (after they moved out)
    const { rows: futureBills, rowCount } = await client.query(
      `DELETE FROM contributions 
         WHERE member_id = $1 
           AND type = 'monthly'
           AND (period_year > 2026 OR (period_year = 2026 AND period_month >= 5))
         RETURNING period_year, period_month`,
      [member.id]
    );

    if (rowCount > 0) {
      const months = futureBills.map(b => `${b.period_month}/${b.period_year}`).join(', ');
      console.log(`✅ House ${member.house_number} (${member.household_name}): Deleted ${rowCount} bill(s) for months: ${months}`);
      totalDeleted += rowCount;
    }
  }

  console.log(`\n Cleanup complete! Deleted ${totalDeleted} future bill(s) for inactive members.`);
  await client.end();
})().catch((e) => {
  console.error('❌ Cleanup failed:', e.message);
  process.exit(1);
});