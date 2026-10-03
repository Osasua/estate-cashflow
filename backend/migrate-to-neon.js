const { Client } = require('pg');

// ️ REPLACE THESE WITH YOUR ACTUAL CONNECTION STRINGS
// 1. Your local database connection (from your current .env)
const LOCAL_DB = 'postgres://postgres:postgres@localhost:5432/estate_cashflow';

// 2. Your new Neon connection string (from Step 1)
const NEON_DB = 'postgresql://neondb_owner:npg_Q3R0qvZPlOGw@ep-silent-recipe-b8xscdhr-pooler.c-14.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

// Tables to migrate (Order matters for Foreign Keys!)
const TABLES_TO_MIGRATE = [
  'categories',
  'members',
  'users', 
    'contributions', 
  'payments', 
  'expenses',
  'audit_logs' // Add any other tables you have here
];

async function migrate() {
  const localClient = new Client({ connectionString: LOCAL_DB });
  const neonClient = new Client({ connectionString: NEON_DB });

  try {
    console.log('🔌 Connecting to databases...');
    await localClient.connect();
    await neonClient.connect();

    // 1. Recreate the ENUM type in Neon (since we added 'end-of-year' locally)
    console.log('🔄 Setting up ENUM types in Neon...');
    await neonClient.query(`DO $$ BEGIN
      CREATE TYPE contribution_type AS ENUM ('monthly', 'float', 'projects', 'welfare', 'end-of-year');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`).catch(e => console.log('   -> ENUM setup note:', e.message));

    // 2. Migrate each table
    for (const table of TABLES_TO_MIGRATE) {
      console.log(`\n📦 Migrating table: ${table}...`);
      
      // Check if table exists locally
      const tableCheck = await localClient.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)`, [table]
      );
      
      if (!tableCheck.rows[0].exists) {
        console.log(`   ⚠️ Table '${table}' not found locally. Skipping.`);
        continue;
      }

      // Get columns dynamically
      const colRes = await localClient.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`, [table]
      );
      const columns = colRes.rows.map(r => r.column_name);
      const colString = columns.join(', ');

      // Fetch all data
      const dataRes = await localClient.query(`SELECT * FROM ${table}`);
      const rows = dataRes.rows;

      if (rows.length === 0) {
        console.log(`   -> No data found. Skipping.`);
        continue;
      }

      // Create table in Neon if it doesn't exist (Basic structure based on local)
      // Note: For a perfect schema match, we rely on the fact that Neon is empty. 
      // We will use a simple CREATE TABLE IF NOT EXISTS based on the first row's data types.
      // *In a real production app, you'd use a schema migration tool like Prisma or Drizzle.*
      
      // Insert data row by row to handle any complex types safely
      let successCount = 0;
      for (const row of rows) {
        const values = columns.map(col => {
          const val = row[col];
          if (val === null) return 'NULL';
          if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`; // Escape quotes
          if (val instanceof Date) return `'${val.toISOString()}'`;
          return val;
        });

        const insertQuery = `INSERT INTO ${table} (${colString}) VALUES (${values.join(', ')}) ON CONFLICT DO NOTHING;`;
        
        try {
          await neonClient.query(insertQuery);
          successCount++;
        } catch (err) {
          // If table doesn't exist in Neon yet, we have a problem. 
          // For this MVP migration, we assume you might need to run your local schema setup SQL in Neon first.
          console.error(`   ❌ Error inserting row in ${table}:`, err.message);
          console.log(`   -> Hint: You may need to run your CREATE TABLE SQL in the Neon SQL Editor first.`);
          return; 
        }
      }
      console.log(`   ✅ Successfully migrated ${successCount} rows to ${table}.`);
    }

    console.log('\n🎉 Migration Complete! Your data is now in Neon.');

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    await localClient.end();
    await neonClient.end();
  }
}

migrate();