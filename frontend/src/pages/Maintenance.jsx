import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
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

const card = {
  background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};

/** Resident self-service: report an issue and track it to completion. */
function MemberMaintenance() {
  const [requests, setRequests] = useState(null);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = () => api('/maintenance').then((d) => setRequests(d.requests || [])).catch(() => setRequests([]));
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setMsg('');
    try {
      await api('/maintenance', { method: 'POST', body: { title: title.trim(), description: desc.trim() || undefined } });
      setTitle('');
      setDesc('');
      setMsg('✅ Request submitted — the estate team will pick it up.');
      await load();
    } catch (err) {
      setMsg('⚠️ ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '2rem', fontWeight: '700', color: '#111827' }}>🛠️ Maintenance Requests</h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '1.05rem' }}>
          Report an issue in your home or the common areas — the estate team tracks every request to completion.
        </p>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderTop: '4px solid #4f46e5', borderRadius: '16px', padding: '24px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0 }}>🛠️</div>
          <div>
            <h3 style={{ margin: '0 0 2px 0', fontSize: '1.125rem', fontWeight: '700', color: '#111827' }}>Submit a request</h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280' }}>Water, power, gates, common areas — anything that needs the estate team's hands.</p>
          </div>
        </div>
        <form onSubmit={submit} style={{ display: 'grid', gap: '12px' }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Short title — e.g. Water leak in kitchen"
            maxLength={120}
            style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem' }}
          />
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Details (optional): what happened, when, how urgent…"
            rows={3}
            style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem', resize: 'vertical' }}
          />
          <div>
            <button
              type="submit"
              disabled={busy || !title.trim()}
              style={{
                padding: '11px 24px',
                background: busy || !title.trim() ? '#9ca3af' : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '700',
                cursor: busy || !title.trim() ? 'not-allowed' : 'pointer',
                boxShadow: busy || !title.trim() ? 'none' : '0 4px 12px rgba(99, 102, 241, 0.3)',
              }}
            >
              {busy ? 'Submitting…' : '🛠️ Submit Request'}
            </button>
          </div>
          {msg && <div style={{ fontSize: '0.9rem', color: msg.startsWith('✅') ? '#059669' : '#e11d48' }}>{msg}</div>}
        </form>
      </div>

      <div style={{ ...card, padding: '24px', borderTop: '4px solid #10b981' }}>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0 }}>📋</div>
          <div>
            <h3 style={{ margin: '0 0 2px 0', fontSize: '1.125rem', fontWeight: '700', color: '#111827' }}>Your requests</h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280' }}>Live status — the estate team updates these as they work.</p>
          </div>
        </div>
        {requests === null ? (
          <Skeleton height="120px" width="100%" />
        ) : requests.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#9ca3af' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📋</div>
            No maintenance requests yet — submit one above and it will appear here with its status.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {requests.map((r) => {
              const s = STATUS_STYLE[r.status] || STATUS_STYLE.new;
              const edge = r.status === 'resolved' ? '#059669' : r.status === 'in-progress' ? '#f59e0b' : '#e11d48';
              return (
                <div key={r.id} style={{ border: '1px solid #e5e7eb', borderLeft: `4px solid ${edge}`, borderRadius: '10px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap', background: '#fff' }}>
                  <div>
                    <div style={{ fontWeight: '600', color: '#111827' }}>{r.title}</div>
                    {r.description && <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '2px' }}>{r.description}</div>}
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px' }}>📅 Submitted {new Date(r.created_at).toLocaleDateString()}</div>
                  </div>
                  <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700', background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>{s.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/** Staff queue for resident maintenance requests. */
function StaffQueue() {
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
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '2rem', fontWeight: '700', color: '#111827' }}>🛠️ Maintenance Requests</h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '1.05rem' }}>
            Triage queue · residents submit these from the Maintenance link in their sidebar
          </p>
        </div>
        <span style={{
          padding: '8px 18px', borderRadius: '14px', fontWeight: '700', fontSize: '0.9rem',
          background: open > 0 ? '#fef3c7' : '#ecfdf5', color: open > 0 ? '#92400e' : '#059669',
          border: `1px solid ${open > 0 ? '#fde68a' : '#a7f3d0'}`,
        }}>
          {open > 0 ? `⚠️ ${open} open request${open === 1 ? '' : 's'}` : '✅ all resolved'}
        </span>
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
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

export default function Maintenance() {
  const { user } = useAuth();
  const isStaff = ['admin', 'facility'].includes(user?.role);
  return isStaff ? <StaffQueue /> : <MemberMaintenance />;
}
