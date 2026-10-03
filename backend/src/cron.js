const { sendWhatsAppReminder } = require('./whatsapp');
const cron = require('node-cron');
const { query } = require('./db');
const { sendReminderEmail } = require('./mailer');

const startCronJobs = () => {
  // --- SCHEDULE CONFIGURATION ---
  // For TESTING: Change to '* * * * *' (Runs every minute)
  // For PRODUCTION: '0 9 5 * *' (Runs at 9:00 AM on the 5th of every month)
  const schedule = '0 9 5 * *'; 

  cron.schedule(schedule, async () => {
    console.log('⏰ [CRON] Running monthly reminder check...');
    
    try {
      // Find all contributions where amount paid is less than amount due
      // NOTE: Added m.phone to the SELECT statement
      const { rows } = await query(`
        SELECT m.email, m.phone, m.household_name as name, (c.amount_due - c.amount_paid) as outstanding, 
               to_char(to_date(c.period_year || '-' || c.period_month, 'YYYY-MM'), 'Month YYYY') as period
        FROM contributions c
        JOIN members m ON c.member_id = m.id
        WHERE c.amount_paid < c.amount_due AND m.email = 'osasua@gmail.com';
      `);

      if (rows.length === 0) {
        console.log('✅ [CRON] No outstanding contributions found. All caught up!');
        return;
      }

      console.log(`📧 [CRON] Found ${rows.length} outstanding contributions. Sending reminders...`);

      // Send an email and WhatsApp to each defaulter
      for (const row of rows) {
        try {
          // 1. Send Email
          await sendReminderEmail(row.email, row.name, row.outstanding, row.period);
          console.log(`   -> Email sent to ${row.email}`);

          // 2. Send WhatsApp (if phone number exists)
          if (row.phone) {
            await sendWhatsAppReminder(row.phone, row.name, row.outstanding, row.period);
          } else {
            console.log(`   -> Skipped WhatsApp for ${row.name} (No phone number)`);
          }
        } catch (err) {
          console.error(`   -> Failed to notify ${row.name}:`, err.message);
        }
      }
      
      console.log('✅ [CRON] Reminder job completed successfully.');
    } catch (error) {
      console.error('❌ [CRON] Job failed:', error);
    }
  });
};

module.exports = { startCronJobs };