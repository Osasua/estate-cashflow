/**
 * Focused test for POST /members/:id/unlink (and the create-login re-link
 * fallback). Runs the REAL route module with the db/auth/audit modules
 * swapped for in-memory fakes — no Postgres required.
 *
 * Run: node test/unlink.test.js
 */
const assert = require('assert');

// ---------- in-memory fakes ----------
let state;
function reset() {
  state = {
    members: [
      { id: 7, house_number: '11A', household_name: 'The Oladirans', email: 'osasua@yopmail.com', phone: '+2348033431954' },
      // House whose contact email IS the (unlinked) account's email — the
      // create-login re-link path.
      { id: 8, house_number: '12B', household_name: 'Re-link House', email: 'starola@yahoo.com', phone: '+2348000000000' },
    ],
    users: [
      { id: 1, name: 'Admin', email: 'admin@estate.local', role: 'admin', member_id: null, password_hash: 'x' },
      { id: 3, name: 'Star Ola', email: 'starola@yahoo.com', role: 'member', member_id: 7, password_hash: 'x' },
    ],
    audits: [],
    sqlSeen: [],
  };
}
reset();

async function query(sql, params = []) {
  const s = sql.replace(/\s+/g, ' ').trim();
  state.sqlSeen.push(s);

  if (s === 'SELECT id, house_number, household_name FROM members WHERE id = $1')
    return { rows: state.members.filter((m) => m.id === Number(params[0])) };

  if (s === 'SELECT id, name, email, role FROM users WHERE member_id = $1')
    return { rows: state.users.filter((u) => u.member_id === Number(params[0])) };

  if (s === 'UPDATE users SET member_id = NULL WHERE id = $1') {
    const u = state.users.find((x) => x.id === Number(params[0]));
    if (u) u.member_id = null;
    return { rows: [], rowCount: u ? 1 : 0 };
  }

  // ---- create-login path ----
  if (s === 'SELECT * FROM members WHERE id = $1')
    return { rows: state.members.filter((m) => m.id === Number(params[0])) };

  if (s === 'SELECT id FROM users WHERE member_id = $1')
    return { rows: state.users.filter((u) => u.member_id === Number(params[0])) };

  if (s.startsWith('INSERT INTO users (name, email, password_hash, role, member_id)')) {
    const email = String(params[1]).toLowerCase();
    if (state.users.some((u) => u.email.toLowerCase() === email)) {
      const err = new Error('duplicate key value violates unique constraint "users_email_key"');
      err.code = '23505';
      throw err;
    }
    const id = Math.max(...state.users.map((u) => u.id)) + 1;
    state.users.push({ id, name: params[0], email, role: 'member', member_id: params[3], password_hash: params[2] });
    return { rows: [], rowCount: 1 };
  }

  if (s === 'SELECT id, email, member_id FROM users WHERE LOWER(email) = LOWER($1)')
    return { rows: state.users.filter((u) => u.email.toLowerCase() === String(params[0]).toLowerCase()) };

  if (s === 'UPDATE users SET member_id = $1 WHERE id = $2') {
    const u = state.users.find((x) => x.id === Number(params[1]));
    if (u) u.member_id = Number(params[0]);
    return { rows: [], rowCount: u ? 1 : 0 };
  }

  throw new Error('Unexpected SQL reached by test: ' + s);
}

// ---------- inject fakes into the require cache BEFORE loading the route ----------
const dbPath = require.resolve('../src/db');
const authPath = require.resolve('../src/auth');
const auditPath = require.resolve('../src/audit');

require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { query } };
require.cache[authPath] = {
  id: authPath, filename: authPath, loaded: true,
  exports: {
    authenticate: (req, res, next) => { req.user = { id: 1, role: 'admin' }; next(); },
    staff: (req, res, next) => next(),
    sign: () => 'tok', comms: (req, res, next) => next(), facilities: (req, res, next) => next(),
  },
};
require.cache[auditPath] = {
  id: auditPath, filename: auditPath, loaded: true,
  exports: {
    audit: async (userId, action, table, recordId, oldValue, newValue) => {
      state.audits.push({ userId, action, table, recordId, oldValue, newValue });
    },
  },
};

