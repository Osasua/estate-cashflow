-- ============================================================================
-- Ferrano Court Portal — balance reconciliation & duplicate hunt (READ-ONLY)
-- ----------------------------------------------------------------------------
-- Paste this whole file into the Neon SQL editor and press Run. Every statement
-- is a SELECT: nothing is inserted, updated or deleted. Send the results back
-- and we can pinpoint exactly which component of the cash balance is wrong.
--
-- What the app's cash figure is made of, per fund:
--     implied cash = manual opening (fund_opening_balances)
--                  + all-time contributions (amount_paid)
--                  - all-time expenses (amount)
-- Dashboard "Cash Balance" and Reports "Closing Balance" (All Funds) must equal
-- the sum of implied cash over every fund, INCLUDING the estate pot (which has
-- no activity rows of its own).
-- ============================================================================

-- 1) The manual openings currently booked (the chips on Reports → Opening Balances)
SELECT fund_type, opening_balance, effective_date, notes, updated_at
  FROM fund_opening_balances
 ORDER BY fund_type;

-- 2) Cash walk per fund, all time. "net_activity" is what the transaction books
--    say; "manual_opening" is brought-forward cash; implied_cash_today must tie
--    to what you believe is in the bank for that fund.
WITH coll AS (
  SELECT type::text AS fund, SUM(amount_paid) AS collected, COUNT(*) AS rows_ct
    FROM contributions GROUP BY 1
), spend AS (
  SELECT type::text AS fund, SUM(amount) AS spent, COUNT(*) AS rows_ct
    FROM expenses GROUP BY 1
), opn AS (
  SELECT fund_type AS fund, opening_balance FROM fund_opening_balances
)
SELECT COALESCE(c.fund, s.fund, o.fund)                      AS fund,
       COALESCE(c.collected, 0)                              AS collected_all_time,
       COALESCE(s.spent, 0)                                  AS spent_all_time,
       COALESCE(c.collected, 0) - COALESCE(s.spent, 0)       AS net_activity,
       COALESCE(o.opening_balance, 0)                        AS manual_opening,
       COALESCE(c.collected, 0) - COALESCE(s.spent, 0)
         + COALESCE(o.opening_balance, 0)                    AS implied_cash_today,
       COALESCE(c.rows_ct, 0)                                AS contribution_rows,
       COALESCE(s.rows_ct, 0)                                AS expense_rows
  FROM coll c
  FULL JOIN spend s USING (fund)
  FULL JOIN opn   o USING (fund)
 ORDER BY 1;

-- 2b) The single number Dashboard "Cash Balance" / Reports "Closing Balance"
--     (All Funds) must show. Compare with your screen.
WITH act AS (
  SELECT type::text AS fund, SUM(amount_paid) AS coll, 0 AS sp FROM contributions GROUP BY 1
  UNION ALL
  SELECT type::text, 0, SUM(amount) FROM expenses GROUP BY 1
), net AS (
  SELECT fund, SUM(coll) AS coll, SUM(sp) AS sp FROM act GROUP BY fund
)
SELECT COALESCE(SUM(net.coll), 0) - COALESCE(SUM(net.sp), 0)
       + COALESCE((SELECT SUM(opening_balance) FROM fund_opening_balances), 0)
       AS dashboard_cash_balance_should_be
  FROM net;

-- 3) OVERLAP TEST — transactions dated BEFORE a fund's opening-balance effective
--    date. Anything returned here is counted TWICE (once inside the manual
--    opening, once as activity). Expected: zero rows.
SELECT 'contribution' AS kind, type::text AS fund, period_year, period_month,
       amount_paid AS amount, created_at::date AS dated
  FROM contributions c
  JOIN fund_opening_balances f ON f.fund_type = c.type::text
 WHERE make_date(period_year, period_month, 1) < f.effective_date::date
UNION ALL
SELECT 'expense', type::text,
       EXTRACT(year FROM spent_on)::int, EXTRACT(month FROM spent_on)::int,
       amount, spent_on
  FROM expenses e
  JOIN fund_opening_balances f ON f.fund_type = e.type::text
 WHERE e.spent_on < f.effective_date::date
 ORDER BY 6;

-- 4) DUPLICATE BILLS — same household, same fund, same period billed/paid twice.
--    Expected: zero rows (one row per household per fund per month).
SELECT member_id, type::text AS fund, period_year, period_month,
       COUNT(*) AS bill_rows, SUM(amount_paid) AS total_paid
  FROM contributions
 WHERE amount_paid > 0
 GROUP BY 1, 2, 3, 4
HAVING COUNT(*) > 1
 ORDER BY bill_rows DESC;

-- 5) DUPLICATE EXPENSES — same fund, category, amount and date more than once.
--    Expected: zero rows (or genuine same-day repeats you can recognise).
SELECT type::text AS fund, category_id, amount, spent_on,
       COUNT(*) AS rows_ct, array_agg(id ORDER BY id) AS expense_ids
  FROM expenses
 GROUP BY 1, 2, 3, 4
HAVING COUNT(*) > 1;

-- 6) DOUBLE-TAKEN PAYMENTS — one bill with more than one payment row against it
--    (e.g. Paystack charge plus a cash recording of the same money).
SELECT p.contribution_id, COUNT(*) AS payment_rows, SUM(p.amount) AS total_taken,
       c.type::text AS fund, c.period_year, c.period_month,
       m.house_number, m.household_name
  FROM payments p
  JOIN contributions c ON c.id = p.contribution_id
  LEFT JOIN members m ON m.id = c.member_id
 GROUP BY 1, 4, 5, 6, 7, 8
HAVING COUNT(*) > 1;

-- 7) Every paid bill for the current viewing month (Nov 2026) so the
--    "Collected this month ₦235,000" figure can be checked by hand, line by line.
SELECT c.id, m.house_number, m.household_name, c.type::text AS fund,
       c.period_year, c.period_month, c.amount_due, c.amount_paid, c.created_at::date
  FROM contributions c
  LEFT JOIN members m ON m.id = c.member_id
 WHERE c.amount_paid > 0 AND c.period_year = 2026 AND c.period_month = 11
 ORDER BY c.id;
