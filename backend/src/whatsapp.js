const twilio = require('twilio');

// Initialize Twilio client
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID, 
  process.env.TWILIO_AUTH_TOKEN
);

const sendWhatsAppReminder = async (phoneNumber, name, amount, period) => {
  phoneNumber = normalizePhone(phoneNumber);

  const message = `Hello ${name},\n\nThis is a friendly reminder from Ferrano Court Portal.\n\nYou have an outstanding contribution of ₦${Number(amount).toLocaleString()} for the period of ${period}.\n\nPlease log in to your resident account to complete your payment securely.\n\nThank you,\nEstate Management.`;

  try {
    await client.messages.create({
      body: message,
      from: fromNumber(),
      to: `whatsapp:${phoneNumber}` // Twilio requires 'whatsapp:' prefix for sandbox
    });
    console.log(`   -> WhatsApp sent to ${phoneNumber}`);
  } catch (error) {
    console.error(`   -> Failed to send WhatsApp to ${phoneNumber}:`, error.message);
  }
};

// Normalize any stored phone format to E.164 (assumes Nigeria when local)
const normalizePhone = (p) => {
  let d = String(p).replace(/[^\d+]/g, '');
  if (d.startsWith('+')) return d;
  if (d.startsWith('00')) return '+' + d.slice(2);
  if (d.startsWith('0')) return '+234' + d.slice(1);
  if (d.startsWith('234')) return '+' + d;
  return '+234' + d;
};

// Twilio expects the sender prefixed with 'whatsapp:' — tolerate either form
const fromNumber = () => {
  const f = String(process.env.TWILIO_WHATSAPP_NUMBER || '');
  return f.startsWith('whatsapp:') ? f : 'whatsapp:' + f;
};

// Generic WhatsApp sender (broadcasts, notices). Throws on failure.
const sendWhatsAppMessage = async (phoneNumber, body) => {
  if (!phoneNumber) throw new Error('No phone number');
  await client.messages.create({
    body,
    from: fromNumber(),
    to: `whatsapp:${normalizePhone(phoneNumber)}`
  });
};

const whatsappConfigured = () =>
  !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_NUMBER);

module.exports = { sendWhatsAppReminder, sendWhatsAppMessage, whatsappConfigured };