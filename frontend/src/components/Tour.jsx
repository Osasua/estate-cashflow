import React, { useEffect, useMemo, useState } from 'react';

/**
 * In-app guided tour — a spotlight + tooltip over the LIVE UI.
 * Steps whose anchor is not present for the signed-in role are skipped
 * automatically, so members and staff each get their own route through
 * the portal. Launched from the sidebar ("Take the tour") and offered
 * once automatically on first login.
 */
const STEPS = [
  { sel: '[data-tour="nav-dashboard"]', title: "Dashboard — your home", body: "Cash balance, this month's collections and spending at a glance. Every figure recalculates live from the ledger." },
  { sel: '[data-tour="dash-tabs"]', title: "Fund tabs", body: "Switch between Overview and each fund — Monthly, Float, Projects, End of Year, Welfare — to see that fund's own story." },
  { sel: '[data-tour="dash-kpis"]', title: "The four numbers that matter", body: "Cash balance, collected this month, spent this month, households owing. Reports shows the same figures, always in step." },
  { sel: '[data-tour="nav-my-account"]', title: "My Account", body: "Your household's bills and payment history, with a Pay button that opens Paystack securely." },
  { sel: '[data-tour="nav-statement"]', title: "My Statement", body: "Download or print your household statement as a branded PDF — your proof of payment, any time." },
  { sel: '[data-tour="nav-contributions"]', title: "Contributions (staff)", body: "Record and correct household contributions per fund and month; every edit leaves a signed audit trail." },
  { sel: '[data-tour="nav-expenses"]', title: "Expenses & budgets (staff)", body: "Log estate spending by category and compare it against each category's annual budget." },
  { sel: '[data-tour="nav-reports"]', title: "Reports (staff)", body: "Any date range, any fund: opening balance, received, expenses, closing — plus the per-fund opening balances panel." },
  { sel: '[data-tour="nav-members"]', title: "Members (staff)", body: "The household register: house numbers, contact details and monthly dues." },
  { sel: '[data-tour="nav-minutes"]', title: "Minutes", body: "Meeting minutes for the whole community — keep up with decisions without chasing paper." },
  { sel: '[data-tour="nav-board"]', title: "Ferrano Board", body: "The notice board: announcements and updates from the estate team." },
  { sel: '[data-tour="nav-chat"]', title: "Ferrano Chat", body: "Talk with neighbours and staff, pictures included. The secretary moderates." },
  { sel: '[data-tour="nav-ferrano-pages"]', title: "Ferrano Pages", body: "The resident directory. Each household lists up to two people with occupation and contact details." },
  { sel: '[data-tour="nav-gate-access"]', title: "Gate Access", body: "Issue a visitor code in seconds. Your guest presents it at the gate; the gatehouse gets a WhatsApp alert instantly." },
  { sel: '[data-tour="nav-maintenance"]', title: "Maintenance", body: "Report an issue and track it from New to Resolved. The staff triage queue lives here too." },
  { sel: '[data-tour="nav-profile"]', title: "My Profile", body: "Your name, email and phone, plus password changes. Keep it current so payment reminders reach you." },
];

export default function Tour({ open, onClose }) {
  // Filter once per open: anchors missing for this role/route are skipped.
  const steps = useMemo(() => (open ? STEPS.filter((s) => document.querySelector(s.sel)) : []), [open]);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);

  useEffect(() => { if (open) setI(0); }, [open]);

  useEffect(() => {
    if (!open) return;
    const step = steps[i];
    if (!step) { setRect(null); return; }
    const el = document.querySelector(step.sel);
    if (!el) { setRect(null); return; }
    el.scrollIntoView({ block: 'center', behavior: 'smooth', inline: 'nearest' });
    const update = () => setRect(el.getBoundingClientRect());
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, i, steps]);

  if (!open || !steps.length) return null;
  const step = steps[Math.min(i, steps.length - 1)];
  const last = i >= steps.length - 1;

  const pad = 6;
  const spot = rect
    ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
    : null;
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const TIP_H = 210;
  const below = spot ? spot.top + spot.height + 12 : vh / 2 - TIP_H / 2;
  const placeAbove = spot ? below + TIP_H > vh - 12 : false;
  const tipTop = spot ? (placeAbove ? Math.max(12, spot.top - TIP_H - 12) : below) : vh / 2 - TIP_H / 2;
  const tipLeft = spot ? Math.min(Math.max(12, spot.left), vw - 348) : vw / 2 - 174;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 4000 }}>
      {spot ? (
        <div style={{
          position: 'fixed', top: spot.top, left: spot.left, width: spot.width, height: spot.height,
          borderRadius: '12px', boxShadow: '0 0 0 9999px rgba(17, 24, 39, 0.62)',
          border: '2px solid #818cf8', transition: 'all 0.25s ease', pointerEvents: 'none',
        }} />
      ) : (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.62)' }} />
      )}
      <div style={{
        position: 'fixed', top: tipTop, left: tipLeft, width: '336px', background: '#fff',
        borderRadius: '14px', boxShadow: '0 12px 40px rgba(0,0,0,0.35)', padding: '18px',
        transition: 'all 0.25s ease',
      }}>
        <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#667eea', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
          🎓 Tour · step {i + 1} of {steps.length}
        </div>
        <div style={{ fontWeight: '700', color: '#111827', fontSize: '1rem', marginBottom: '6px' }}>{step.title}</div>
        <div style={{ color: '#4b5563', fontSize: '0.87rem', lineHeight: 1.5 }}>{step.body}</div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '14px', alignItems: 'center' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '0.8rem', cursor: 'pointer', padding: 0 }}>
            Skip tour
          </button>
          <div style={{ flex: 1 }} />
          {i > 0 && (
            <button onClick={() => setI(i - 1)} style={{
              padding: '8px 14px', borderRadius: '8px', border: '1px solid #e5e7eb',
              background: '#f9fafb', color: '#374151', fontWeight: '600', fontSize: '0.82rem', cursor: 'pointer',
            }}>Back</button>
          )}
          <button onClick={() => (last ? onClose() : setI(i + 1))} style={{
            padding: '8px 16px', borderRadius: '8px', border: 'none',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: '#fff', fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer',
          }}>{last ? 'Finish ✅' : 'Next →'}</button>
        </div>
      </div>
    </div>
  );
}
