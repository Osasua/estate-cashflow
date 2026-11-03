// backend/src/welcome-mail.js — the branded welcome/credentials email.
// Self-contained on purpose: owns its own Brevo send so the template can
// evolve without touching the generic mailer used by reminders/broadcasts.
const API_KEY = process.env.BREVO_API_KEY;
const SENDER_EMAIL = process.env.SMTP_FROM_EMAIL || 'ferrano.secretariat@ferranocourt.estate';
const SENDER_NAME = process.env.SMTP_FROM_NAME || 'Ferrano Court Portal';
const LOGO_URL = 'https://ferranocourt.estate/ferrano-logo.png';
const SITE_URL = 'https://ferranocourt.estate';

const step = (n, text) => `
  <tr>
    <td width="34" valign="top" style="padding:0 0 10px 0;">
      <div style="width:24px;height:24px;line-height:24px;text-align:center;border-radius:50%;background:#0f766e;color:#ffffff;font-size:12px;font-weight:bold;font-family:Arial,sans-serif;">${n}</div>
    </td>
    <td valign="top" style="padding:0 0 10px 0;font-size:14px;line-height:20px;color:#334155;font-family:Arial,sans-serif;">${text}</td>
  </tr>`;

const chip = (emoji, label) => `
  <td style="padding:0 6px 6px 0;">
    <span style="display:inline-block;background:#f0fdfa;border:1px solid #99f6e4;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:bold;color:#0f766e;font-family:Arial,sans-serif;">${emoji} ${label}</span>
  </td>`;

