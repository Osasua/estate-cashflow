const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

console.log('SMTP_USER:', process.env.SMTP_USER);
console.log('SMTP_PASS:', process.env.SMTP_PASS ? '***LOADED***' : '❌ NOT FOUND');

// FIX 1: Updated to accept the full resetLink and name from the backend route
const sendResetEmail = async (email, name, resetLink) => {
  const mailOptions = {
    from: `"Ferrano Court Portal" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Password Reset Request',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4f46e5;">Ferrano Court Portal</h2>
        <h3>Hello ${name},</h3>
        <p>You requested a password reset for your account.</p>
        <p>Click the button below to set a new password. This link will expire in 15 minutes.</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
        </p>
        <p style="color: #666; font-size: 0.9rem;">If you did not request this, please ignore this email.</p>
      </div>
    `,
  };
  await transporter.sendMail(mailOptions);
};

const sendWelcomeEmail = async (email, password, loginUrl) => {
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

const sendReminderEmail = async (email, name, amount, period) => {
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
        <br>
        <p>Thank you,<br><strong>The Estate Management</strong></p>
      </div>
    `
  };
  await transporter.sendMail(mailOptions);
};

const sendBroadcastEmail = async (email, subject, message, residentName) => {
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
    `
  };
  await transporter.sendMail(mailOptions);
};

// FIX 2: Combined all functions into a SINGLE export statement
module.exports = { sendResetEmail, sendWelcomeEmail, sendReminderEmail, sendBroadcastEmail };
