/**
 * Tests for PUT /users/:id — login-email editing (plus role/member_id regression).
 * Runs the REAL route with db/auth/audit mocked in-memory. No Postgres needed.
 *
 * Run: node test/users.test.js
 */
const assert = require('assert');

let state;
function reset() {
  state = {
    users: [
      { id: 1, name: 'Admin', email: 'admin@estate.local', role: 'admin', member_id: null },
      { id: 3, name: 'Star Ola', email: 'starola@yahoo.com', role: 'member', member_id: null },
    ],
    audits: [],
  };
}
reset();

let currentUser = { id: 1, role: 'admin' };

async function query(sql, params = []) {
  const s = sql.replace(/\s+/g, ' ').trim();

  if (s === 'SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id <> $2')
    return { rows: state.users.filter((u) => u.email.toLowerCase() === String(params[0]).toLowerCase() && u.id !== Number(params[1])) };

  if (s === 'SELECT email FROM users WHERE id = $1')
    return { rows: state.users.filter((u) => u.id === Number(params[0])).map((u) => ({ email: u.email })) };

  const m = s.match(/^UPDATE users SET (.+) WHERE id = \$(\d+) RETURNING/);
  if (m) {
    const id = Number(params[Number(m[2]) - 1]);
    const u = state.users.find((x) => x.id === id);
    if (!u) return { rows: [] };
    for (const assign of m[1].split(', ')) {
      const [col, ph] = assign.split(' = ');
      assert.ok(ph && ph.startsWith('$'), 'unexpected assignment ' + assign);
      u[col.trim()] = params[Number(ph.slice(1)) - 1];
    }
    return { rows: [{ id: u.id, name: u.name, email: u.email, role: u.role, member_id: u.member_id }] };
  }

  throw new Error('Unexpected SQL in users route: ' + s);
}

const dbPath = require.resolve('../src/db');
const authPath = require.resolve('../src/auth');
const auditPath = require.resolve('../src/audit');

require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { query } };
require.cache[authPath] = {
  id: authPath, filename: authPath, loaded: true,
  exports: {
    authenticate: (req, res, next) => { req.user = currentUser; next(); },
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

const express = require('express');
const router = require('../src/routes/users');

const app = express();
app.use(express.json());
app.use('/users', router);

const results = [];
function check(name, fn) {
  try { fn(); results.push(['PASS', name]); }
  catch (e) { results.push(['FAIL', name + ' — ' + e.message]); }
}

(async () => {
  const server = await new Promise((r) => { const sv = app.listen(0, '127.0.0.1', () => r(sv)); });
  const base = `http://127.0.0.1:${server.address().port}/users`;
  const put = (p, body) => fetch(base + p, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  // 1) email change: trimmed + lowercased + audited
  let res = await put('/3', { email: '  Star.New@Yahoo.com  ' });
  let body = await res.json();
  check('email change → 200', () => assert.strictEqual(res.status, 200));
  check('email normalised (trim + lowercase)', () => assert.strictEqual(body.user.email, 'star.new@yahoo.com'));
  check('USER_EMAIL_CHANGE audited old→new', () => {
    const a = state.audits[state.audits.length - 1];
    assert.strictEqual(a.action, 'USER_EMAIL_CHANGE');
    assert.strictEqual(a.oldValue.email, 'starola@yahoo.com');
    assert.strictEqual(a.newValue.email, 'star.new@yahoo.com');
  });

  // 2) duplicate email → 409
  res = await put('/3', { email: 'admin@estate.local' });
  check('duplicate email → 409', () => assert.strictEqual(res.status, 409));

  // 3) invalid email → 400
  res = await put('/3', { email: 'not-an-email' });
  check('invalid email → 400', () => assert.strictEqual(res.status, 400));

  // 4) unchanged email → 200, no extra audit row
  const auditsBefore = state.audits.length;
  res = await put('/3', { email: 'star.new@yahoo.com' });
  check('same email → 200 with no new audit', () => {
    assert.strictEqual(res.status, 200);
    assert.strictEqual(state.audits.length, auditsBefore);
  });

  // 5) role-only update still works (regression)
  res = await put('/3', { role: 'treasurer' });
  body = await res.json();
  check('role-only update still works', () => {
    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.user.role, 'treasurer');
    assert.strictEqual(body.user.email, 'star.new@yahoo.com');
  });

  // 6) unknown user → 404
  res = await put('/999', { email: 'x@y.co' });
  check('unknown user → 404', () => assert.strictEqual(res.status, 404));

  // 7) non-admin blocked → 403
  currentUser = { id: 9, role: 'member' };
  res = await put('/3', { email: 'hack@evil.co' });
  check('non-admin → 403', () => assert.strictEqual(res.status, 403));
  currentUser = { id: 1, role: 'admin' };

  server.close();
  let failed = 0;
  for (const [st, name] of results) {
    if (st === 'FAIL') failed++;
    console.log(`${st === 'PASS' ? '✅' : '❌'} ${st}  ${name}`);
  }
  console.log(failed ? `\n${failed} test(s) failed` : '\nAll user-email-edit tests passed.');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('Harness error:', e); process.exit(1); });
