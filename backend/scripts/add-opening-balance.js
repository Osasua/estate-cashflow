   const { Client } = require('pg');
   require('dotenv').config();

   const client = new Client({ connectionString: process.env.DATABASE_URL });

   async function updateSchema() {
     await client.connect();
     console.log('Adding opening_balance column...');
     try {
       await client.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS opening_balance NUMERIC DEFAULT 0;`);
       console.log('✅ Successfully added opening_balance column!');
     } catch (err) {
       console.error(' Error:', err.message);
     }
     await client.end();
   }
   updateSchema();