const { Client } = require('pg');
require('dotenv').config();

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const { rows } = await client.query(
    `SELECT id, opening_balance FROM members WHERE COALESCE(opening_balance, 0) > 0`
  );
  const lastYear = new Date().getFullYear() - 1;
  for (const m of rows) {
    await client.query(
      `INSERT INTO contributions (member_id, type, period_year, period_month, amount_due, amount_paid)
       VALUES ($1, 'arrears', $2, 12, $3, 0)
       ON CONFLICT (member_id, type, period_year, period_month) DO NOTHING`,
      [m.id, lastYear, m.opening_balance]
    );
    // Optional: zero out the old column since the contributions table is now the source of truth
    await client.query(`UPDATE members SET opening_balance = 0 WHERE id = $1`, [m.id]);
    console.log(`✅ Migrated member ${m.id}: ₦${Number(m.opening_balance).toLocaleString()} → arrears row`);
  }
  console.log(`Done. ${rows.length} member(s) migrated.`);
  await client.end();
})().catch((e) => { console.error('❌', e.message); process.exit(1); });