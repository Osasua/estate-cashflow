-- ============================================================================
-- estate-cashflow — consolidated deployment migration
--
-- Brings ANY database (fresh schema.sql build or the long-lived production
-- one) fully up to date with the app, in one idempotent script.
-- Paste into the Neon SQL editor, or run:
--   psql "$DATABASE_URL" -f backend/deploy-migrations.sql
-- Safe to re-run; changes nothing that already exists.
-- ============================================================================

-- 0. Tables that older environments created via one-off scripts. Included so
--    a fresh database gets the complete app schema from this single file.
CREATE TABLE IF NOT EXISTS estate_opening_balance (
  id SERIAL PRIMARY KEY,
  opening_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  effective_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO estate_opening_balance (opening_balance, effective_date, notes)
SELECT 0, '2026-01-01', 'System initialized'
 WHERE NOT EXISTS (SELECT 1 FROM estate_opening_balance);

CREATE TABLE IF NOT EXISTS board_posts (
  id SERIAL PRIMARY KEY,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('notice', 'event')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  event_date DATE,
  event_time TEXT,
  location TEXT,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_board_posts_created ON board_posts(created_at DESC);

CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGSERIAL PRIMARY KEY,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  image_mime TEXT,
  image_data TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_id ON chat_messages(id);

CREATE TABLE IF NOT EXISTS meeting_minutes (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  meeting_date DATE NOT NULL,
  content TEXT NOT NULL,
  document_link TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 1. Login -> household link (+ move dates).
--    (Enum values older environments added via one-off scripts:)
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'secretary';
ALTER TYPE contribution_type ADD VALUE IF NOT EXISTS 'arrears';
ALTER TYPE contribution_type ADD VALUE IF NOT EXISTS 'end-of-year';

ALTER TABLE users ADD COLUMN IF NOT EXISTS member_id INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS move_in_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS move_out_date DATE;

-- 2. Per-fund opening balances (the single source of truth shared by
--    Reports and the Dashboard).
CREATE TABLE IF NOT EXISTS fund_opening_balances (
  fund_type       TEXT PRIMARY KEY,
  opening_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  effective_date  DATE NOT NULL DEFAULT '2026-01-01',
  notes           TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

--    One-time carry-over of the legacy estate opening into the new table.
DO $$
BEGIN
  IF to_regclass('public.estate_opening_balance') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM fund_opening_balances WHERE fund_type = 'estate') THEN
    INSERT INTO fund_opening_balances (fund_type, opening_balance, effective_date, notes)
    SELECT 'estate', opening_balance, effective_date,
           COALESCE(notes, 'Migrated from estate_opening_balance')
      FROM estate_opening_balance WHERE id = 1;
  END IF;
END $$;

-- 3. Reminder audit log + 7-day spam cooldown.
CREATE TABLE IF NOT EXISTS payment_reminders (
  id BIGSERIAL PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  contribution_id INTEGER NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'email',
  fund TEXT,
  outstanding_at_send NUMERIC(12,2),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reminders_contribution ON payment_reminders(contribution_id);
CREATE INDEX IF NOT EXISTS idx_reminders_sent_at ON payment_reminders(sent_at);

-- 4. Per-category annual budgets.
CREATE TABLE IF NOT EXISTS category_budgets (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  budget_year INTEGER NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category_id, budget_year)
);

-- 5. Maintenance requests (member self-service).
CREATE TABLE IF NOT EXISTS maintenance_requests (
  id SERIAL PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'in-progress', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_maintenance_member ON maintenance_requests(member_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_requests(status);

-- ----------------------------------------------------------------------------
-- payment_method enum: production payment rows already use 'bank_transfer'
-- (statement imports) and the bill-edit audit guardrail writes 'adjustment'
-- rows. Idempotent: each value is added only if missing. Safe to re-run.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                  WHERE t.typname = 'payment_method' AND e.enumlabel = 'bank_transfer') THEN
    ALTER TYPE payment_method ADD VALUE 'bank_transfer';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                  WHERE t.typname = 'payment_method' AND e.enumlabel = 'adjustment') THEN
    ALTER TYPE payment_method ADD VALUE 'adjustment';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- payments.amount: allow negative rows. The bill-edit audit guardrail writes
-- 'adjustment' rows for the signed difference of an edit; reducing a bill's
-- paid amount is a legitimate correction and must be representable.
-- Idempotent: drops and recreates the check constraint. Safe to re-run.
-- ----------------------------------------------------------------------------
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_amount_check;
ALTER TABLE payments ADD CONSTRAINT payments_amount_check CHECK (amount <> 0);

-- ============================================================================
-- Done. After deploying the app, set each fund's brought-forward cash once:
--   Reports -> Opening Balances -> Update Opening Balance -> Fund: Float
-- (The legacy single estate figure does NOT auto-split across funds.)
-- ============================================================================

-- 12. Ferrano Pages — resident directory (up to 2 people per household).
CREATE TABLE IF NOT EXISTS directory_entries (
  id SERIAL PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  slot SMALLINT NOT NULL CHECK (slot IN (1, 2)),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  occupation TEXT,
  organization TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (member_id, slot)
);
CREATE INDEX IF NOT EXISTS idx_directory_member ON directory_entries(member_id);

-- 13. Ferrano Gate Access — visitor codes + gate notification log.
CREATE TABLE IF NOT EXISTS access_codes (
  id SERIAL PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  visitor_name TEXT NOT NULL,
  visitor_phone TEXT,
  arrives_at TIMESTAMPTZ NOT NULL,
  departs_at TIMESTAMPTZ NOT NULL,
  people_count INTEGER NOT NULL DEFAULT 1 CHECK (people_count >= 1),
  vehicle TEXT,
  note TEXT,
  revoked_at TIMESTAMPTZ,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (departs_at > arrives_at)
);
CREATE INDEX IF NOT EXISTS idx_access_codes_member ON access_codes(member_id);
CREATE INDEX IF NOT EXISTS idx_access_codes_window ON access_codes(arrives_at, departs_at);
CREATE TABLE IF NOT EXISTS gate_alerts (
  id BIGSERIAL PRIMARY KEY,
  access_code_id INTEGER NOT NULL REFERENCES access_codes(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  status TEXT NOT NULL,
  detail TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gate_alerts_code ON gate_alerts(access_code_id);

-- 14. Missing contributions.note column.
-- Backend (routes/my-account.js STEP 7, routes/contributions.js) selects c.note;
-- without this column GET /api/my-account?type=<fund> fails with 500
-- ("column c.note does not exist"), so the My Account per-fund tabs and their
-- Pay Now buttons never render. Idempotent: safe to re-run any time.
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS note TEXT;

-- 15. Facility Manager role: owns the maintenance queue and receives
-- resident maintenance emails. NOT in staff (no finances), NOT in comms.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'facility';

-- 16. Gate security role: read-only verification view of visitor codes
-- (the gatehouse console). Cannot issue or revoke codes.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'gate';
