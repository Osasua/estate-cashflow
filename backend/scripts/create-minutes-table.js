const { Client } = require('pg');
require('dotenv').config();

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS meeting_minutes (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        meeting_date DATE NOT NULL,
        content TEXT NOT NULL,
        document_link TEXT,
        created_by INT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ meeting_minutes table created successfully');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
})();