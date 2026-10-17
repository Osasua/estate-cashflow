const { Client } = require('pg');
require('dotenv').config();

(async () => {
  console.log('⚠️  WARNING: This will DELETE ALL payment and contribution records!');
  console.log('Press Ctrl+C now to cancel, or wait 3 seconds to proceed...\n');
  
  // Give you 3 seconds to cancel if you ran this by accident
  await new Promise(resolve => setTimeout(resolve, 3000));

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    console.log('🗑️  Deleting all payment records...');
    await client.query('DELETE FROM payments');
    
    console.log('🗑️  Deleting all contribution records...');
    await client.query('DELETE FROM contributions');
    
    console.log('🗑️  Resetting all member opening balances to 0...');
    await client.query('UPDATE members SET opening_balance = 0');

    console.log('🎉 Cleanup complete! The system is now a clean slate.');
  } catch (e) {
    console.error('❌ Cleanup failed:', e.message);
  } finally {
    await client.end();
  }
})();