// ---------- run the real router ----------
const express = require('express');
const router = require('../src/routes/members');

const app = express();
app.use(express.json());
app.use('/members', router);

const results = [];
function check(name, fn) {
  try { fn(); results.push(['PASS', name]); }
  catch (e) { results.push(['FAIL', name + ' — ' + e.message]); }
}

(async () => {
  const server = await new Promise((r) => { const sv = app.listen(0, '127.0.0.1', () => r(sv)); });
  const base = `http://127.0.0.1:${server.address().port}/members`;
  const post = (p) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' } });

  // 1) happy path
  let res = await post('/7/unlink');
  let body = await res.json();
  check('unlink returns 200', () => assert.strictEqual(res.status, 200));
  check('response names the unlinked email', () => assert.match(body.message, /starola@yahoo\.com/));
  check('users.member_id cleared', () => assert.strictEqual(state.users.find((u) => u.id === 3).member_id, null));
  check('account NOT deleted or upset (name/email/role/password kept)', () => {
    const u = state.users.find((u) => u.id === 3);
    assert.strictEqual(state.users.length, 2);
    assert.strictEqual(u.email, 'starola@yahoo.com');
    assert.strictEqual(u.name, 'Star Ola');
    assert.strictEqual(u.role, 'member');
    assert.strictEqual(u.password_hash, 'x');
  });
  check('household row untouched', () => {
    const m = state.members.find((m) => m.id === 7);
    assert.strictEqual(m.household_name, 'The Oladirans');
    assert.strictEqual(m.email, 'osasua@yopmail.com');
  });
  check('no contributions/payments SQL touched', () =>
    assert.ok(!state.sqlSeen.some((q) => /contributions|payments/i.test(q))));
  check('audit row written (UNLINK_LOGIN)', () => {
    assert.strictEqual(state.audits.length, 1);
    assert.strictEqual(state.audits[0].action, 'UNLINK_LOGIN');
    assert.strictEqual(state.audits[0].oldValue.member_id, 7);
    assert.strictEqual(state.audits[0].newValue.member_id, null);
  });

  // 2) unlink again → 409 (nothing linked)
  res = await post('/7/unlink');
  body = await res.json();
  check('second unlink → 409 with friendly message', () => {
    assert.strictEqual(res.status, 409);
    assert.match(body.message, /no linked login/);
  });

  // 3) unknown household → 404
  res = await post('/999/unlink');
  check('unknown member → 404', () => assert.strictEqual(res.status, 404));

  // 4a) create-login on house 11A (contact email has no account) → fresh login,
  //     proving unlink did not break normal login creation
  res = await post('/7/create-login');
  body = await res.json();
  check('create-login still creates a fresh login when no account owns the email', () => {
    assert.strictEqual(res.status, 200);
    assert.match(body.message, /Login created for osasua@yopmail\.com/);
  });

  // 4b) re-link fallback: house 12B's contact email IS the unlinked account's
  //     email → create-login re-attaches that account instead of failing
  res = await post('/8/create-login');
  body = await res.json();
  check('create-login re-links the unlinked account (200)', () => {
    assert.strictEqual(res.status, 200);
    assert.match(body.message, /Re-linked existing account starola@yahoo\.com/);
    assert.strictEqual(state.users.find((u) => u.id === 3).member_id, 8);
  });
  check('re-link audited (RELINK_LOGIN)', () =>
    assert.strictEqual(state.audits[state.audits.length - 1].action, 'RELINK_LOGIN'));

  server.close();
  let failed = 0;
  for (const [st, name] of results) {
    if (st === 'FAIL') failed++;
    console.log(`${st === 'PASS' ? '✅' : '❌'} ${st}  ${name}`);
  }
  console.log(failed ? `\n${failed} test(s) failed` : '\nAll unlink tests passed.');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('Harness error:', e); process.exit(1); });
