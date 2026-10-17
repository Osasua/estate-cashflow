// backend/src/mailer.js — Brevo HTTPS API (no SMTP, no IPv6 issues)
const API_KEY = process.env.BREVO_API_KEY;
const SENDER_EMAIL = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'osasua@gmail.com';
const SENDER_NAME = process.env.SMTP_FROM_NAME || 'Ferrano Court Portal';

async function sendEmail({ to, subject, html }) {
  if (!API_KEY) throw new Error('BREVO_API_KEY is not set in Render environment');

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: SENDER_NAME, email: SENDER_EMAIL },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Brevo API error ${res.status}: ${text}`);
  console.log('✅ Email accepted by Brevo for:', to);
  return text;
}

const sendWelcomeEmail = async (email, password, loginUrl) => {
  await sendEmail({
    to: email,
    subject: 'Welcome to Ferrano Court Portal - Your Login Details',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4f46e5;">Welcome to Ferrano Court Portal!</h2>
        <p>Your account has been created by the Estate Treasurer.</p>
        <p>You can now view your bills, payment history, and estate reports.</p>
        <h3>Your Login Details:</h3>
        <ul>
          <li><strong>Link:</strong> <a href="${loginUrl}">${loginUrl}</a></li>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Temporary Password:</strong> ${password}</li>
        </ul>
        <p><em>For security, please change your password immediately after your first login.</em></p>
      </div>
    `,
  });
};

const sendResetEmail = async (email, name, resetLink) => {
  await sendEmail({
    to: email,
    subject: 'Password Reset Request',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4f46e5;">Ferrano Court Portal</h2>
        <h3>Hello ${name},</h3>
        <p>You requested a password reset for your account.</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
        </p>
        <p style="color: #666; font-size: 0.9rem;">If you did not request this, please ignore this email.</p>
      </div>
    `,
  });
};

const sendReminderEmail = async (email, name, amount, period) => {
  await sendEmail({
    to: email,
    subject: `Reminder: Outstanding Contribution for ${period}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4f46e5;">Ferrano Court Portal</h2>
        <h3>Hello ${name},</h3>
        <p>This is a friendly reminder that you have an outstanding contribution of <strong style="color: #ef4444;">₦${Number(amount).toLocaleString()}</strong> for the period of <strong>${period}</strong>.</p>
        <p>Please log in to your resident account to complete your payment securely online.</p>
      </div>
    `,
  });
};

const sendBroadcastEmail = async (email, subject, message, residentName) => {
  await sendEmail({
    to: email,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; color: #333;">
        <h2 style="color: #4f46e5;">Hello ${residentName || 'Resident'},</h2>
        <p style="font-size: 16px; line-height: 1.6; white-space: pre-wrap;">${message}</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="font-size: 12px; color: #888;">This is an official broadcast from the Ferrano Court Estate Management.</p>
      </div>
    `,
  });
};

module.exports = { sendResetEmail, sendWelcomeEmail, sendReminderEmail, sendBroadcastEmail };