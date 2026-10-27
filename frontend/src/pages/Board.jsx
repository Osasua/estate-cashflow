import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { naira } from '../format';
import Skeleton from '../components/Skeleton';

const KIND = {
  notice: { label: 'Notice', icon: '📌', bg: '#eef2ff', text: '#4f46e5', border: '#c7d2fe', grad: ['#6366f1', '#8b5cf6'] },
  event: { label: 'Event', icon: '🎉', bg: '#ecfdf5', text: '#059669', border: '#a7f3d0', grad: ['#10b981', '#22c55e'] },
};

const ROLE_CHIP = {
  admin: { bg: '#fff1f2', text: '#e11d48' },
  treasurer: { bg: '#eef2ff', text: '#4f46e5' },
  member: { bg: '#f3f4f6', text: '#6b7280' },
};

const timeAgo = (iso) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

// node-pg returns DATE columns as Date objects -> JSON gives full ISO
// strings; always reduce to the YYYY-MM-DD prefix before parsing.
const dayOnly = (v) => String(v || '').slice(0, 10);

const daysUntil = (dateStr) => {
  const d = new Date(dayOnly(dateStr) + 'T00:00:00');
  return Math.ceil((d - new Date(new Date().toDateString())) / 86400000);
};

export default function Board() {
  const { user } = useAuth();
  const [posts, setPosts] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState({ kind: 'notice', title: '', body: '', event_date: '', event_time: '', location: '' });

  const isStaff = ['admin', 'treasurer'].includes(user?.role);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await api('/board');
      setPosts(res.posts || []);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
    flash('✅ Board refreshed');
  };

  useEffect(() => { load(); }, [load]);

  const flash = (m) => { setMessage(m); setTimeout(() => setMessage(''), 4000); };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/board', {
        method: 'POST',
        body: {
          kind: form.kind,
          title: form.title,
          body: form.body,
          event_date: form.kind === 'event' ? form.event_date : undefined,
          event_time: form.kind === 'event' ? form.event_time : undefined,
          location: form.kind === 'event' ? form.location : undefined,
        },
      });
      setForm({ kind: form.kind, title: '', body: '', event_date: '', event_time: '', location: '' });
      flash('✅ Posted to the Ferrano Board!');
      await load();
    } catch (err) {
      flash('❌ ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this post?')) return;
    try {
      await api(`/board/${id}`, { method: 'DELETE' });
      flash('✅ Post removed');
      await load();
    } catch (err) {
      flash('❌ ' + err.message);
    }
  };

  const togglePin = async (id) => {
    try {
      const res = await api(`/board/${id}/pin`, { method: 'PATCH' });
      flash('✅ ' + res.message);
      await load();
    } catch (err) {
      flash('❌ ' + err.message);
    }
  };

  const k = KIND[form.kind];

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '2rem', fontWeight: '700', color: '#111827', letterSpacing: '-0.02em' }}>
            🏘️ Ferrano Board
          </h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '1.05rem' }}>
            Notices & upcoming events from your neighbours and the estate
          </p>
        </div>
        <button onClick={refresh} disabled={refreshing} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #d1d5db', borderRadius: '8px', cursor: refreshing ? 'wait' : 'pointer', fontSize: '0.85rem', fontWeight: '600', color: '#374151', opacity: refreshing ? 0.6 : 1 }}>
          {refreshing ? '⟳ Refreshing…' : '⟳ Refresh'}
        </button>
      </div>

      {message && (
        <div style={{ padding: '12px 16px', marginBottom: '20px', borderRadius: '8px', background: message.includes('✅') ? '#ecfdf5' : '#fff1f2', color: message.includes('✅') ? '#065f46' : '#991b1b', border: `1px solid ${message.includes('✅') ? '#a7f3d0' : '#fecdd3'}`, fontSize: '0.9rem', fontWeight: '500' }}>
          {message}
        </div>
      )}

      {/* Composer */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', borderTop: `4px solid ${k.text}`, padding: '24px', marginBottom: '32px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
            {k.icon}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: '#111827' }}>Share with the estate</h2>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: '#6b7280' }}>Post a notice or an upcoming event — every resident sees it</p>
          </div>
        </div>

        <form onSubmit={submit}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            {Object.entries(KIND).map(([key, v]) => (
              <button
                key={key}
                type="button"
                onClick={() => setForm({ ...form, kind: key })}
                style={{
                  padding: '8px 18px',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  border: `1px solid ${form.kind === key ? v.text : '#d1d5db'}`,
                  background: form.kind === key ? v.bg : '#fff',
                  color: form.kind === key ? v.text : '#6b7280',
                }}
              >
                {v.icon} {v.label}
              </button>
            ))}
          </div>

          <input
            type="text"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder={form.kind === 'event' ? 'e.g. Neighbours\' Night at the courtyard' : 'e.g. Water maintenance on Friday'}
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', boxSizing: 'border-box', fontSize: '0.95rem', marginBottom: '12px', fontWeight: '600' }}
          />

          {form.kind === 'event' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '12px' }}>
              <input type="date" required value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.9rem', boxSizing: 'border-box' }} />
              <input type="time" value={form.event_time} onChange={(e) => setForm({ ...form, event_time: e.target.value })} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.9rem', boxSizing: 'border-box' }} />
              <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="📍 Location" style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.9rem', boxSizing: 'border-box' }} />
            </div>
          )}

          <textarea
            required
            rows="3"
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            placeholder="Write the details…"
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', boxSizing: 'border-box', fontSize: '0.95rem', fontFamily: 'inherit', resize: 'vertical', marginBottom: '16px' }}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={busy}
              style={{
                padding: '10px 24px',
                background: `linear-gradient(135deg, ${k.grad[0]} 0%, ${k.grad[1]} 100%)`,
                color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '0.9rem',
                cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1,
                boxShadow: `0 4px 14px ${k.text}44`,
              }}
            >
              {busy ? 'Posting…' : `${k.icon} Post ${k.label}`}
            </button>
          </div>
        </form>
      </div>

      {/* Feed */}
      {error ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>
          <h2>Error loading the board</h2>
          <p>{error}</p>
        </div>
      ) : posts === null ? (
        <div style={{ padding: '20px' }}><Skeleton height="160px" /><div style={{ height: '16px' }} /><Skeleton height="160px" /></div>
      ) : posts.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', padding: '60px 20px', textAlign: 'center', color: '#9ca3af' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🪧</div>
          <p style={{ fontSize: '1.05rem', fontWeight: '600', color: '#6b7280' }}>The board is empty</p>
          <p style={{ fontSize: '0.9rem' }}>Be the first to share a notice or an event with Ferrano Court.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {posts.map((p) => {
            const v = KIND[p.kind] || KIND.notice;
            const role = ROLE_CHIP[p.author_role] || ROLE_CHIP.member;
            const canDelete = p.author_id === user?.id || isStaff;
            const inDays = p.kind === 'event' && p.event_date ? daysUntil(p.event_date) : null;
            return (
              <div key={p.id} style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', borderLeft: `4px solid ${v.text}`, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ padding: '4px 12px', borderRadius: '12px', background: v.bg, color: v.text, fontSize: '0.75rem', fontWeight: '700' }}>
                      {v.icon} {v.label}
                    </span>
                    {p.pinned && (
                      <span style={{ padding: '4px 12px', borderRadius: '12px', background: '#fffbeb', color: '#d97706', fontSize: '0.75rem', fontWeight: '700' }}>📌 Pinned</span>
                    )}
                    {inDays !== null && (
                      <span style={{ padding: '4px 12px', borderRadius: '12px', background: inDays < 0 ? '#f3f4f6' : inDays === 0 ? '#fef3c7' : '#ecfdf5', color: inDays < 0 ? '#6b7280' : inDays === 0 ? '#92400e' : '#059669', fontSize: '0.75rem', fontWeight: '700' }}>
                        {inDays < 0 ? 'Passed' : inDays === 0 ? 'Today!' : `In ${inDays} day${inDays === 1 ? '' : 's'}`}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {isStaff && (
                      <button onClick={() => togglePin(p.id)} title={p.pinned ? 'Unpin' : 'Pin'} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #fcd34d', background: '#fffbeb', color: '#92400e', cursor: 'pointer', fontSize: '0.75rem' }}>
                        📌 {p.pinned ? 'Unpin' : 'Pin'}
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => remove(p.id)} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fee2e2', color: '#991b1b', cursor: 'pointer', fontSize: '0.75rem' }}>
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', fontWeight: '700', color: '#111827' }}>{p.title}</h3>

                {p.kind === 'event' && p.event_date && (
                  <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '10px', fontSize: '0.85rem', color: '#374151', fontWeight: '600' }}>
                    <span>📅 {new Date(dayOnly(p.event_date) + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    {p.event_time && <span>🕒 {p.event_time}</span>}
                    {p.location && <span>📍 {p.location}</span>}
                  </div>
                )}

                <p style={{ margin: '0 0 14px 0', color: '#374151', fontSize: '0.95rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{p.body}</p>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#6b7280' }}>
                  <span style={{ fontWeight: '600', color: '#374151' }}>{p.author_name}</span>
                  <span style={{ padding: '2px 10px', borderRadius: '10px', background: role.bg, color: role.text, fontWeight: '600', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{p.author_role}</span>
                  <span>· {timeAgo(p.created_at)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
