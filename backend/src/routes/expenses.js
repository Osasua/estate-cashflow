const express = require('express');
const { query } = require('../db');
const { authenticate, staff } = require('../auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();
router.use(authenticate);

// --- MULTER CONFIGURATION FOR RECEIPTS ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ 
  storage: storage, 
  limits: { fileSize: 5 * 1024 * 1024 }
});

// --- EXPENSE ROUTES ---
router.get('/', async (req, res) => {
  const { from, to, category_id } = req.query;
  const where = [];
  const params = [];
  if (from) { params.push(from); where.push(`e.spent_on >= $${params.length}`); }
  if (to) { params.push(to); where.push(`e.spent_on <= $${params.length}`); }
  if (category_id) { params.push(category_id); where.push(`e.category_id = $${params.length}`); }
  const { rows } = await query(
    `SELECT e.*, c.name AS category
       FROM expenses e LEFT JOIN categories c ON c.id = e.category_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY e.spent_on DESC, e.id DESC`,
    params
  );
  res.json({ expenses: rows });
});

// --- CATEGORY ROUTES ---
router.get('/categories', async (req, res) => {
  const { rows } = await query('SELECT * FROM categories ORDER BY name');
  res.json({ categories: rows });
});

router.get('/categories/active', async (req, res) => {
  const { rows } = await query('SELECT * FROM categories WHERE is_active = true ORDER BY name');
  res.json({ categories: rows });
});

router.post('/categories', staff, async (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Category name is required' });
  
  try {
    // 1. First, check if it exists but is hidden, and restore it
    const restoreRes = await query(
      'UPDATE categories SET is_active = true WHERE name = $1 AND is_active = false RETURNING *',
      [name.trim()]
    );
    
    if (restoreRes.rows.length > 0) {
      return res.status(200).json({ category: restoreRes.rows[0], message: 'Category restored!' });
    }
    
    // 2. If not hidden, try to insert as a brand new category
    const insertRes = await query(
      'INSERT INTO categories (name, is_active) VALUES ($1, true) RETURNING *',
      [name.trim()]
    );
    res.status(201).json({ category: insertRes.rows[0], message: 'Category created!' });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'An active category with this name already exists.' });
    throw e;
  }
});

router.patch('/categories/:id', staff, async (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Category name is required' });
  
  try {
    const { rows } = await query(
      'UPDATE categories SET name = $1 WHERE id = $2 RETURNING *',
      [name.trim(), req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Category not found' });
    res.json({ category: rows[0], message: 'Category updated!' });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Another category with this name already exists.' });
    throw e;
  }
});

router.put('/categories/:id', staff, async (req, res) => {
  const old = await query('SELECT * FROM categories WHERE id = $1', [req.params.id]);
  if (!old.rows[0]) return res.status(404).json({ error: 'Category not found' });
  
  const { rows } = await query(
    'UPDATE categories SET is_active = NOT is_active WHERE id = $1 RETURNING *',
    [req.params.id]
  );
  res.json({ category: rows[0] });
});

// --- EXPENSE CREATION ---
router.post('/', staff, upload.single('receipt'), async (req, res) => {
  const { category_id, amount, description, vendor, spent_on } = req.body || {};
  const amt = Number(amount);
  
  if (!(amt > 0) || !description) {
    return res.status(400).json({ error: 'A positive amount and a description are required' });
  }

  const receiptUrl = req.file 
    ? `http://localhost:4000/uploads/${req.file.filename}` 
    : (req.body.receipt_url || null);

  const { rows } = await query(
    `INSERT INTO expenses (category_id, amount, description, vendor, spent_on, receipt_url, recorded_by)
     VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_DATE), $6, $7) RETURNING *`,
    [category_id || null, amt, description, vendor || null, spent_on || null, receiptUrl, req.user.id]
  );
  
  res.status(201).json({ expense: rows[0] });
});

// --- EXPENSE UPDATE ---
router.put('/:id', staff, async (req, res) => {
  const { category_id, amount, description, vendor, spent_on, receipt_url } = req.body || {};
  const old = await query('SELECT * FROM expenses WHERE id = $1', [req.params.id]);
  if (!old.rows[0]) return res.status(404).json({ error: 'Expense not found' });
  
  const { rows } = await query(
    `UPDATE expenses SET 
       category_id = COALESCE($2, category_id),
       amount = COALESCE($3, amount), 
       description = COALESCE($4, description),
       vendor = COALESCE($5, vendor), 
       spent_on = COALESCE($6, spent_on),
       receipt_url = COALESCE($7, receipt_url)
     WHERE id = $1 RETURNING *`,
    [req.params.id, category_id, amount ? Number(amount) : null, description, vendor, spent_on, receipt_url]
  );
  
  res.json({ expense: rows[0] });
});

// --- EXPENSE DELETE ---
router.delete('/:id', staff, async (req, res) => {
  const old = await query('SELECT * FROM expenses WHERE id = $1', [req.params.id]);
  if (!old.rows[0]) return res.status(404).json({ error: 'Expense not found' });
  
  await query('DELETE FROM expenses WHERE id = $1', [req.params.id]);
  res.json({ deleted: true });
});

module.exports = router;