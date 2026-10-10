   const { query } = require('./src/db');
async function check() {
  const res = await query('SELECT * FROM categories LIMIT 1');
  console.log('Columns:', Object.keys(res.rows[0]));
  console.log('Sample row:', res.rows[0]);
  process.exit();
}
check();