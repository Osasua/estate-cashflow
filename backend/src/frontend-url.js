// Single source of truth for the public frontend origin(s).
//
// FRONTEND_URL accepts a comma-separated list, e.g.
//   FRONTEND_URL=https://ferranocourt.estate,https://estate-cashflow-wheat.vercel.app
// The FIRST entry is the canonical origin used in emails, password-reset
// links and Paystack callbacks; ALL entries are accepted by CORS so a domain
// migration can overlap without locking anyone out.
const list = () =>
  (process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const primary = () => list()[0];

module.exports = { allowedOrigins: list, frontendUrl: primary };
