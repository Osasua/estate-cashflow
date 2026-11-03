/**
 * Ferrano Gate Access routes.
 *
 * Residents issue/revoke codes for THEIR OWN household only; comms staff
 * (admin/treasurer/secretary) see every household plus the gate alert log.
 * Codes are valid for the whole visit window (in & out) — the guard matches
 * the WhatsApp alert at the gate.
 */
const express = require('express');
const { query } = require('../db');
const { authenticate } = require('../auth');
const { findMemberForUser } = require('../member-lookup');
const { uniqueCode, statusOf, sendGateAlert, shareText } = require('../gate');

const router = express.Router();
router.use(authenticate);

const isComms = (role) => ['admin', 'treasurer', 'secretary'].includes(role);
const trimOrNull = (v) => (v === undefined || v === null ? '' : String(v).trim()) || null;
const decorate = (r) => ({ ...r, status: statusOf(r), people_count: Number(r.people_count) });

// GET /api/access-codes — residents: own codes; comms: all households
router.get('/', async (req, res) => {
  try {
    let sql = `SELECT ac.*, m.household_name, m.house_number
                 FROM access_codes ac
                 JOIN members m ON m.id = ac.member_id`;
    let params = [];
    if (!isComms(req.user.role) && req.user.role !== 'gate') {
      const member = await findMemberForUser(req.user.id);
      if (!member) return res.json({ codes: [] });
      sql += ' WHERE ac.member_id = $1';
      params = [member.id];
    }
    sql += ' ORDER BY ac.arrives_at DESC';
    const { rows } = await query(sql, params);
    res.json({ codes: rows.map(decorate) });
  } catch (err) {
    console.error('Access codes list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/access-codes/alerts — comms: what actually reached the gate phone
router.get('/alerts', async (req, res) => {
  if (!isComms(req.user.role)) return res.status(403).json({ error: 'Staff access required' });
  try {
    const { rows } = await query(
      `SELECT ga.*, ac.code, ac.visitor_name, m.house_number, m.household_name
         FROM gate_alerts ga
         JOIN access_codes ac ON ac.id = ga.access_code_id
         JOIN members m ON m.id = ac.member_id
        ORDER BY ga.sent_at DESC
        LIMIT 100`
    );
    res.json({ alerts: rows });
  } catch (err) {
    console.error('Gate alerts error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/access-codes — issue a code for a visitor
router.post('/', async (req, res) => {
  try {
    const b = req.body || {};
    const visitor_name = String(b.visitor_name || '').trim();
    if (!visitor_name) return res.status(400).json({ error: 'Visitor name is required' });

    const arrives = b.arrives_at ? new Date(b.arrives_at) : null;
    const departs = b.departs_at ? new Date(b.departs_at) : null;
    if (!arrives || isNaN(arrives.getTime())) return res.status(400).json({ error: 'A valid arrival date & time is required' });
    if (!departs || isNaN(departs.getTime())) return res.status(400).json({ error: 'A valid departure date & time is required' });
    if (departs <= arrives) return res.status(400).json({ error: 'Departure must be after arrival' });
    const people = Math.max(1, parseInt(b.people_count, 10) || 1);

    let member;
    if (isComms(req.user.role)) {
      const mid = Number(b.member_id);
      if (!mid) return res.status(400).json({ error: 'member_id (household) is required' });
      const m = await query('SELECT id, household_name, house_number FROM members WHERE id = $1', [mid]);
      if (!m.rows.length) return res.status(404).json({ error: 'Household not found' });
      member = m.rows[0];
    } else {
      member = await findMemberForUser(req.user.id);
      if (!member) return res.status(403).json({ error: 'Your login is not linked to a household — ask the treasurer to link it first.' });
    }

    const code = await uniqueCode();
    const { rows } = await query(
      `INSERT INTO access_codes
         (member_id, code, visitor_name, visitor_phone, arrives_at, departs_at,
          people_count, vehicle, note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        member.id, code, visitor_name, trimOrNull(b.visitor_phone),
        arrives, departs, people, trimOrNull(b.vehicle), trimOrNull(b.note), req.user.id,
      ]
    );
    const row = rows[0];
    const alert = await sendGateAlert(row, member);
    res.status(201).json({
      code: decorate({ ...row, household_name: member.household_name, house_number: member.house_number }),
      share_text: shareText(row, member),
      gate_alert: alert,
    });
  } catch (err) {
    console.error('Issue access code error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/access-codes/:id/revoke — owner household or comms staff
router.post('/:id/revoke', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM access_codes WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Code not found' });
    const row = rows[0];
    if (!isComms(req.user.role)) {
      const member = await findMemberForUser(req.user.id);
      if (!member || member.id !== row.member_id) {
        return res.status(403).json({ error: 'You can only revoke your own household codes' });
      }
    }
    const up = await query(
      `UPDATE access_codes SET revoked_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND revoked_at IS NULL RETURNING *`,
      [row.id]
    );
    res.json({ code: decorate(up.rows[0] || row), revoked: up.rowCount > 0 });
  } catch (err) {
    console.error('Revoke access code error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
