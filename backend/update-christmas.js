const { query } = require('./src/db');

async function updateContributionType() {
  try {
    console.log(' Updating "christmas" to "end-of-year" in contributions...');
    
    // Update contributions table directly
    const result = await query(`
      UPDATE contributions 
      SET type = 'end-of-year' 
      WHERE type = 'christmas'
    `);
    
    console.log(`✅ Successfully updated ${result.rowCount} contribution(s)!`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

updateContributionType();