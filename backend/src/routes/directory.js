/**
 * Ferrano Pages — the resident directory.
 *
 * Every household (members row) can list up to TWO people. Residents manage
 * their own household's listing only ("populate only their data"); comms staff
 * (admin / treasurer / secretary) can manage every household's listing.
 *
 * Storage: directory_entries(member_id, slot 1|2, first_name, last_name,
 *          phone, email, occupation, organization) — UNIQUE(member_id, slot).
 */
const express = require('express');
const { query } = require('../db');
const { authenticate } = require('../auth');
const { findMemberForUser } = require('../member-lookup');

const router = express.Router();
router.use(authenticate);

const isComms = (role) => ['admin', 'treasurer', 'secretary'].includes(role);

const trim = (v) => (v === undefined || v === null ? '' : String(v).trim());
const opt = (v) => trim(v) || null;

function validateBody(body) {
  const slot = Number(body.slot);
  if (![1, 2].includes(slot)) {
    return 'slot must be 1 or 2 (each household lists up to two people)';
  }
  const first_name = trim(body.first_name);
  const last_name = trim(body.last_name);
  if (!first_name || !last_name) return 'First name and last name are required';
  const email = opt(body.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return `"${email}" is not a valid email address`;
  }
  return null;
}

// GET /api/directory — everyone signed in can read the directory.
// Comms staff also receive the full household list so they can add a listing
// for a house that has none yet; residents only see (and edit) their own.
router.get('/', async (req, res) => {
  try {
    const found = await findMemberForUser(req.user.id);
    // Moved-out households (active = false) leave the directory entirely —
    // card, slots and listings. Their financial history is untouched; this
    // only controls visibility here. A moved-out resident signed in is
    // treated like an unlinked login rather than shown their old household.
    const member = found && found.active ? found : null;
    const { rows: entries } = await query(
      `SELECT d.*, m.household_name, m.house_number
         FROM directory_entries d
         JOIN members m ON m.id = d.member_id
        WHERE m.active = TRUE
        ORDER BY m.house_number, d.slot`
    );
    let households = null;
    if (isComms(req.user.role)) {
      const h = await query(
        `SELECT id, household_name, house_number, active FROM members
          WHERE active = TRUE ORDER BY house_number`
      );
      households = h.rows;
    }
    res.json({
      entries,
      households,
      my_member_id: member ? member.id : null,
      my_household: member
        ? { id: member.id, household_name: member.household_name, house_number: member.house_number, phone: member.phone || null, email: member.email || null }
        : null,
    });
  } catch (err) {
    console.error('Directory list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/directory — create or update one slot of one household.
// body: { slot, first_name, last_name, phone?, email?, occupation?,
//         organization?, member_id? }
// member_id is required for staff edits; residents are always pinned to their
// own household, whatever the body says.
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const problem = validateBody(body);
    if (problem) return res.status(400).json({ error: problem });

    let memberId;
    if (isComms(req.user.role)) {
      memberId = Number(body.member_id);
      if (!memberId) return res.status(400).json({ error: 'member_id (household) is required' });
      const m = await query('SELECT id FROM members WHERE id = $1', [memberId]);
      if (!m.rows.length) return res.status(404).json({ error: 'Household not found' });
    } else {
      const member = await findMemberForUser(req.user.id);
      if (!member) {
        return res.status(403).json({ error: 'Your login is not linked to a household — ask the treasurer to link it first.' });
      }
      memberId = member.id;
    }

    const { rows } = await query(
      `INSERT INTO directory_entries
         (member_id, slot, first_name, last_name, phone, email, occupation, organization, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
       ON CONFLICT (member_id, slot) DO UPDATE
         SET first_name   = EXCLUDED.first_name,
             last_name    = EXCLUDED.last_name,
             phone        = EXCLUDED.phone,
             email        = EXCLUDED.email,
             occupation   = EXCLUDED.occupation,
             organization = EXCLUDED.organization,
             updated_at   = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        memberId,
        Number(body.slot),
        trim(body.first_name),
        trim(body.last_name),
        opt(body.phone),
        opt(body.email) ? opt(body.email).toLowerCase() : null,
        opt(body.occupation),
        opt(body.organization),
      ]
    );
    res.status(201).json({ entry: rows[0] });
  } catch (err) {
    console.error('Directory save error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/directory/:id — remove one listing. Residents may only delete
// their own household's; comms staff may delete any.
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM directory_entries WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Listing not found' });
    const entry = rows[0];

    if (!isComms(req.user.role)) {
      const member = await findMemberForUser(req.user.id);
      if (!member || member.id !== entry.member_id) {
        return res.status(403).json({ error: 'You can only manage your own household listing' });
      }
    }
    await query('DELETE FROM directory_entries WHERE id = $1', [entry.id]);
    res.json({ success: true, id: entry.id });
  } catch (err) {
    console.error('Directory delete error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
