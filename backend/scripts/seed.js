require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const { pool } = require('../src/db');

const CATEGORIES = [
  'Security', 'Waste Management', 'Electricity', 'Water',
  'Repairs & Maintenance', 'Cleaning', 'Fuel & Diesel', 'Miscellaneous',
];
const AMOUNTS = [5000, 7500, 10000, 15000, 20000, 35000, 50000, 80000];

async function main() {
  const hash = bcrypt.hashSync(process.env.SEED_PASSWORD || 'ChangeMe123!', 10);

  // 1. Seed Members FIRST (So we can link users to them later)
  const { rows: [{ n }] } = await pool.query('SELECT COUNT(*)::int AS n FROM members');
  if (n === 0) {
    for (let i = 1; i <= 18; i++) {
      const hn = String(i).padStart(3, '0');
      await pool.query(
        `INSERT INTO members (household_name, house_number, phone, email, monthly_due)
         VALUES ($1, $2, $3, $4, 10000)`,
        [`Household ${hn}`, hn, `0803${String(1000000 + i)}`, `house${hn}@estate.local`]
      );
    }
    console.log('✅ Created 18 member households.');
  }

  // 2. Seed Users (Now linking the resident to Household 001)
  // First, get the ID of Household 001
  const { rows: [house001] } = await pool.query('SELECT id FROM members WHERE house_number = $1', ['001']);
  const residentMemberId = house001 ? house001.id : null;

  await pool.query(
    `INSERT INTO users (name, email, password_hash, role, member_id) VALUES
       ('Estate Admin', 'admin@estate.local', $1, 'admin', NULL),
       ('Estate Treasurer', 'treasurer@estate.local', $1, 'treasurer', NULL),
       ('John Resident', 'resident1@estate.local', $1, 'member', $2)
     ON CONFLICT (email) DO NOTHING`,
    [hash, residentMemberId]
  );
  console.log('✅ Created users (Admin, Treasurer, and Resident linked to House 001).');

  // 3. Seed Categories
  for (const name of CATEGORIES) {
    await pool.query(
      'INSERT INTO categories (name, is_active) VALUES ($1, true) ON CONFLICT (name) DO NOTHING', 
      [name]
    );
  }

  // 4. Seed Contributions & Payments
  const now = new Date();
  for (let back = 3; back >= 0; back--) {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const y = d.getFullYear(), m = d.getMonth() + 1;

    await pool.query(
      `INSERT INTO contributions (member_id, type, period_year, period_month, amount_due)
         SELECT id, 'monthly', $1, $2, monthly_due FROM members WHERE active
       ON CONFLICT (member_id, type, period_year, period_month) DO NOTHING`,
      [y, m]
    );

    await pool.query(
      `INSERT INTO contributions (member_id, type, period_year, period_month, amount_due)
         SELECT id, 'projects', $1, $2, 25000 FROM members WHERE active AND id % 3 = 0
       ON CONFLICT (member_id, type, period_year, period_month) DO NOTHING`,
      [y, m]
    );

    const { rows: contribs } = await pool.query(
      'SELECT id, amount_due FROM contributions WHERE period_year = $1 AND period_month = $2', [y, m]);
    
    for (const c of contribs) {
      const roll = Math.random();
      if (roll < 0.78) {
        await pool.query('UPDATE contributions SET amount_paid = amount_due WHERE id = $1', [c.id]);
        await pool.query(
          `INSERT INTO payments (contribution_id, amount, method) VALUES ($1, $2, 'transfer')`, 
          [c.id, c.amount_due]
        );
      } else if (roll < 0.86) {
        await pool.query('UPDATE contributions SET amount_paid = 5000 WHERE id = $1', [c.id]);
        await pool.query(
          `INSERT INTO payments (contribution_id, amount, method) VALUES ($1, 5000, 'cash')`, [c.id]);
      }
    }

    const daysInMonth = new Date(y, m, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      if (back === 0 && day > now.getDate()) break;
      if (Math.random() < 0.25) continue;
      
      const catResult = await pool.query('SELECT id FROM categories WHERE is_active = true ORDER BY random() LIMIT 1');
      if(catResult.rows.length > 0) {
          const cat = catResult.rows[0];
          await pool.query(
            `INSERT INTO expenses (category_id, amount, description, vendor, spent_on)
             VALUES ($1, $2, $3, $4, $5)`,
            [cat.id, AMOUNTS[Math.floor(Math.random() * AMOUNTS.length)],
             `Expense for ${cat.name}`, `Vendor ${1 + Math.floor(Math.random() * 5)}`,
             new Date(y, m - 1, day)]
          );
      }
    }
  }
  console.log('✅ Seed complete.');
}

main().then(() => {
  console.log('🎉 Database seeding finished successfully!');
  pool.end();
}).catch((e) => { 
  console.error('❌ Seeding failed:', e); 
  process.exit(1); 
});