const buildWelcomeHtml = (email, password, loginUrl, name) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,0.12);">

      <!-- Header band -->
      <tr><td align="center" style="background:#0f172a;padding:28px 24px 22px 24px;">
        <img src="${LOGO_URL}" width="72" height="72" alt="Ferrano Court crest" style="display:block;border-radius:10px;margin:0 auto 12px auto;" />
        <div style="color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:2px;font-family:Arial,sans-serif;">FERRANO COURT PORTAL</div>
        <div style="color:#94a3b8;font-size:12px;letter-spacing:1px;margin-top:6px;font-family:Arial,sans-serif;">ONE COURT &middot; ONE PORTAL &middot; ZERO WAHALA</div>
      </td></tr>

      <!-- Body -->
      <tr><td style="background:#ffffff;padding:28px 32px;">
        <div style="font-size:22px;font-weight:bold;color:#0f172a;font-family:Arial,sans-serif;">Welcome${name ? `, ${name}` : ', neighbour'}! 🎉</div>
        <p style="font-size:14px;line-height:22px;color:#475569;margin:10px 0 18px 0;font-family:Arial,sans-serif;">
          Your keys to the estate are ready. Sign in, look around, and make yourself at home —
          bills, gate codes, minutes, the neighbours' chat, it all lives here now.
        </p>

        <!-- Credentials card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #0f766e;border-radius:12px;">
          <tr><td style="padding:16px 18px;">
            <div style="font-size:13px;color:#64748b;font-family:Arial,sans-serif;">📧 &nbsp;Email</div>
            <div style="font-size:15px;font-weight:bold;color:#0f172a;margin:2px 0 12px 0;font-family:Arial,sans-serif;">${email}</div>
            <div style="font-size:13px;color:#64748b;font-family:Arial,sans-serif;">🔑 &nbsp;Temporary password</div>
            <div style="margin:2px 0 14px 0;"><span style="display:inline-block;background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;padding:4px 10px;font-family:'Courier New',monospace;font-size:15px;font-weight:bold;color:#92400e;letter-spacing:1px;">${password}</span></div>
            <div style="font-size:13px;color:#64748b;margin-bottom:6px;font-family:Arial,sans-serif;">🔗 &nbsp;Login</div>
            <a href="${loginUrl}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;border-radius:8px;padding:10px 18px;font-size:14px;font-weight:bold;font-family:Arial,sans-serif;">Open ${loginUrl.replace(/^https?:\/\//, '')} →</a>
          </td></tr>
        </table>

        <!-- First things first -->
        <div style="font-size:15px;font-weight:bold;color:#0f172a;margin:20px 0 10px 0;font-family:Arial,sans-serif;">⚡ First things first</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${step(1, 'Sign in with the temporary password above.')}
          ${step(2, 'Open <b>My Profile</b> in the sidebar and hit <b>Change Password</b>.')}
          ${step(3, 'Pick something strong (8+ characters) — then delete this email.')}
        </table>

        <!-- What's inside -->
        <div style="font-size:15px;font-weight:bold;color:#0f172a;margin:14px 0 10px 0;font-family:Arial,sans-serif;">🗝 What's inside your portal</div>
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          ${chip('💳', 'Pay bills online')}${chip('🛡', 'Visitor gate codes')}${chip('💬', 'Community chat')}
        </tr><tr>
          ${chip('📄', 'PDF statements')}${chip('📇', 'Resident directory')}${chip('🛠', 'Maintenance requests')}
        </tr></table>
      </td></tr>

      <!-- Footer band -->
      <tr><td align="center" style="background:#0f172a;padding:16px 24px;">
        <div style="color:#94a3b8;font-size:11px;letter-spacing:1px;font-family:Arial,sans-serif;">POWERED BY PENIEL CHARIS TECHNOLOGIES LTD</div>
        <div style="color:#64748b;font-size:11px;margin-top:4px;font-family:Arial,sans-serif;">Ferrano Court &middot; <a href="${SITE_URL}" style="color:#5eead4;text-decoration:none;">${SITE_URL.replace(/^https?:\/\//, '')}</a></div>
      </td></tr>

    </table>
  </td></tr>
</table>`;

async function sendWelcomeEmail(email, password, loginUrl, name) {
  if (!API_KEY) throw new Error('BREVO_API_KEY is not set in Render environment');
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: SENDER_NAME, email: SENDER_EMAIL },
      to: [{ email, name: name || undefined }],
      subject: '🎉 Your Ferrano Court Portal keys are ready',
      htmlContent: buildWelcomeHtml(email, password, loginUrl, name),
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Brevo API error ${res.status}: ${text}`);
  console.log('✅ Welcome email accepted by Brevo for:', email);
  return text;
}

const buildResetHtml = (email, name, resetLink) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,0.12);">

      <!-- Header band -->
      <tr><td align="center" style="background:#0f172a;padding:28px 24px 22px 24px;">
        <img src="${LOGO_URL}" width="72" height="72" alt="Ferrano Court crest" style="display:block;border-radius:10px;margin:0 auto 12px auto;" />
        <div style="color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:2px;font-family:Arial,sans-serif;">FERRANO COURT PORTAL</div>
        <div style="color:#94a3b8;font-size:12px;letter-spacing:1px;margin-top:6px;font-family:Arial,sans-serif;">ONE COURT &middot; ONE PORTAL &middot; ZERO WAHALA</div>
      </td></tr>

      <!-- Body -->
      <tr><td style="background:#ffffff;padding:28px 32px;">
        <div style="font-size:22px;font-weight:bold;color:#0f172a;font-family:Arial,sans-serif;">Trouble signing in${name ? `, ${name}` : ''}? 🔑</div>
        <p style="font-size:14px;line-height:22px;color:#475569;margin:10px 0 18px 0;font-family:Arial,sans-serif;">
          Someone (hopefully you) asked to reset the password for <b>${email}</b>.
          Tap the button below and pick a fresh one — it takes about ten seconds.
        </p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td align="center" style="padding:6px 0 16px 0;">
            <a href="${resetLink}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;border-radius:10px;padding:14px 28px;font-size:16px;font-weight:bold;font-family:Arial,sans-serif;">Reset my password →</a>
          </td></tr>
        </table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;">
          <tr><td style="padding:12px 16px;font-size:13px;line-height:19px;color:#92400e;font-family:Arial,sans-serif;">
            ⏳ &nbsp;For safety, this link <b>expires in 15 minutes</b> and works once.<br/>
            🛡 &nbsp;If you did not request this, ignore this email — your password stays exactly as it is.
          </td></tr>
        </table>

        <p style="font-size:12px;line-height:18px;color:#94a3b8;margin:16px 0 0 0;font-family:Arial,sans-serif;">
          Button misbehaving? Paste this into your browser:<br/>
          <a href="${resetLink}" style="color:#0f766e;word-break:break-all;text-decoration:none;">${resetLink}</a>
        </p>
      </td></tr>

      <!-- Footer band -->
      <tr><td align="center" style="background:#0f172a;padding:16px 24px;">
        <div style="color:#94a3b8;font-size:11px;letter-spacing:1px;font-family:Arial,sans-serif;">POWERED BY PENIEL CHARIS TECHNOLOGIES LTD</div>
        <div style="color:#64748b;font-size:11px;margin-top:4px;font-family:Arial,sans-serif;">Ferrano Court &middot; <a href="${SITE_URL}" style="color:#5eead4;text-decoration:none;">${SITE_URL.replace(/^https?:\/\//, '')}</a></div>
      </td></tr>

    </table>
  </td></tr>
</table>`;

// Tolerant of both call styles in the codebase:
//   sendResetEmail(email, name, resetLink)  — routes/password.js
//   sendResetEmail(email, tokenOrLink)      — legacy routes/auth.js
async function sendResetEmail(email, a, b) {
  let name = null;
  let link = b;
  if (!link) {
    link = /^https?:\/\//.test(a || '') ? a : `${SITE_URL}/reset-password?token=${encodeURIComponent(a)}`;
  } else {
    name = a;
  }
  if (!API_KEY) throw new Error('BREVO_API_KEY is not set in Render environment');
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: SENDER_NAME, email: SENDER_EMAIL },
      to: [{ email, name: name || undefined }],
      subject: '🔑 Reset your Ferrano Court Portal password',
      htmlContent: buildResetHtml(email, name, link),
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Brevo API error ${res.status}: ${text}`);
  console.log('✅ Reset email accepted by Brevo for:', email);
  return text;
}

module.exports = { sendWelcomeEmail, sendResetEmail, buildWelcomeHtml, buildResetHtml };
