const { Client } = require('pg');

// ️ REPLACE THESE WITH YOUR ACTUAL CONNECTION STRINGS
const LOCAL_DB = 'postgres://postgres:postgres@localhost:5432/estate_cashflow';
const NEON_DB = 'postgresql://neondb_owner:npg_Q3R0qvZPlOGw@ep-silent-recipe-b8xscdhr-pooler.c-14.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const TABLES_TO_MIGRATE = [
  'categories', 'members', 'users', 'contributions', 'payments', 'expenses', 'audit_logs'
];

async function smartMigrate() {
  const localClient = new Client({ connectionString: LOCAL_DB });
  const neonClient = new Client({ connectionString: NEON_DB });

  try {
    console.log('🔌 Connecting to databases...');
    await localClient.connect();
    await neonClient.connect();

    for (const table of TABLES_TO_MIGRATE) {
      console.log(`\n🔄 Processing table: ${table}...`);

      // 1. Get Schema from Local DB
      const localSchemaRes = await localClient.query(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1`, [table]
      );
      const localCols = localSchemaRes.rows;

      if (localCols.length === 0) {
        console.log(`   ⚠️ Table '${table}' not found locally. Skipping.`);
        continue;
      }

      // 2. Get Schema from Neon DB
      const neonSchemaRes = await neonClient.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1`, [table]
      );
      const neonColNames = neonSchemaRes.rows.map(r => r.column_name);

      // 3. Find missing columns in Neon and add them automatically
      const missingCols = localCols.filter(c => !neonColNames.includes(c.column_name));
      
      if (missingCols.length > 0) {
        console.log(`   🛠️ Adding ${missingCols.length} missing columns to Neon...`);
        for (const col of missingCols) {
          try {
            // We default to TEXT if the type is complex, otherwise use the exact type
            let type = col.data_type;
            if (type === 'ARRAY') type = 'TEXT'; // Simple fallback for arrays
            
            await neonClient.query(`ALTER TABLE ${table} ADD COLUMN ${col.column_name} ${type}`);
            console.log(`      + Added column: ${col.column_name} (${type})`);
          } catch (err) {
            console.log(`      ️ Could not add ${col.column_name} automatically. Trying as TEXT...`);
            try {
                await neonClient.query(`ALTER TABLE ${table} ADD COLUMN ${col.column_name} TEXT`);
            } catch(e) { console.log(`      ❌ Failed to add ${col.column_name}`); }
          }
        }
      } else {
        console.log(`   ✅ Schema matches!`);
      }

      // 4. Migrate Data
      const dataRes = await localClient.query(`SELECT * FROM ${table}`);
      const rows = dataRes.rows;

      if (rows.length === 0) {
        console.log(`   -> No data found. Skipping.`);
        continue;
      }

      const colString = localCols.map(c => c.column_name).join(', ');
      let successCount = 0;

      for (const row of rows) {
        const values = localCols.map(col => {
          const val = row[col.column_name];
          if (val === null) return 'NULL';
          if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
          if (val instanceof Date) return `'${val.toISOString()}'`;
          return val;
        });

        const insertQuery = `INSERT INTO ${table} (${colString}) VALUES (${values.join(', ')}) ON CONFLICT DO NOTHING;`;
        
        try {
          await neonClient.query(insertQuery);
          successCount++;
        } catch (err) {
          console.error(`   ❌ Error inserting row in ${table}:`, err.message);
        }
      }
      console.log(`   ✅ Successfully migrated ${successCount} rows to ${table}.`);
    }

    console.log('\n🎉 Migration Complete!');

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    await localClient.end();
    await neonClient.end();
  }
}

smartMigrate();