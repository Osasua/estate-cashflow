const { query } = require('./src/db'); // Adjust path if needed

async function fixDatabase() {
  console.log('🔧 Starting database fixes...');

  try {
    // 1. Check if 'contribution_type' enum exists
    const checkEnum = await query(`
      SELECT typname FROM pg_type WHERE typname = 'contribution_type';
    `);

    if (checkEnum.rows.length > 0) {
      console.log('✅ ENUM found. Adding missing values...');
      
      // Add values to ENUM if they don't exist
      await query(`ALTER TYPE contribution_type ADD VALUE IF NOT EXISTS 'Monthly';`);
      await query(`ALTER TYPE contribution_type ADD VALUE IF NOT EXISTS 'Float';`);
      await query(`ALTER TYPE contribution_type ADD VALUE IF NOT EXISTS 'Projects';`);
      await query(`ALTER TYPE contribution_type ADD VALUE IF NOT EXISTS 'Christmas';`);
      await query(`ALTER TYPE contribution_type ADD VALUE IF NOT EXISTS 'Welfare';`);
      
      console.log('✅ ENUM updated.');
    } else {
      console.log('ℹ️ No ENUM found. Assuming regular TEXT column.');
    }

    // 2. Update NULL types to 'Monthly'
    const updateRes = await query(`
      UPDATE contributions 
      SET type = 'Monthly' 
      WHERE type IS NULL;
    `);
    
    console.log(`✅ Updated ${updateRes.rowCount} existing contributions to 'Monthly'.`);

    // 3. Verify data
    const verify = await query(`
      SELECT type, COUNT(*) as count 
      FROM contributions 
      GROUP BY type;
    `);
    
    console.log('\n📊 Current Contribution Types:');
    console.table(verify.rows);

    console.log('\n✨ Database fixed successfully! Restart your backend now.');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error fixing database:', error.message);
    process.exit(1);
  }
}

fixDatabase();