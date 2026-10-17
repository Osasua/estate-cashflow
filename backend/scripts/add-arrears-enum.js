const { Client } = require('pg');
require('dotenv').config();

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`ALTER TYPE contribution_type ADD VALUE 'arrears'`);
    console.log('✅ Successfully added "arrears" to contribution_type enum');
  } catch (e) {
    if (e.code === '42710') {
      console.log('️ "arrears" already exists in enum');
    } else {
      console.error('❌ Error:', e.message);
    }
  }
  await client.end();
})();