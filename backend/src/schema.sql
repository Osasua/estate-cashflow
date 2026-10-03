-- Estate Cashflow — Updated Database Schema (PostgreSQL)

-- 1. Define Enums
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'treasurer', 'member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('cash', 'transfer', 'paystack', 'flutterwave');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- NEW: Contribution types for the 5 tabs
DO $$ BEGIN
  CREATE TYPE contribution_type AS ENUM ('monthly', 'float', 'projects', 'christmas', 'welfare');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Users Table (Supports Admin, Treasurer, and Member logins)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Members Table (Households)
CREATE TABLE IF NOT EXISTS members (
  id SERIAL PRIMARY KEY,
  household_name TEXT NOT NULL,
  house_number TEXT UNIQUE NOT NULL,
  phone TEXT,
  email TEXT,
  monthly_due NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (monthly_due >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Categories Table (Added is_active for Soft Deletes)
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE -- NEW: For soft deleting
);

-- 5. Contributions Table (Added 'type' for the 5 tabs)
CREATE TABLE IF NOT EXISTS contributions (
  id SERIAL PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  type contribution_type NOT NULL DEFAULT 'monthly', -- NEW
  period_year INTEGER NOT NULL,
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  amount_due NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Updated unique constraint to include 'type'
  UNIQUE (member_id, type, period_year, period_month) 
);

-- 6. Payments Table
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  contribution_id INTEGER NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  method payment_method NOT NULL DEFAULT 'cash',
  reference TEXT UNIQUE,
  note TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by INTEGER REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_payments_contribution ON payments(contribution_id);

-- 7. Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  category_id INTEGER REFERENCES categories(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  vendor TEXT,
  spent_on DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_url TEXT,
  recorded_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expenses_spent_on ON expenses(spent_on);

-- 8. Audit Log Table (Already existed, perfect for tracking edits!)
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL, -- e.g., 'UPDATE', 'DELETE'
  table_name TEXT NOT NULL,
  record_id INTEGER,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);