const express = require('express');
const { query } = require('../db');
const { authenticate } = require('../auth');

const router = express.Router();
router.use(authenticate);

const isStaff = (u) => ['admin', 'treasurer'].includes(u?.role);
const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024; // 1.5 MB raw file
const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

// GET /api/chat?after=<id> — polling: messages newer than <id> (asc).
// Without ?after: the last 60 messages (asc) for the initial paint.
router.get('/', async (req, res) => {
  const after = parseInt(req.query.after, 10) || 0;
  try {
    if (after > 0) {
      const { rows } = await query(
        'SELECT * FROM chat_messages WHERE id > $1 ORDER BY id ASC LIMIT 100',
        [after]
      );
      return res.json({ messages: rows, latest_id: rows.length ? rows[rows.length - 1].id : after });
    }
    const { rows } = await query('SELECT * FROM chat_messages ORDER BY id DESC LIMIT 60');
    const msgs = rows.reverse();
    res.json({ messages: msgs, latest_id: msgs.length ? msgs[msgs.length - 1].id : 0 });
  } catch (err) {
    console.error('GET chat error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chat — text and/or one image (base64, <= 1.5 MB)
router.post('/', async (req, res) => {
  const { body = '', image } = req.body || {};
  const text = String(body || '').trim();
  if (!text && !image) return res.status(400).json({ error: 'Message needs text or an image.' });
  if (text.length > 2000) return res.status(400).json({ error: 'Messages are limited to 2000 characters.' });

  let mime = null;
  let data = null;
  if (image) {
    mime = image.mime;
    data = image.data;
    if (!ALLOWED_MIME.includes(mime)) {
      return res.status(400).json({ error: 'Image must be PNG, JPEG, GIF or WebP.' });
    }
    const approxBytes = Math.floor(String(data || '').length * 3 / 4);
    if (!data || approxBytes > MAX_IMAGE_BYTES) {
      return res.status(413).json({ error: 'Image too large — 1.5 MB max.' });
    }
  }

  try {
    const { rows } = await query(
      `INSERT INTO chat_messages (author_id, author_name, author_role, body, image_mime, image_data)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.id, req.user.name || 'Resident', req.user.role || 'member', text, mime, data]
    );
    res.status(201).json({ message: rows[0] });
  } catch (err) {
    console.error('POST chat error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/chat/:id — author or staff
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM chat_messages WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Message not found' });
    if (rows[0].author_id !== req.user.id && !isStaff(req.user)) {
      return res.status(403).json({ error: 'You can only delete your own messages.' });
    }
    await query('DELETE FROM chat_messages WHERE id = $1', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    console.error('DELETE chat error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
