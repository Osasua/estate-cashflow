const { query } = require('./src/db');

async function fixEnumAndUpdate() {
  try {
    console.log('1. Adding "end-of-year" to the database ENUM...');
    
    // Add the new value to the ENUM type
    try {
        await query(`ALTER TYPE contribution_type ADD VALUE 'end-of-year';`);
        console.log('   -> ENUM updated successfully.');
    } catch (e) {
        if (e.message.includes('already exists')) {
            console.log('   -> Value already exists in ENUM (skipping).');
        } else {
            throw e;
        }
    }

    console.log('2. Updating existing "christmas" records to "end-of-year"...');
    
    // Now update the actual data
    const result = await query(`
      UPDATE contributions 
      SET type = 'end-of-year' 
      WHERE type = 'christmas'
    `);
    
    console.log(`   -> Successfully updated ${result.rowCount} record(s)!`);
    console.log('✅ All done!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixEnumAndUpdate();