const { Client } = require('pg');
require('dotenv').config();

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const types = ['monthly', 'float', 'projects', 'end-of-year', 'welfare', 'arrears'];
  
  for (const type of types) {
    try {
      await client.query(`ALTER TYPE contribution_type ADD VALUE '${type}'`);
      console.log(`✅ Added '${type}' to contribution_type enum`);
    } catch (e) {
      if (e.code === '42710') {
        console.log(`️  '${type}' already exists`);
      } else {
        console.error(`❌ Failed to add '${type}':`, e.message);
      }
    }
  }

  console.log('\n🎉 All contribution types are now ready!');
  await client.end();
})();