const { Client } = require('pg');

// ⚠️ REPLACE THESE WITH YOUR ACTUAL CONNECTION STRINGS
const LOCAL_DB = 'postgres://postgres:postgres@localhost:5432/estate_cashflow';
const NEON_DB = 'postgresql://neondb_owner:npg_Q3R0qvZPlOGw@ep-silent-recipe-b8xscdhr-pooler.c-14.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const TABLES = ['categories', 'members', 'users', 'contributions', 'payments', 'expenses', 'audit_logs'];

// Helper to map PG types to simple SQL types
const mapType = (type) => {
  if (type.includes('int')) return 'INTEGER';
  if (type.includes('bool')) return 'BOOLEAN';
  if (type.includes('numeric') || type.includes('decimal')) return 'NUMERIC';
  if (type.includes('timestamp')) return 'TIMESTAMP';
  if (type.includes('date')) return 'DATE';
  return 'TEXT'; // Safe fallback
};

async function run() {
  const local = new Client({ connectionString: LOCAL_DB });
  const neon = new Client({ connectionString: NEON_DB });

  try {
    console.log('🔌 Connecting...');
    await local.connect();
    await neon.connect();

    for (const table of TABLES) {
      console.log(`\n🔄 Syncing table: ${table}...`);

      // 1. Get Local Schema
      const localCols = await local.query(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1`, [table]
      );

      if (localCols.rows.length === 0) {
        console.log(`   ⚠️ Table '${table}' not found locally.`);
        continue;
      }

      // 2. Get Neon Schema
      const neonCols = await neon.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1`, [table]
      );
      const neonColNames = neonCols.rows.map(r => r.column_name);

      // 3. Add Missing Columns to Neon
      for (const col of localCols.rows) {
        if (!neonColNames.includes(col.column_name)) {
          const sqlType = mapType(col.data_type);
          try {
            // Try adding with correct type
            await neon.query(`ALTER TABLE ${table} ADD COLUMN ${col.column_name} ${sqlType}`);
            console.log(`    Added column: ${col.column_name} (${sqlType})`);
          } catch (e) {
            // Fallback to TEXT if type fails (e.g. complex enums/arrays)
            try {
              await neon.query(`ALTER TABLE ${table} ADD COLUMN ${col.column_name} TEXT`);
              console.log(`   ➕ Added column: ${col.column_name} (as TEXT fallback)`);
            } catch (e2) {
              console.log(`   ❌ Could not add ${col.column_name}`);
            }
          }
        }
      }

      // 4. Migrate Data
      const data = await local.query(`SELECT * FROM ${table}`);
      if (data.rows.length === 0) {
        console.log(`   -> No data.`);
        continue;
      }

      const colNames = localCols.rows.map(c => c.column_name).join(', ');
      let count = 0;

      for (const row of data.rows) {
        const vals = localCols.rows.map(c => {
          const v = row[c.column_name];
          if (v === null) return 'NULL';
          if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
          if (v instanceof Date) return `'${v.toISOString()}'`;
          return v;
        });

        try {
          await neon.query(`INSERT INTO ${table} (${colNames}) VALUES (${vals.join(', ')}) ON CONFLICT DO NOTHING`);
          count++;
        } catch (err) {
          // Ignore duplicate key errors, print others
          if (!err.message.includes('duplicate key')) {
             console.log(`   ⚠️ Row error in ${table}: ${err.message}`);
          }
        }
      }
      console.log(`   ✅ Migrated ${count} rows.`);
    }
    console.log('\n🎉 ALL DONE!');
  } catch (err) {
    console.error('❌ FATAL ERROR:', err.message);
  } finally {
    await local.end();
    await neon.end();
  }
}

run();