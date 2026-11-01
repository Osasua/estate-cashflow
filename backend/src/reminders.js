/**
 * Payment reminders — who owes what, and who has already been nudged.
 *
 * runReminders() is the single entry point used by:
 *   - the weekly cron job (Monday 09:00, see cron.js)
 *   - POST /api/reminders/send (staff, manual trigger)
 * A 7-day cooldown per outstanding bill (payment_reminders table) means a
 * household is never emailed twice about the same bill within a week,
 * whether the trigger is the cron or an impatient treasurer.
 */
const { query } = require('./db');
const { sendReminderEmail } = require('./mailer');
const { frontendUrl } = require('./frontend-url');

const COOLDOWN_DAYS = 7;

const FUND_LABEL = {
  monthly: 'Monthly',
  float: 'Float',
  projects: 'Projects',
  'end-of-year': 'End of Year',
  welfare: 'Welfare',
  arrears: 'Arrears',
};

async function findDefaulters() {
  const { rows } = await query(
    `SELECT c.id AS contribution_id, m.id AS member_id, m.email, m.phone,
            m.household_name AS name, m.house_number,
            (c.amount_due - c.amount_paid) AS outstanding,
            initcap(trim(to_char(make_date(c.period_year, c.period_month, 1), 'Month YYYY'))) AS period,
            c.type::text AS fund
       FROM contributions c
       JOIN members m ON m.id = c.member_id
      WHERE c.amount_due > 0
        AND c.amount_paid < c.amount_due
        AND m.active = true
        AND COALESCE(m.email, '') <> ''
        AND NOT EXISTS (
              SELECT 1 FROM payment_reminders pr
               WHERE pr.contribution_id = c.id
                 AND pr.sent_at > now() - make_interval(days => $1)
            )
      ORDER BY CAST(regexp_replace(m.house_number, '[^0-9]', '', 'g') AS INTEGER),
               m.house_number`,
    [COOLDOWN_DAYS]
  );
  return rows.map((r) => ({ ...r, outstanding: parseFloat(r.outstanding) || 0 }));
}

/**
 * @param {object} opts
 * @param {boolean} opts.dryRun  select targets but send nothing, log nothing
 * @returns summary { found, sent, failed, targets }
 */
async function runReminders({ dryRun = false } = {}) {
  const targets = await findDefaulters();
  if (dryRun) {
    return { found: targets.length, sent: 0, failed: 0, dryRun: true, targets };
  }

  const payUrl = `${frontendUrl()}/my-account`;
  let sent = 0;
  let failed = 0;

  for (const t of targets) {
    try {
      await sendReminderEmail(t.email, t.name, t.outstanding, t.period, payUrl, FUND_LABEL[t.fund] || t.fund);
      await query(
        `INSERT INTO payment_reminders (member_id, contribution_id, channel, fund, outstanding_at_send)
         VALUES ($1, $2, 'email', $3, $4)`,
        [t.member_id, t.contribution_id, t.fund, t.outstanding]
      );
      sent += 1;
    } catch (err) {
      failed += 1;
      console.error(`[reminders] email failed for ${t.name} <${t.email}>:`, err.message);
    }

    // WhatsApp is best-effort and only when Twilio is configured.
    if (t.phone && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      try {
        // Lazy require: the Twilio SDK must not crash boot when unconfigured.
        const { sendWhatsAppReminder } = require('./whatsapp');
        await sendWhatsAppReminder(t.phone, t.name, t.outstanding, t.period);
        await query(
          `INSERT INTO payment_reminders (member_id, contribution_id, channel, fund, outstanding_at_send)
           VALUES ($1, $2, 'whatsapp', $3, $4)`,
          [t.member_id, t.contribution_id, t.fund, t.outstanding]
        );
      } catch (err) {
        console.error(`[reminders] whatsapp failed for ${t.name}:`, err.message);
      }
    }
  }

  return { found: targets.length, sent, failed, dryRun: false };
}

module.exports = { runReminders, findDefaulters, COOLDOWN_DAYS };
