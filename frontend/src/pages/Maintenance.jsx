import React, { useEffect, useState } from 'react';
import { api } from '../api';
import Skeleton from '../components/Skeleton';

const STATUS_STYLE = {
  new: { bg: '#fee2e2', color: '#991b1b', label: '🆕 New' },
  'in-progress': { bg: '#fef3c7', color: '#92400e', label: '🔧 In progress' },
  resolved: { bg: '#dcfce7', color: '#166534', label: '✅ Resolved' },
};

const th = (align) => ({
  padding: '14px 24px', textAlign: align, fontSize: '0.75rem', fontWeight: '600',
  color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em',
  borderBottom: '1px solid #e5e7eb',
});
const td = (align) => ({
  padding: '14px 24px', textAlign: align, fontSize: '0.9rem',
  borderBottom: '1px solid #f3f4f6', verticalAlign: 'top',
});

/** Staff queue for resident maintenance requests. */
export default function Maintenance() {
  const [requests, setRequests] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);

  const load = () => api('/maintenance').then((d) => setRequests(d.requests || [])).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const setStatus = async (id, status) => {
    setBusy(id);
    try {
      await api(`/maintenance/${id}`, { method: 'PUT', body: { status } });
      await load();
    } catch (e) {
      alert('Update failed: ' + e.message);
    } finally {
      setBusy(null);
    }
  };

  if (error) return <div style={{ padding: '40px', color: '#ef4444', textAlign: 'center' }}><h2>Error</h2><p>{error}</p></div>;
  if (!requests) return <div style={{ padding: '40px' }}><Skeleton height="200px" width="100%" /></div>;

  const open = requests.filter((r) => r.status !== 'resolved').length;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '2rem', fontWeight: '700', color: '#111827' }}>Maintenance Requests</h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '1.05rem' }}>
          {open} open request{open === 1 ? '' : 's'} · residents submit these from My Account
        </p>
      </div>

      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        {requests.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🛠️</div>
            No maintenance requests yet
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={th('left')}>Household</th>
                  <th style={th('left')}>Request</th>
                  <th style={th('left')}>Submitted</th>
                  <th style={th('left')}>Status</th>
                  <th style={th('right')}>Update</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => {
                  const s = STATUS_STYLE[r.status] || STATUS_STYLE.new;
                  return (
                    <tr key={r.id}>
                      <td style={{ ...td('left'), fontWeight: '700', color: '#111827', whiteSpace: 'nowrap' }}>
                        {r.house_number} · {r.household_name}
                      </td>
                      <td style={td('left')}>
                        <div style={{ fontWeight: '600', color: '#111827' }}>{r.title}</div>
                        {r.description && <div style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: '4px' }}>{r.description}</div>}
                      </td>
                      <td style={{ ...td('left'), color: '#6b7280', whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleDateString()}</td>
                      <td style={td('left')}>
                        <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700', background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>{s.label}</span>
                      </td>
                      <td style={{ ...td('right'), whiteSpace: 'nowrap' }}>
                        <select
                          value={r.status}
                          disabled={busy === r.id}
                          onChange={(e) => setStatus(r.id, e.target.value)}
                          style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.85rem', background: '#fff' }}
                        >
                          <option value="new">New</option>
                          <option value="in-progress">In progress</option>
                          <option value="resolved">Resolved</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
