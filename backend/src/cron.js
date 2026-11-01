/**
 * Background jobs.
 *
 * Weekly payment reminders — Mondays 09:00. Scans every fund for households
 * still owing, emails each one a Brevo reminder with a Paystack pay link
 * (WhatsApp too when Twilio is configured), and respects a 7-day cooldown
 * per bill so nobody is nagged twice in a week.
 *
 * The sender lives in src/reminders.js and is shared with the manual
 * "Remind defaulters" button (POST /api/reminders/send), so cron and manual
 * runs can never double-send inside the cooldown window.
 */
const cron = require('node-cron');
const { runReminders } = require('./reminders');

// For TESTING: '* * * * *' (every minute). For PRODUCTION: Mondays 09:00.
const REMINDER_SCHEDULE = process.env.REMINDER_SCHEDULE || '0 9 * * 1';

const startCronJobs = () => {
  cron.schedule(REMINDER_SCHEDULE, async () => {
    console.log('⏰ [CRON] Weekly payment reminder run starting...');
    try {
      const summary = await runReminders();
      console.log(
        `✅ [CRON] Reminders done — found ${summary.found}, sent ${summary.sent}, failed ${summary.failed}`
      );
    } catch (error) {
      console.error('❌ [CRON] Reminder job failed:', error);
    }
  });
  console.log(`⏰ [CRON] Weekly reminders scheduled: "${REMINDER_SCHEDULE}"`);
};

module.exports = { startCronJobs };
