# Estate Cashflow 🏘️

Manage monthly contributions and expenses (cash flow) for an estate community.
Built for ~100 households, Naira-denominated, with a Treasurer + Admin role model.

## Features (MVP)

- **Roles:** `admin` and `treasurer` can record/edit; `member` is read-only.
- **Contributions:** generate monthly bills for all households, record payments
  (cash / transfer), track paid / partial / pending status, defaulter list.
- **Expenses:** daily entry with categories, daily totals, weekly totals,
  quick filters (today / this week / this month).
- **Dashboard:** cash balance, collected vs expected, pending households,
  daily & weekly expense charts, category breakdown, 6-month cash-flow trend.
- **Reports:** monthly statement (opening balance → receipts → expenses →
  closing balance), expense detail, per-household status; CSV export.
- **Offline:** writes made without connectivity are queued on the device and
  replayed automatically when back online (PWA service worker included).
- **Audit log:** every financial write is recorded (who, what, old → new).

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite, Recharts, vite-plugin-pwa (PWA → Capacitor for native later) |
| Backend | Node.js + Express, JWT auth |
| Database | PostgreSQL (money as NUMERIC — never float) |

## Quick Start

Prereqs: Docker (for Postgres), Node 18+.

```bash
# 1. Database
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env        # then edit JWT_SECRET
npm install
npm run migrate             # create tables
npm run seed                # demo users, 100 households, 4 months of data
npm run dev                 # API on http://localhost:4000

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev                 # App on http://localhost:5173 (proxies /api)
```

### Demo logins (from the seed)

| Role | Email | Password |
|---|---|---|
| Admin | admin@estate.local | ChangeMe123! |
| Treasurer | treasurer@estate.local | ChangeMe123! |

> ⚠️ Change these before deploying anywhere real.

## Project Structure

```
├── docker-compose.yml        # Postgres 16
├── backend/
│   ├── src/
│   │   ├── schema.sql        # all tables (idempotent)
│   │   ├── index.js          # Express app
│   │   ├── auth.js           # JWT + role middleware
│   │   ├── audit.js          # audit-log helper
│   │   └── routes/           # auth, members, contributions, expenses,
│   │                         # dashboard, reports, payments (webhook)
│   └── scripts/              # migrate, seed
└── frontend/
    └── src/
        ├── api.js            # fetch wrapper + offline write queue
        ├── auth.jsx          # auth context
        └── pages/            # Login, Dashboard, Expenses, Contributions, Reports
```

## Roadmap / Known Gaps

- **Paystack / Flutterwave:** webhook endpoint scaffolded
  (`routes/payments.js`, signature-verified). Phase 2: create pending payments
  via gateway checkout, confirm on `charge.success`, credit the contribution.
- **PDF reports:** CSV export works now; PDF via server-side renderer is Phase 2.
- **Full offline reads:** writes queue offline; dashboards need connectivity.
  Phase 2: cache reads in IndexedDB.
- **Notifications:** SMS/WhatsApp/email payment reminders — Phase 3.
- **Receipt uploads:** `receipt_url` column exists; file storage Phase 2.
- **Native apps:** wrap the PWA with Capacitor — same codebase.
- **PWA icons:** add 192/512px icons in `vite.config.js` before production.
