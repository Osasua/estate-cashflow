const express = require('express');
const { query } = require('../db');
const { authenticate } = require('../auth');

const router = express.Router();
router.use(authenticate);

const isStaff = (u) => ['admin', 'treasurer', 'secretary'].includes(u?.role);

// GET /api/board — everyone; pinned first, newest after
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT p.*, u.name AS author_name, u.role AS author_role
      FROM board_posts p
      JOIN users u ON u.id = p.author_id
      ORDER BY p.pinned DESC, p.created_at DESC
    `);
    res.json({ posts: rows });
  } catch (err) {
    console.error('GET board error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/board — every resident & staff; kind = notice | event
router.post('/', async (req, res) => {
  const { kind, title, body, event_date, event_time, location } = req.body || {};
  if (!['notice', 'event'].includes(kind)) {
    return res.status(400).json({ error: 'Kind must be "notice" or "event".' });
  }
  if (!title || !body) {
    return res.status(400).json({ error: 'Title and body are required.' });
  }
  if (kind === 'event' && !event_date) {
    return res.status(400).json({ error: 'Events need a date.' });
  }
  try {
    const { rows } = await query(
      `INSERT INTO board_posts (author_id, author_name, author_role, kind, title, body, event_date, event_time, location)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [req.user.id, req.user.name || 'Resident', req.user.role || 'member', kind, title, body,
       kind === 'event' ? event_date : null, event_time || null, location || null]
    );
    res.status(201).json({ post: rows[0], message: 'Posted to the Ferrano Board!' });
  } catch (err) {
    console.error('POST board error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/board/:id/pin — staff only
router.patch('/:id/pin', async (req, res) => {
  if (!isStaff(req.user)) return res.status(403).json({ error: 'Staff only.' });
  try {
    const { rows } = await query(
      'UPDATE board_posts SET pinned = NOT pinned WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Post not found' });
    res.json({ post: rows[0], message: rows[0].pinned ? 'Post pinned 📌' : 'Post unpinned' });
  } catch (err) {
    console.error('PIN board error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/board/:id — author or staff
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM board_posts WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Post not found' });
    if (rows[0].author_id !== req.user.id && !isStaff(req.user)) {
      return res.status(403).json({ error: 'You can only delete your own posts.' });
    }
    await query('DELETE FROM board_posts WHERE id = $1', [req.params.id]);
    res.json({ deleted: true, message: 'Post removed' });
  } catch (err) {
    console.error('DELETE board error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
