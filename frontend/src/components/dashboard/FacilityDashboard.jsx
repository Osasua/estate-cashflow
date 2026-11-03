import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';

const PILL = {
  new: { bg: '#fee2e2', color: '#991b1b', label: 'New' },
  'in-progress': { bg: '#fef3c7', color: '#92400e', label: 'In progress' },
  resolved: { bg: '#dcfce7', color: '#166534', label: 'Resolved' },
};

const CARD = {
  background: '#fff', border: '1px solid #e5e7eb', borderRadius: '14px',
  padding: '18px 20px', borderLeft: '4px solid',
};

/** Facility Manager home: the maintenance desk, at a glance. */
export default function FacilityDashboard() {
  const [requests, setRequests] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/maintenance')
      .then((r) => setRequests(r.requests || []))
      .catch((e) => setError(e.message || 'Failed to load the maintenance queue'));
  }, []);

  if (error) {
    return (
      <div>
        <h1>🛠 Facility Desk</h1>
        <div className="card" style={{ padding: '20px', color: '#991b1b' }}>
          {error} — <Link to="/maintenance">open the maintenance queue</Link>
        </div>
      </div>
    );
  }

  const list = requests || [];
  const count = (s) => list.filter((r) => r.status === s).length;
  const recent = [...list].slice(0, 6);

  return (
    <div>
      <h1>🛠 Facility Desk</h1>
      <p className="muted" style={{ marginTop: '-6px', marginBottom: '20px' }}>
        Maintenance requests across Ferrano Court — your queue, your calls.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '22px' }}>
        <div style={{ ...CARD, borderLeftColor: '#ef4444' }}>
          <div className="muted" style={{ fontSize: '0.8rem' }}>Awaiting first response</div>
          <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#991b1b' }}>{count('new')}</div>
        </div>
        <div style={{ ...CARD, borderLeftColor: '#f59e0b' }}>
          <div className="muted" style={{ fontSize: '0.8rem' }}>In progress</div>
          <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#92400e' }}>{count('in-progress')}</div>
        </div>
        <div style={{ ...CARD, borderLeftColor: '#22c55e' }}>
          <div className="muted" style={{ fontSize: '0.8rem' }}>Resolved</div>
          <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#166534' }}>{count('resolved')}</div>
        </div>
      </div>

      <div className="card" style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0 }}>Latest requests</h3>
          <Link to="/maintenance" className="btn" style={{ padding: '8px 14px', fontSize: '0.8rem' }}>Open the full queue →</Link>
        </div>
        {requests === null ? (
          <p className="muted">Loading…</p>
        ) : !recent.length ? (
          <p className="muted">No maintenance requests yet. New resident requests land here and in your email inbox.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {recent.map((r) => {
              const p = PILL[r.status] || PILL.new;
              return (
                <div key={r.id} style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', padding: '10px 12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #eef2f7' }}>
                  <span style={{ background: p.bg, color: p.color, borderRadius: '999px', padding: '3px 10px', fontSize: '0.72rem', fontWeight: 700 }}>{p.label}</span>
                  <strong style={{ fontSize: '0.92rem' }}>{r.title}</strong>
                  <span className="muted" style={{ fontSize: '0.82rem' }}>
                    {r.household_name} · House {r.house_number} · {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
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
