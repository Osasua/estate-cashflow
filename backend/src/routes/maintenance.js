const express = require('express');
const { query } = require('../db');
const { authenticate, facilities } = require('../auth');
const { findMemberForUser } = require('../member-lookup');
const { sendMaintenanceEmail } = require('../mailer');
const { frontendUrl } = require('../frontend-url');

const router = express.Router();
router.use(authenticate);

const STATUSES = ['new', 'in-progress', 'resolved'];

// GET /api/maintenance — facility team see the whole queue, members see their own
router.get('/', async (req, res) => {
  try {
    const isStaff = ['admin', 'facility'].includes(req.user.role);
    let sql = `
      SELECT mr.*, m.household_name, m.house_number
        FROM maintenance_requests mr
        JOIN members m ON m.id = mr.member_id`;
    let params = [];
    if (!isStaff) {
      const member = await findMemberForUser(req.user.id);
      if (!member) return res.json({ requests: [] });
      sql += ` WHERE mr.member_id = $1`;
      params = [member.id];
    }
    sql += ` ORDER BY
              CASE mr.status WHEN 'new' THEN 0 WHEN 'in-progress' THEN 1 ELSE 2 END,
              mr.created_at DESC`;
    const { rows } = await query(sql, params);
    res.json({ requests: rows });
  } catch (err) {
    console.error('Maintenance list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/maintenance { title, description } — any resident with a household
router.post('/', async (req, res) => {
  try {
    const member = await findMemberForUser(req.user.id);
    if (!member) return res.status(404).json({ error: 'No member record found for this user' });
    const { title, description } = req.body || {};
    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'A short title is required' });
    }
    const { rows } = await query(
      `INSERT INTO maintenance_requests (member_id, title, description)
       VALUES ($1, $2, $3) RETURNING *`,
      [member.id, String(title).trim(), description || null]
    );
    const created = rows[0];

    // Notify the Facility Manager mailboxes (fire-and-forget: a mail failure
    // must never block the resident's request). The treasurer is no longer
    // on this distribution list.
    query(`SELECT email FROM users WHERE role = 'facility'`)
      .then(({ rows: facRows }) => Promise.all(facRows.map((r) =>
        sendMaintenanceEmail({
          to: r.email,
          title: created.title,
          household: member.household_name,
          houseNumber: member.house_number,
          link: `${frontendUrl()}/maintenance`,
        }).catch((e) => console.error('Maintenance email failed for', r.email, e.message))
      )))
      .catch((e) => console.error('Facility lookup failed:', e.message));

    res.status(201).json({ request: created });
  } catch (err) {
    console.error('Maintenance create error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/maintenance/:id { status } — facility triage
router.put('/:id', facilities, async (req, res) => {
  const { status } = req.body || {};
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Expected one of: ${STATUSES.join(', ')}` });
  }
  try {
    const { rows } = await query(
      `UPDATE maintenance_requests
          SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Request not found' });
    res.json({ request: rows[0] });
  } catch (err) {
    console.error('Maintenance update error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
