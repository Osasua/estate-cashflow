import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';

const PILL = {
  active: { bg: '#dcfce7', color: '#166534', label: 'At the gate now' },
  scheduled: { bg: '#fef3c7', color: '#92400e', label: 'Expected' },
  expired: { bg: '#f3f4f6', color: '#6b7280', label: 'Expired' },
  revoked: { bg: '#fee2e2', color: '#991b1b', label: 'Revoked' },
};

const CARD = {
  background: '#fff', border: '1px solid #e5e7eb', borderRadius: '14px',
  padding: '18px 20px', borderLeft: '4px solid',
};

const sameDay = (a, b) => new Date(a).toDateString() === b.toDateString();
const fmtWhen = (x) =>
  new Date(x).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit' });

/** Gate Security home: today's visitor codes, verification-first. */
export default function GateDashboard() {
  const [codes, setCodes] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/access-codes')
      .then((r) => setCodes(r.codes || []))
      .catch((e) => setError(e.message || 'Failed to load visitor codes'));
  }, []);

  if (error) {
    return (
      <div>
        <h1>🛡 Gate Console</h1>
        <div className="card" style={{ padding: '20px', color: '#991b1b' }}>
          {error} — <Link to="/gate-access">open the gate board</Link>
        </div>
      </div>
    );
  }

  const list = codes || [];
  const today = new Date();
  const activeNow = list.filter((c) => c.status === 'active');
  const expected = list.filter((c) => c.status === 'scheduled' && sameDay(c.arrives_at, today));
  const todayAll = [...list.filter((c) => sameDay(c.arrives_at, today) || sameDay(c.departs_at, today))]
    .sort((a, b) => new Date(a.arrives_at) - new Date(b.arrives_at));

  return (
    <div>
      <h1>🛡 Gate Console</h1>
      <p className="muted" style={{ marginTop: '-6px', marginBottom: '20px' }}>
        Today's visitor codes at the gatehouse. Match the code on the visitor's phone to this board.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '22px' }}>
        <div style={{ ...CARD, borderLeftColor: '#22c55e' }}>
          <div className="muted" style={{ fontSize: '0.8rem' }}>At the gate now</div>
          <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#166534' }}>{activeNow.length}</div>
        </div>
        <div style={{ ...CARD, borderLeftColor: '#f59e0b' }}>
          <div className="muted" style={{ fontSize: '0.8rem' }}>Expected today</div>
          <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#92400e' }}>{expected.length}</div>
        </div>
        <div style={{ ...CARD, borderLeftColor: '#64748b' }}>
          <div className="muted" style={{ fontSize: '0.8rem' }}>On today's list</div>
          <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#334155' }}>{todayAll.length}</div>
        </div>
      </div>

      <div className="card" style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0 }}>Today's codes</h3>
          <Link to="/gate-access" className="btn" style={{ padding: '8px 14px', fontSize: '0.8rem' }}>Open the full board →</Link>
        </div>
        {codes === null ? (
          <p className="muted">Loading…</p>
        ) : !todayAll.length ? (
          <p className="muted">No visitor codes for today yet. Residents issue them from their own Gate Access page; every code appears here instantly.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {todayAll.map((c) => {
              const p = PILL[c.status] || PILL.expired;
              return (
                <div key={c.id} style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', padding: '10px 12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #eef2f7' }}>
                  <span style={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontWeight: 800, letterSpacing: '0.14em', color: '#134e4a', fontSize: '1.05rem' }}>{c.code}</span>
                  <span style={{ background: p.bg, color: p.color, borderRadius: '999px', padding: '3px 10px', fontSize: '0.72rem', fontWeight: 700 }}>{p.label}</span>
                  <strong style={{ fontSize: '0.9rem' }}>{c.visitor_name}</strong>
                  <span className="muted" style={{ fontSize: '0.82rem' }}>
                    {c.household_name} · House {c.house_number} · {fmtWhen(c.arrives_at)} → {fmtWhen(c.departs_at)} · {c.people_count} {c.people_count === 1 ? 'person' : 'people'}{c.vehicle ? ` · 🚗 ${c.vehicle}` : ''}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
