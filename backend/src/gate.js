/**
 * Ferrano Gate Access — code generation, lifecycle status, gate notification.
 *
 * Codes are system-generated (residents never pick them), 6 characters from
 * an unambiguous alphabet, and stay valid for the whole visit window so a
 * guest can leave and return. On issue, the gatehouse phone receives a
 * WhatsApp alert (Twilio) so the guard can match the code at the gate.
 */
const { query } = require('./db');
const { sendWhatsAppMessage, whatsappConfigured } = require('./whatsapp');

// No 0/O, 1/I/L — codes get read aloud at a gate.
const CHARSET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

function randomCode(len = 6) {
  let s = '';
  for (let i = 0; i < len; i++) s += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  return s;
}

async function uniqueCode() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode();
    const { rows } = await query('SELECT 1 FROM access_codes WHERE code = $1', [code]);
    if (!rows.length) return code;
  }
  throw new Error('Could not allocate a unique code — please try again');
}

/** scheduled → active → expired, or revoked forever. */
function statusOf(row, now = new Date()) {
  if (row.revoked_at) return 'revoked';
  const a = new Date(row.arrives_at);
  const d = new Date(row.departs_at);
  if (now < a) return 'scheduled';
  if (now > d) return 'expired';
  return 'active';
}

const fmtWhen = (x) =>
  new Date(x).toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

const fmtWindow = (row) => `${fmtWhen(row.arrives_at)} → ${fmtWhen(row.departs_at)}`;

/** What the gatehouse guard receives per issued code. */
function gateAlertText(row, household) {
  return [
    'FERRANO COURT GATE ALERT',
    `New visitor code: ${row.code}`,
    `Visitor: ${row.visitor_name} (${row.people_count} ${Number(row.people_count) === 1 ? 'person' : 'people'})`,
    `Host: House ${household.house_number} — ${household.household_name}`,
    `Valid: ${fmtWindow(row)}`,
    row.vehicle ? `Vehicle: ${row.vehicle}` : null,
    'Match this code at the gate. Entry and exit allowed within the window.',
  ].filter(Boolean).join('\n');
}

/** What the resident sends to their visitor. */
function shareText(row, household) {
  return [
    'Ferrano Court gate access',
    `Code: ${row.code}`,
    `Visitor: ${row.visitor_name}`,
    `Host: House ${household.house_number} — ${household.household_name}`,
    `Valid: ${fmtWindow(row)}`,
    row.vehicle ? `Vehicle: ${row.vehicle}` : null,
    'Present this code at the gate on arrival. It stays valid until the departure time above.',
  ].filter(Boolean).join('\n');
}

/**
 * Notify the gatehouse. Always writes a gate_alerts row (audit trail);
 * status is sent / failed / not-configured so staff can see exactly what
 * reached the gate phone.
 */
async function sendGateAlert(row, household) {
  const gateNumber = String(process.env.GATE_WHATSAPP_NUMBER || '').trim();
  let status = 'not-configured';
  let detail = 'GATE_WHATSAPP_NUMBER or Twilio credentials not set';
  if (gateNumber && whatsappConfigured()) {
    try {
      await sendWhatsAppMessage(gateNumber, gateAlertText(row, household));
      status = 'sent';
      detail = `whatsapp ${gateNumber}`;
    } catch (e) {
      status = 'failed';
      detail = e.message;
    }
  }
  await query(
    `INSERT INTO gate_alerts (access_code_id, channel, status, detail)
     VALUES ($1, 'whatsapp', $2, $3)`,
    [row.id, status, detail]
  );
  return { status, detail };
}

module.exports = { uniqueCode, statusOf, fmtWindow, gateAlertText, shareText, sendGateAlert };
