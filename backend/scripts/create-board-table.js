// Migration: Ferrano Board — resident notices & events
// Run: DATABASE_URL=... node scripts/create-board-table.js
const { Client } = require('pg');
require('dotenv').config();

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS board_posts (
      id SERIAL PRIMARY KEY,
      author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      author_name TEXT NOT NULL,
      author_role TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('notice', 'event')),
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      event_date DATE,
      event_time TEXT,
      location TEXT,
      pinned BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_board_posts_created ON board_posts(created_at DESC);
  `);
  console.log('✅ board_posts table created');
  await client.end();
})().catch((e) => { console.error('❌ Migration failed:', e.message); process.exit(1); });
