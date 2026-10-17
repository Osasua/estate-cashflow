const nodemailer = require('nodemailer');
const dns = require('dns').promises;

const SMTP_HOSTNAME = process.env.SMTP_HOST || 'smtp.gmail.com';

// Build a transporter that ALWAYS connects over IPv4
async function createTransporter() {
  let host = SMTP_HOSTNAME;
  let tlsOptions = {};

  try {
    // Resolve ONLY IPv4 addresses (never IPv6)
    const ips = await dns.resolve4(SMTP_HOSTNAME);
    if (ips && ips.length > 0) {
      host = ips[0];
      console.log('📡 Resolved SMTP IPv4 address:', host);
      // Keep TLS certificate validation correct even though we connect via IP
      tlsOptions = { servername: SMTP_HOSTNAME };
    }
  } catch (e) {
    console.warn('️ IPv4 resolution failed, falling back to hostname:', e.message);
  }

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: tlsOptions,
  });
}

const sendWelcomeEmail = async (email, password, loginUrl) => {
  const transporter = await createTransporter();
  const mailOptions = {
    from: `"Ferrano Court Portal" <${process.env.SMTP_USER}>`,
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
  };
  await transporter.sendMail(mailOptions);
};

const sendResetEmail = async (email, name, resetLink) => {
  const transporter = await createTransporter();
  const mailOptions = {
    from: `"Ferrano Court Portal" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Password Reset Request',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4f46e5;">Ferrano Court Portal</h2>
        <h3>Hello ${name},</h3>
        <p>You requested a password reset for your account.</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; borderRadius: 5px; font-weight: bold;">Reset Password</a>
        </p>
        <p style="color: #666; font-size: 0.9rem;">If you did not request this, please ignore this email.</p>
      </div>
    `,
  };
  await transporter.sendMail(mailOptions);
};

const sendReminderEmail = async (email, name, amount, period) => {
  const transporter = await createTransporter();
  const mailOptions = {
    from: `"Ferrano Estate Management" <${process.env.SMTP_USER}>`,
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
  };
  await transporter.sendMail(mailOptions);
};

const sendBroadcastEmail = async (email, subject, message, residentName) => {
  const transporter = await createTransporter();
  const mailOptions = {
    from: `"Ferrano Court Portal" <${process.env.SMTP_USER}>`,
    to: email,
    subject: subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; color: #333;">
        <h2 style="color: #4f46e5;">Hello ${residentName || 'Resident'},</h2>
        <p style="font-size: 16px; line-height: 1.6; white-space: pre-wrap;">${message}</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="font-size: 12px; color: #888;">This is an official broadcast from the Ferrano Court Estate Management.</p>
      </div>
    `,
  };
  await transporter.sendMail(mailOptions);
};

module.exports = { sendResetEmail, sendWelcomeEmail, sendReminderEmail, sendBroadcastEmail };