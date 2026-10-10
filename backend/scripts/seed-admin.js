const { Client } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function seedAdmin() {
  await client.connect();
  console.log('👤 Creating fresh Admin and Treasurer accounts...');

  const newPassword = 'Admin123!'; // <-- Change this if you want a different password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  try {
    // 1. Create Admin
    await client.query(
      `INSERT INTO users (name, email, password_hash, role) 
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET password_hash = $3, role = $4`,
      ['Estate Admin', 'admin@estate.local', hashedPassword, 'admin']
    );
    console.log('✅ Admin created/updated (admin@estate.local)');

    // 2. Create Treasurer
    await client.query(
      `INSERT INTO users (name, email, password_hash, role) 
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET password_hash = $3, role = $4`,
      ['Estate Treasurer', 'treasurer@estate.local', hashedPassword, 'treasurer']
    );
    console.log('✅ Treasurer created/updated (treasurer@estate.local)');

  } catch (err) {
    console.error(' Error creating users:', err.message);
  }

  await client.end();
  console.log('\n Setup complete! You can now log in.');
}

seedAdmin().catch(console.error);