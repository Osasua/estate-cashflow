const express = require('express');
const { query } = require('../db');
const { authenticate, staff } = require('../auth');

const router = express.Router();

// Everyone logged in can view minutes
router.get('/', authenticate, async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT id, title, meeting_date, content, document_link, created_at
      FROM meeting_minutes 
      ORDER BY meeting_date DESC
    `);
    res.json({ minutes: rows });
  } catch (err) {
    console.error('GET minutes error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Only staff can publish
router.post('/', authenticate, staff, async (req, res) => {
  try {
    const { title, meeting_date, content, document_link } = req.body;
    if (!title || !meeting_date || !content) {
      return res.status(400).json({ error: 'Title, date, and content are required' });
    }

    const { rows } = await query(
      `INSERT INTO meeting_minutes (title, meeting_date, content, document_link) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [title, meeting_date, content, document_link || null]
    );
    res.status(201).json({ minute: rows[0] });
  } catch (err) {
    console.error('POST minutes error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Only staff can delete
router.delete('/:id', authenticate, staff, async (req, res) => {
  try {
    await query('DELETE FROM meeting_minutes WHERE id = $1', [req.params.id]);
    res.json({ message: 'Minute deleted successfully' });
  } catch (err) {
    console.error('DELETE minutes error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;