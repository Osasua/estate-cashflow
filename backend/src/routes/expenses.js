const express = require('express');
const { query } = require('../db');
const { authenticate, staff } = require('../auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();
router.use(authenticate);

// Contribution funds an expense can be charged to (mirrors dashboard tabs)
const EXPENSE_TYPES = ['monthly', 'float', 'projects', 'end-of-year', 'welfare'];
const validType = (t) => t === undefined || t === null || t === '' || EXPENSE_TYPES.includes(t);

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

// --- EXPENSE ROUTES (WITH MONTH/YEAR FILTERING) ---
router.get('/', async (req, res) => {
  const { month, year, from, to, category_id, type } = req.query;
  const where = [];
  const params = [];
  
  // If month/year provided, filter by that specific month
  if (month && year) {
    params.push(month, year);
    where.push(`EXTRACT(MONTH FROM e.spent_on) = $${params.length - 1} AND EXTRACT(YEAR FROM e.spent_on) = $${params.length}`);
  }
  
  // Additional date range filter
  if (from) { params.push(from); where.push(`e.spent_on >= $${params.length}`); }
  if (to) { params.push(to); where.push(`e.spent_on <= $${params.length}`); }
  if (category_id) { params.push(category_id); where.push(`e.category_id = $${params.length}`); }
  if (type) { params.push(type); where.push(`e.type = $${params.length}::contribution_type`); }
  
  const sql = `SELECT e.*, c.name AS category
       FROM expenses e LEFT JOIN categories c ON c.id = e.category_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY e.spent_on DESC, e.id DESC`;

  try {
    const { rows } = await query(sql, params);
    res.json({ expenses: rows });
  } catch (err) {
    console.error('GET expenses error:', err.message, '| SQL:', sql, '| params:', params);
    res.status(500).json({ error: err.message });
  }
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
    const restoreRes = await query(
      'UPDATE categories SET is_active = true WHERE name = $1 AND is_active = false RETURNING *',
      [name.trim()]
    );
    
    if (restoreRes.rows.length > 0) {
      return res.status(200).json({ category: restoreRes.rows[0], message: 'Category restored!' });
    }
    
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
  const { category_id, amount, description, vendor, date, spent_on, type } = req.body || {};
  const amt = Number(amount);
  
  const expenseDate = date || spent_on || new Date().toISOString().split('T')[0];
  
  if (!(amt > 0) || !description) {
    return res.status(400).json({ error: 'A positive amount and a description are required' });
  }

  const fundType = type || 'monthly';
  if (!EXPENSE_TYPES.includes(fundType)) {
    return res.status(400).json({ error: `Invalid type. Expected one of: ${EXPENSE_TYPES.join(', ')}` });
  }

  const receiptUrl = req.file 
    ? `/uploads/${req.file.filename}`
    : (req.body.receipt_url || null);

  const { rows } = await query(
    `INSERT INTO expenses (category_id, type, amount, description, vendor, spent_on, receipt_url, recorded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [category_id || null, fundType, amt, description, vendor || null, expenseDate, receiptUrl, req.user.id]
  );
  
  res.status(201).json({ expense: rows[0], message: 'Expense recorded successfully' });
});

// --- EXPENSE UPDATE (WITH FULL FIELD SUPPORT) ---
router.put('/:id', staff, async (req, res) => {
  const { category_id, amount, description, vendor, spent_on, receipt_url, type } = req.body || {};
  
  const old = await query('SELECT * FROM expenses WHERE id = $1', [req.params.id]);
  if (!old.rows[0]) return res.status(404).json({ error: 'Expense not found' });

  if (type !== undefined && !EXPENSE_TYPES.includes(type)) {
    return res.status(400).json({ error: `Invalid type. Expected one of: ${EXPENSE_TYPES.join(', ')}` });
  }
  
  const { rows } = await query(
    `UPDATE expenses SET 
       category_id = COALESCE($2, category_id),
       amount = COALESCE($3, amount), 
       description = COALESCE($4, description),
       vendor = COALESCE($5, vendor), 
       spent_on = COALESCE($6, spent_on),
       receipt_url = COALESCE($7, receipt_url),
       type = COALESCE($8, type)
     WHERE id = $1 RETURNING *`,
    [req.params.id, category_id, amount ? Number(amount) : null, description, vendor, spent_on, receipt_url, type || null]
  );
  
  res.json({ expense: rows[0], message: 'Expense updated successfully' });
});

// --- EXPENSE DELETE ---
router.delete('/:id', staff, async (req, res) => {
  const old = await query('SELECT * FROM expenses WHERE id = $1', [req.params.id]);
  if (!old.rows[0]) return res.status(404).json({ error: 'Expense not found' });
  
  await query('DELETE FROM expenses WHERE id = $1', [req.params.id]);
  res.json({ deleted: true, message: 'Expense deleted successfully' });
});

module.exports = router;