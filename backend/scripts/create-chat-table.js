// Migration: Community chat room
// Run: DATABASE_URL=... node scripts/create-chat-table.js
const { Client } = require('pg');
require('dotenv').config();

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id BIGSERIAL PRIMARY KEY,
      author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      author_name TEXT NOT NULL,
      author_role TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      image_mime TEXT,
      image_data TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_chat_messages_id ON chat_messages(id);
  `);
  console.log('✅ chat_messages table created');
  await client.end();
})().catch((e) => { console.error('❌ Migration failed:', e.message); process.exit(1); });
