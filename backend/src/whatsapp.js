const twilio = require('twilio');

// Initialize Twilio client
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID, 
  process.env.TWILIO_AUTH_TOKEN
);

const sendWhatsAppReminder = async (phoneNumber, name, amount, period) => {
  // Format phone number to international format (e.g., +2348012345678)
  // Ensure the number in your database starts with + and country code
  if (!phoneNumber.startsWith('+')) {
    phoneNumber = '+234' + phoneNumber.replace(/^0/, ''); // Auto-fix Nigerian numbers
  }

  const message = `Hello ${name},\n\nThis is a friendly reminder from Ferrano Court Portal.\n\nYou have an outstanding contribution of ₦${Number(amount).toLocaleString()} for the period of ${period}.\n\nPlease log in to your resident account to complete your payment securely.\n\nThank you,\nEstate Management.`;

  try {
    await client.messages.create({
      body: message,
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: `whatsapp:${phoneNumber}` // Twilio requires 'whatsapp:' prefix for sandbox
    });
    console.log(`   -> WhatsApp sent to ${phoneNumber}`);
  } catch (error) {
    console.error(`   -> Failed to send WhatsApp to ${phoneNumber}:`, error.message);
  }
};

module.exports = { sendWhatsAppReminder };