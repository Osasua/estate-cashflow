/**
 * Opening balances — single source of truth.
 *
 * The estate keeps cash per FUND (monthly = general fund, float, projects,
 * end-of-year, welfare) plus an unallocated "estate" pot for money brought
 * into the system before funds existed. Every screen (Reports, Dashboard,
 * every fund tab) must derive its opening figure from here so the same fund
 * never tells two different stories in two places.
 *
 * Storage: fund_opening_balances(fund_type PK, opening_balance, effective_date, notes)
 * Legacy:  estate_opening_balance(id = 1) is kept in sync for the 'estate' key
 *          so older scripts and rollbacks continue to work.
 */
const { query } = require('./db');

const FUND_KEYS = ['estate', 'monthly', 'float', 'projects', 'end-of-year', 'welfare'];

const FUND_LABELS = {
  estate: 'Estate (general / unallocated)',
  monthly: 'Monthly',
  float: 'Float',
  projects: 'Projects',
  'end-of-year': 'End of Year',
  welfare: 'Welfare',
};

/** All manual openings keyed by fund, zeros included. */
async function getManualOpenings() {
  const amounts = { estate: 0, monthly: 0, float: 0, projects: 0, 'end-of-year': 0, welfare: 0 };
  const meta = {};
  const { rows } = await query(
    `SELECT fund_type, opening_balance, effective_date, notes, updated_at
       FROM fund_opening_balances`
  );
  for (const r of rows) {
    if (!(r.fund_type in amounts)) continue; // ignore unknown/retired keys
    amounts[r.fund_type] = parseFloat(r.opening_balance) || 0;
    meta[r.fund_type] = {
      effective_date: r.effective_date,
      notes: r.notes,
      updated_at: r.updated_at,
    };
  }
  return { amounts, meta };
}

/**
 * Which manual openings belong to a given view?
 *  - unscoped (whole estate): every naira brought in manually, whichever fund
 *    it was tagged to — it is all real cash in the bank.
 *  - 'monthly' (the general fund): the estate pot + monthly's own opening.
 *    Estate decision: general cash originated from monthly contributions, so
 *    Monthly carries the estate pot.
 *  - any other fund: that fund's own opening only.
 */
function manualForScope(amounts, scope) {
  if (!scope) return FUND_KEYS.reduce((s, k) => s + (amounts[k] || 0), 0);
  if (scope === 'monthly') return (amounts.estate || 0) + (amounts.monthly || 0);
  return amounts[scope] || 0;
}

/** Upsert one fund's manual opening. Keeps the legacy estate row in sync. */
async function setManualOpening(fund, amount, effectiveDate, notes) {
  if (!FUND_KEYS.includes(fund)) {
    throw new Error(`Unknown fund "${fund}". Expected one of: ${FUND_KEYS.join(', ')}`);
  }
  const res = await query(
    `INSERT INTO fund_opening_balances (fund_type, opening_balance, effective_date, notes, updated_at)
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
     ON CONFLICT (fund_type) DO UPDATE
       SET opening_balance = EXCLUDED.opening_balance,
           effective_date  = EXCLUDED.effective_date,
           notes           = EXCLUDED.notes,
           updated_at      = CURRENT_TIMESTAMP
     RETURNING fund_type, opening_balance, effective_date, notes`,
    [fund, amount, effectiveDate, notes]
  );
  if (fund === 'estate') {
    // Legacy mirror so pre-fund scripts/queries stay correct.
    await query(
      `UPDATE estate_opening_balance
          SET opening_balance = $1, effective_date = $2, notes = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = 1`,
      [amount, effectiveDate, notes]
    );
  }
  return res.rows[0];
}

/**
 * Remove one fund's manual opening entirely (fund falls back to ₦0.00).
 * Used when an opening was entered by mistake or twice — e.g. the same cash
 * already lived in the legacy estate pot. Keeps the legacy mirror in sync.
 */
async function deleteManualOpening(fund) {
  if (!FUND_KEYS.includes(fund)) {
    throw new Error(`Unknown fund "${fund}". Expected one of: ${FUND_KEYS.join(', ')}`);
  }
  const res = await query(
    `DELETE FROM fund_opening_balances WHERE fund_type = $1 RETURNING fund_type`,
    [fund]
  );
  if (fund === 'estate') {
    // Legacy mirror so pre-fund scripts/queries stay correct.
    await query(
      `UPDATE estate_opening_balance
          SET opening_balance = 0, notes = 'Opening balance deleted', updated_at = CURRENT_TIMESTAMP
        WHERE id = 1`
    );
  }
  return res.rowCount > 0;
}

module.exports = { FUND_KEYS, FUND_LABELS, getManualOpenings, manualForScope, setManualOpening, deleteManualOpening };
