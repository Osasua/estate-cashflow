const express = require('express');
const { query } = require('../db');
const { authenticate, staff } = require('../auth');

const router = express.Router();
router.use(authenticate);

// GET all categories - FIXED: removed created_at
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT id, name, is_active 
      FROM categories 
      ORDER BY name ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error('GET categories error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST new category
router.post('/', staff, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    
    const { rows } = await query(
      `INSERT INTO categories (name, is_active) VALUES ($1, true) RETURNING *`,
      [name]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST category error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT update category
router.put('/:id', staff, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, is_active } = req.body;
    
    const { rows } = await query(
      `UPDATE categories SET name = $1, is_active = $2 WHERE id = $3 RETURNING *`,
      [name, is_active, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Category not found' });
    
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT category error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE category
router.delete('/:id', staff, async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM categories WHERE id = $1', [id]);
    res.json({ message: 'Category deleted' });
  } catch (err) {
    console.error('DELETE category error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;