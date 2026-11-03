import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import Skeleton from '../components/Skeleton';

/**
 * Ferrano Gate Access — residents issue visitor codes; the gatehouse phone
 * gets a WhatsApp alert per code; the guard matches it at the gate.
 * Codes stay valid for the whole visit window (entry and exit).
 */

const COMMS = ['admin', 'treasurer', 'secretary'];

const STATUS = {
  scheduled: { bg: '#fef3c7', color: '#92400e', border: '#fde68a', label: '🕒 Scheduled' },
  active: { bg: '#dcfce7', color: '#166534', border: '#bbf7d0', label: '✅ Active now' },
  expired: { bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb', label: '⌛ Expired' },
  revoked: { bg: '#fee2e2', color: '#991b1b', border: '#fecaca', label: '🚫 Revoked' },
};

const card = {
  background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};
const input = {
  width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px',
  fontSize: '0.9rem', boxSizing: 'border-box', background: '#fff', color: '#111827',
};
const label = { display: 'block', marginBottom: '4px', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' };

const dtLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` +
  `T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const fmtWhen = (x) =>
  new Date(x).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const waLink = (phone, text) =>
  `https://wa.me/${String(phone || '').replace(/[^\d]/g, '')}?text=${encodeURIComponent(text)}`;

export default function GateAccess() {
  const { user } = useAuth();
  const isComms = COMMS.includes(user?.role);
  const [codes, setCodes] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [msg, setMsg] = useState('');
  const [issued, setIssued] = useState(null); // { code, share_text, gate_alert }
  const [busy, setBusy] = useState(false);

  const now = new Date();
  const later = new Date(now.getTime() + 60 * 60 * 1000);
  const tomorrow = new Date(now.getTime() + 25 * 60 * 60 * 1000);
  const [form, setForm] = useState({
    visitor_name: '', visitor_phone: '', arrives_at: dtLocal(later),
    departs_at: dtLocal(tomorrow), people_count: '1', vehicle: '', note: '',
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const load = async () => {
    const d = await api('/access-codes');
    setCodes(d.codes || []);
    if (isComms) {
      try { const a = await api('/access-codes/alerts'); setAlerts(a.alerts || []); } catch { setAlerts([]); }
    }
  };
  useEffect(() => { load().catch((e) => setMsg('⚠️ ' + e.message)); }, []);

  const issue = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg(''); setIssued(null);
    try {
      const r = await api('/access-codes', {
        method: 'POST',
        body: {
          visitor_name: form.visitor_name.trim(),
          visitor_phone: form.visitor_phone.trim() || undefined,
          arrives_at: form.arrives_at,
          departs_at: form.departs_at,
          people_count: parseInt(form.people_count, 10) || 1,
          vehicle: form.vehicle.trim() || undefined,
          note: form.note.trim() || undefined,
        },
      });
      setIssued(r);
      setForm((f) => ({ ...f, visitor_name: '', visitor_phone: '', vehicle: '', note: '', people_count: '1' }));
      await load();
    } catch (err) {
      setMsg('⚠️ ' + err.message);
    }
    setBusy(false);
  };

  const revoke = async (c) => {
    const ok = window.confirm(`Revoke code ${c.code} for ${c.visitor_name}? It will stop working at the gate immediately.`);
    if (!ok) return;
    try {
      await api(`/access-codes/${c.id}/revoke`, { method: 'POST' });
      setMsg('✅ Code revoked.');
      await load();
    } catch (err) {
      setMsg('⚠️ ' + err.message);
    }
  };

  const copy = async (text, what) => {
    try {
      await navigator.clipboard.writeText(text);
      setMsg(`✅ ${what} copied to clipboard.`);
    } catch {
      setMsg('⚠️ Could not copy — select and copy manually: ' + text);
    }
  };

  const activeCount = useMemo(() => (codes || []).filter((c) => c.status === 'active').length, [codes]);

  if (!codes) {
    return (
      <div>
        <h2 style={{ margin: '0 0 16px 0', color: '#111827' }}>🛡 Ferrano Gate Access</h2>
        <Skeleton height="220px" />
      </div>
    );
  }

  return (
    <div>
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, #0f766e 0%, #134e4a 100%)',
        borderRadius: '16px', padding: '24px', marginBottom: '20px', color: '#fff',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      }}>
        <h2 style={{ margin: '0 0 6px 0', fontSize: '1.35rem', fontWeight: '700' }}>🛡 Ferrano Gate Access</h2>
        <p style={{ margin: 0, fontSize: '0.92rem', opacity: 0.92, maxWidth: '720px' }}>
          Issue a one-off access code to your visitor. They present it at the gate on arrival;
          the gatehouse receives a WhatsApp alert the moment you issue it, and the code stays
          valid for entry and exit until the departure time you set.
        </p>
        <div style={{ marginTop: '12px', fontSize: '0.85rem', opacity: 0.92 }}>
          {activeCount} active {activeCount === 1 ? 'code' : 'codes'} · {codes.length} total issued
        </div>
      </div>

      {msg && (
        <div style={{
          background: msg.startsWith('⚠️') ? '#fee2e2' : '#dcfce7',
          color: msg.startsWith('⚠️') ? '#991b1b' : '#166534',
          borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', fontSize: '0.9rem',
        }}>{msg}</div>
      )}

      {/* Issue form */}
      <div style={{ ...card, padding: '20px', marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 14px 0', fontSize: '1.05rem', fontWeight: '700', color: '#111827' }}>➕ Issue a visitor code</h3>
        <form onSubmit={issue} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <div><label style={label}>Visitor name *</label><input style={input} value={form.visitor_name} onChange={set('visitor_name')} placeholder="e.g., Chidi Okeke" required /></div>
          <div><label style={label}>Visitor phone (for sharing)</label><input style={input} value={form.visitor_phone} onChange={set('visitor_phone')} placeholder="e.g., 08031234567" /></div>
          <div><label style={label}>Arrives *</label><input style={input} type="datetime-local" value={form.arrives_at} onChange={set('arrives_at')} required /></div>
          <div><label style={label}>Departs *</label><input style={input} type="datetime-local" value={form.departs_at} onChange={set('departs_at')} required /></div>
          <div><label style={label}>How many people</label><input style={input} type="number" min="1" value={form.people_count} onChange={set('people_count')} /></div>
          <div><label style={label}>Vehicle (optional)</label><input style={input} value={form.vehicle} onChange={set('vehicle')} placeholder="e.g., LND-123AB" /></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={label}>Note for the gate (optional)</label><input style={input} value={form.note} onChange={set('note')} placeholder="e.g., carrying furniture, expect a follow-up van" /></div>
          <div>
            <button type="submit" disabled={busy} style={{
              padding: '11px 22px', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700',
              cursor: 'pointer', background: 'linear-gradient(135deg, #0f766e 0%, #134e4a 100%)', opacity: busy ? 0.6 : 1,
            }}>{busy ? 'Issuing…' : '🛡 Issue code'}</button>
          </div>
        </form>

        {issued && (
          <div style={{ marginTop: '16px', background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontSize: '0.85rem', color: '#115e59', fontWeight: '600' }}>Code for {issued.code.visitor_name} — share it with your visitor:</div>
            <div style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: '2rem', fontWeight: '800', letterSpacing: '0.18em', color: '#134e4a', margin: '8px 0',
            }}>{issued.code.code}</div>
            <div style={{ fontSize: '0.85rem', color: '#0f766e', marginBottom: '10px' }}>
              Valid {fmtWhen(issued.code.arrives_at)} → {fmtWhen(issued.code.departs_at)} · {issued.code.people_count} {issued.code.people_count === 1 ? 'person' : 'people'}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button onClick={() => copy(issued.code.code, 'Code')} style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid #99f6e4', background: '#fff', color: '#0f766e', fontWeight: '700', cursor: 'pointer', fontSize: '0.85rem' }}>📋 Copy code</button>
              <button onClick={() => copy(issued.share_text, 'Message')} style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid #99f6e4', background: '#fff', color: '#0f766e', fontWeight: '700', cursor: 'pointer', fontSize: '0.85rem' }}>📄 Copy full message</button>
              <a href={waLink(issued.code.visitor_phone, issued.share_text)} target="_blank" rel="noreferrer" style={{ padding: '9px 16px', borderRadius: '8px', border: 'none', background: '#25d366', color: '#fff', fontWeight: '700', textDecoration: 'none', fontSize: '0.85rem' }}>
                {issued.code.visitor_phone ? '💬 Send via WhatsApp' : '💬 Share on WhatsApp'}
              </a>
            </div>
            <div style={{ marginTop: '10px', fontSize: '0.8rem', color: issued.gate_alert.status === 'sent' ? '#166534' : '#92400e' }}>
              {issued.gate_alert.status === 'sent'
                ? '✅ Gatehouse notified by WhatsApp.'
                : issued.gate_alert.status === 'failed'
                  ? '⚠️ Gate WhatsApp alert failed to send — staff can see it in the alert log. Your visitor’s code still works.'
                  : 'ℹ️ Gate WhatsApp alert is not configured on the server yet — the code works; the guard list is in the staff alert log.'}
            </div>
          </div>
        )}
      </div>

      {/* Codes */}
      <h3 style={{ margin: '0 0 12px 0', fontSize: '1.05rem', fontWeight: '700', color: '#111827' }}>
        {isComms ? 'All household codes' : 'Your codes'}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
        {codes.map((c) => {
          const s = STATUS[c.status] || STATUS.expired;
          return (
            <div key={c.id} style={{ ...card, padding: '16px 18px', borderLeft: `4px solid ${s.color === '#166534' ? '#10b981' : c.status === 'revoked' ? '#dc2626' : c.status === 'scheduled' ? '#f59e0b' : '#9ca3af'}` }}>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                  fontSize: '1.25rem', fontWeight: '800', letterSpacing: '0.14em', color: '#134e4a',
                }}>{c.code}</span>
                <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: '999px', padding: '3px 10px', fontSize: '0.72rem', fontWeight: '700' }}>{s.label}</span>
                {isComms && (
                  <span style={{ background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe', borderRadius: '8px', padding: '3px 10px', fontSize: '0.75rem', fontWeight: '700' }}>
                    🏠 House {c.house_number} · {c.household_name}
                  </span>
                )}
              </div>
              <div style={{ marginTop: '6px', fontSize: '0.9rem', color: '#111827', fontWeight: '600' }}>
                {c.visitor_name} · {c.people_count} {c.people_count === 1 ? 'person' : 'people'}{c.vehicle ? ` · 🚗 ${c.vehicle}` : ''}
              </div>
              <div style={{ fontSize: '0.83rem', color: '#6b7280', marginTop: '2px' }}>
                {fmtWhen(c.arrives_at)} → {fmtWhen(c.departs_at)}
                {c.note ? ` · “${c.note}”` : ''}
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                <button onClick={() => copy(c.code, 'Code')} style={{ padding: '6px 14px', fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer', color: '#0f766e', background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: '8px' }}>📋 Copy</button>
                <a href={waLink(c.visitor_phone, `${'Ferrano Court gate access'}\nCode: ${c.code}\nValid: ${fmtWhen(c.arrives_at)} → ${fmtWhen(c.departs_at)}`)} target="_blank" rel="noreferrer" style={{ padding: '6px 14px', fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer', color: '#fff', background: '#25d366', border: 'none', borderRadius: '8px', textDecoration: 'none' }}>💬 WhatsApp</a>
                {(c.status === 'active' || c.status === 'scheduled') && (
                  <button onClick={() => revoke(c)} style={{ padding: '6px 14px', fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer', color: '#991b1b', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '8px' }}>🚫 Revoke</button>
                )}
              </div>
            </div>
          );
        })}
        {!codes.length && (
          <div style={{ ...card, padding: '24px', textAlign: 'center', color: '#6b7280', fontSize: '0.9rem' }}>
            No codes yet — issue the first one above. Your visitor shows the code at the gate on arrival.
          </div>
        )}
      </div>

      {/* Staff: gate alert log */}
      {isComms && alerts && (
        <div style={{ ...card, padding: '18px 20px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '1.05rem', fontWeight: '700', color: '#111827' }}>📡 Gate alert log (what reached the gatehouse phone)</h3>
          {alerts.length === 0 ? (
            <div style={{ color: '#6b7280', fontSize: '0.88rem' }}>No alerts yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {alerts.map((a) => (
                <div key={a.id} style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px' }}>
                  <span style={{
                    background: a.status === 'sent' ? '#dcfce7' : a.status === 'failed' ? '#fee2e2' : '#fef3c7',
                    color: a.status === 'sent' ? '#166534' : a.status === 'failed' ? '#991b1b' : '#92400e',
                    borderRadius: '999px', padding: '2px 10px', fontSize: '0.72rem', fontWeight: '700',
                  }}>{a.status}</span>
                  <span style={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontWeight: '700' }}>{a.code}</span>
                  <span>{a.visitor_name} · House {a.house_number}</span>
                  <span style={{ color: '#6b7280', marginLeft: 'auto' }}>{new Date(a.sent_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
