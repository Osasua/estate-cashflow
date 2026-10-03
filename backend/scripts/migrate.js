require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/db');

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, '../src/schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('Schema applied.');
}

main().then(() => pool.end()).catch((e) => { console.error(e); process.exit(1); });
