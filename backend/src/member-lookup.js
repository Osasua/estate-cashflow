/**
 * Resolve the member (household) record behind a logged-in user.
 *
 * users.member_id is the primary link; older rows fall back to matching the
 * member's email, then the household name. Every member-facing endpoint
 * (My Account, statement, maintenance requests) must use this so they all
 * agree on which household the user is.
 */
const { query } = require('./db');

async function findMemberForUser(userId) {
  const steps = [
    `SELECT m.id, m.house_number, m.household_name, m.monthly_due, m.active, m.phone, m.email
       FROM members m
      WHERE m.id = (SELECT member_id FROM users WHERE id = $1)`,
    `SELECT m.id, m.house_number, m.household_name, m.monthly_due, m.active, m.phone, m.email
       FROM members m
      WHERE m.email = (SELECT email FROM users WHERE id = $1)`,
    `SELECT m.id, m.house_number, m.household_name, m.monthly_due, m.active, m.phone, m.email
       FROM members m
      WHERE m.household_name = (SELECT name FROM users WHERE id = $1)`,
  ];
  for (const sql of steps) {
    const { rows } = await query(sql, [userId]);
    if (rows.length) {
      const m = rows[0];
      return { ...m, monthly_due: parseFloat(m.monthly_due) || 0 };
    }
  }
  return null;
}

module.exports = { findMemberForUser };
