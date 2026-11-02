import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import Skeleton from '../components/Skeleton';

/**
 * Ferrano Pages — the resident directory.
 *
 * Every household can list up to two people. Residents add/edit their own
 * household's listing (with one-click fill from their profile); staff
 * (admin / treasurer / secretary) can manage every household.
 */

const COMMS = ['admin', 'treasurer', 'secretary'];
const EMPTY = { first_name: '', last_name: '', phone: '', email: '', occupation: '', organization: '' };

const card = {
  background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};
const input = {
  width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px',
  fontSize: '0.9rem', boxSizing: 'border-box', background: '#fff', color: '#111827',
};
const label = { display: 'block', marginBottom: '4px', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' };
const SLOT_COLOR = { 1: '#667eea', 2: '#764ba2' };

// "13A" sorts between 13 and 14; plain text order would not.
function houseKey(houseNumber) {
  const s = String(houseNumber || '').trim();
  const m = s.match(/^(\d+)\s*(.*)$/);
  return m ? [1, Number(m[1]), m[2]] : [0, 0, s];
}
function cmpHouse(a, b) {
  const ka = houseKey(a); const kb = houseKey(b);
  if (ka[0] !== kb[0]) return kb[0] - ka[0];
  if (ka[1] !== kb[1]) return ka[1] - kb[1];
  return String(ka[2]).localeCompare(String(kb[2]));
}

function initials(first, last) {
  return `${(first || '?').charAt(0)}${(last || '').charAt(0)}`.toUpperCase();
}

function PersonCard({ person, canEdit, onEdit, onDelete }) {
  const full = `${person.first_name} ${person.last_name}`;
  return (
    <div style={{ ...card, borderLeft: `4px solid ${SLOT_COLOR[person.slot] || '#667eea'}`, padding: '16px' }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <div style={{
          width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
          background: `linear-gradient(135deg, ${SLOT_COLOR[person.slot] || '#667eea'} 0%, #764ba2 100%)`,
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: '700', fontSize: '0.95rem',
        }}>
          {initials(person.first_name, person.last_name)}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: '700', color: '#111827', fontSize: '1rem' }}>{full}</div>
          {(person.occupation || person.organization) && (
            <div style={{ color: '#4b5563', fontSize: '0.85rem', marginTop: '2px' }}>
              {person.occupation}{person.occupation && person.organization ? ' @ ' : ''}{person.organization}
            </div>
          )}
          {person.phone && (
            <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>
              <a href={`tel:${person.phone}`} style={{ color: '#667eea', textDecoration: 'none' }}>📞 {person.phone}</a>
            </div>
          )}
          {person.email && (
            <div style={{ fontSize: '0.85rem', marginTop: '2px', overflowWrap: 'anywhere' }}>
              <a href={`mailto:${person.email}`} style={{ color: '#667eea', textDecoration: 'none' }}>✉️ {person.email}</a>
            </div>
          )}
        </div>
      </div>
      {canEdit && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <button onClick={() => onEdit(person)} style={{
            padding: '6px 14px', fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer',
            color: '#fff', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none', borderRadius: '8px',
          }}>✏️ Edit</button>
          <button onClick={() => onDelete(person)} style={{
            padding: '6px 14px', fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer',
            color: '#991b1b', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '8px',
          }}>🗑 Remove</button>
        </div>
      )}
    </div>
  );
}

function EntryForm({ editing, isOwnHousehold, household, onCancel, onSaved }) {
  const [values, setValues] = useState({ ...EMPTY, ...editing.values });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));

  const fillFromProfile = async () => {
    try {
      const p = await api('/profile');
      const [first, ...rest] = String(p.name || '').trim().split(/\s+/);
      setValues((v) => ({
        ...v,
        first_name: v.first_name || first || '',
        last_name: v.last_name || rest.join(' ') || '',
        email: v.email || p.email || (household && household.email) || '',
        phone: v.phone || p.phone || (household && household.phone) || '',
      }));
    } catch (e) {
      setErr('⚠️ Could not read your profile: ' + e.message);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (!values.first_name.trim() || !values.last_name.trim()) {
      setErr('First name and last name are required.');
      return;
    }
    setBusy(true); setErr('');
    try {
      await api('/directory', {
        method: 'POST',
        body: {
          member_id: editing.member_id,
          slot: editing.slot,
          first_name: values.first_name.trim(),
          last_name: values.last_name.trim(),
          phone: values.phone.trim() || undefined,
          email: values.email.trim() || undefined,
          occupation: values.occupation.trim() || undefined,
          organization: values.organization.trim() || undefined,
        },
      });
      onSaved();
    } catch (e2) {
      setErr('⚠️ ' + e2.message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} style={{ ...card, borderLeft: `4px solid ${SLOT_COLOR[editing.slot]}`, padding: '16px' }}>
      <div style={{ fontWeight: '700', color: '#111827', marginBottom: '12px' }}>
        {editing.values ? '✏️ Edit listing' : `➕ Add person — slot ${editing.slot}`}
        <span style={{ fontWeight: '500', color: '#6b7280', fontSize: '0.82rem' }}> · {editing.householdLabel}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
        <div><label style={label}>First Name *</label><input style={input} value={values.first_name} onChange={set('first_name')} placeholder="e.g., Ada" /></div>
        <div><label style={label}>Last Name *</label><input style={input} value={values.last_name} onChange={set('last_name')} placeholder="e.g., Okafor" /></div>
        <div><label style={label}>Phone Number</label><input style={input} value={values.phone} onChange={set('phone')} placeholder="e.g., 08031234567" /></div>
        <div><label style={label}>Email Address</label><input style={input} type="email" value={values.email} onChange={set('email')} placeholder="e.g., ada@example.com" /></div>
        <div><label style={label}>Occupation</label><input style={input} value={values.occupation} onChange={set('occupation')} placeholder="e.g., Pharmacist" /></div>
        <div><label style={label}>Organization / Business Name</label><input style={input} value={values.organization} onChange={set('organization')} placeholder="e.g., Okafor Pharmacy Ltd" /></div>
      </div>
      {err && <div style={{ color: '#991b1b', background: '#fee2e2', borderRadius: '8px', padding: '8px 12px', marginTop: '12px', fontSize: '0.85rem' }}>{err}</div>}
      <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
        <button type="submit" disabled={busy} style={{
          padding: '10px 20px', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer',
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', opacity: busy ? 0.6 : 1,
        }}>{busy ? 'Saving…' : '💾 Save listing'}</button>
        {isOwnHousehold && (
          <button type="button" onClick={fillFromProfile} style={{
            padding: '10px 20px', color: '#4338ca', background: '#eef2ff', border: '1px solid #c7d2fe',
            borderRadius: '8px', fontWeight: '600', cursor: 'pointer',
          }}>⚡ Fill from my profile</button>
        )}
        <button type="button" onClick={onCancel} style={{
          padding: '10px 20px', color: '#374151', background: '#f3f4f6', border: '1px solid #e5e7eb',
          borderRadius: '8px', fontWeight: '600', cursor: 'pointer',
        }}>Cancel</button>
      </div>
    </form>
  );
}

export default function FerranoPages() {
  const { user } = useAuth();
  const isComms = COMMS.includes(user?.role);
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // { member_id, slot, householdLabel, values }
  const [msg, setMsg] = useState('');

  const load = () => api('/directory').then((d) => setData(d)).catch((e) => setMsg('⚠️ ' + e.message));
  useEffect(() => { load(); }, []);

  const myId = data?.my_member_id ?? null;
  const canEdit = (houseId) => isComms || houseId === myId;

  const houses = useMemo(() => {
    if (!data) return [];
    const byId = new Map();
    const base = data.households
      || (data.my_household ? [data.my_household] : []);
    for (const h of base) byId.set(h.id, { ...h, slots: {} });
    for (const e of data.entries || []) {
      let h = byId.get(e.member_id);
      if (!h) { h = { id: e.member_id, household_name: e.household_name, house_number: e.house_number, slots: {} }; byId.set(e.member_id, h); }
      h.slots[e.slot] = e;
    }
    return [...byId.values()].sort((a, b) => cmpHouse(a.house_number, b.house_number));
  }, [data]);

  const q = search.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!q) return houses;
    return houses
      .map((h) => {
        const houseHit = `${h.household_name} ${h.house_number}`.toLowerCase().includes(q);
        const people = Object.values(h.slots);
        if (houseHit) return h;
        const match = people.some((p) =>
          [p.first_name, p.last_name, p.occupation, p.organization, p.phone, p.email]
            .filter(Boolean).join(' ').toLowerCase().includes(q));
        return match ? h : null;
      })
      .filter(Boolean);
  }, [houses, q]);

  const listed = (data?.entries || []).length;
  const filledHouses = houses.filter((h) => Object.keys(h.slots).length).length;

  const openAdd = (h, slot) => {
    setMsg('');
    setEditing({ member_id: h.id, slot, householdLabel: `House ${h.house_number} · ${h.household_name}`, values: null });
  };
  const openEdit = (h, person) => {
    setMsg('');
    setEditing({
      member_id: h.id, slot: person.slot,
      householdLabel: `House ${h.house_number} · ${h.household_name}`,
      values: {
        first_name: person.first_name || '', last_name: person.last_name || '',
        phone: person.phone || '', email: person.email || '',
        occupation: person.occupation || '', organization: person.organization || '',
      },
    });
  };
  const remove = async (h, person) => {
    const ok = window.confirm(`Remove ${person.first_name} ${person.last_name} (House ${h.house_number}) from Ferrano Pages?`);
    if (!ok) return;
    try {
      await api(`/directory/${person.id}`, { method: 'DELETE' });
      setMsg('✅ Listing removed.');
      await load();
    } catch (e) {
      setMsg('⚠️ ' + e.message);
    }
  };

  if (!data) {
    return (
      <div>
        <h2 style={{ margin: '0 0 16px 0', color: '#111827' }}>📇 Ferrano Pages</h2>
        <Skeleton height="220px" />
      </div>
    );
  }

  return (
    <div>
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '16px', padding: '24px', marginBottom: '20px', color: '#fff',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      }}>
        <h2 style={{ margin: '0 0 6px 0', fontSize: '1.35rem', fontWeight: '700' }}>📇 Ferrano Pages</h2>
        <p style={{ margin: '0 0 14px 0', fontSize: '0.92rem', opacity: 0.9 }}>
          The Ferrano Court resident directory. Every household can list up to two people —
          add yourselves so neighbours can find who to call, and what everyone does.
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔎 Search name, house, occupation, business…"
            style={{ flex: 1, minWidth: '220px', padding: '11px 14px', border: 'none', borderRadius: '10px', fontSize: '0.92rem', boxSizing: 'border-box' }}
          />
          <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>
            {listed} {listed === 1 ? 'resident' : 'residents'} listed · {filledHouses} {filledHouses === 1 ? 'household' : 'households'}
          </div>
        </div>
      </div>

      {msg && (
        <div style={{
          background: msg.startsWith('⚠️') ? '#fee2e2' : '#dcfce7',
          color: msg.startsWith('⚠️') ? '#991b1b' : '#166534',
          borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', fontSize: '0.9rem',
        }}>{msg}</div>
      )}

      {myId === null && !isComms && (
        <div style={{ background: '#fef3c7', color: '#92400e', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', fontSize: '0.9rem' }}>
          Your login is not linked to a household yet — ask the treasurer to link it, then you can add your listing.
        </div>
      )}

      {/* Households */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {visible.map((h) => {
          const mine = h.id === myId;
          const people = [1, 2].map((s) => h.slots[s]).filter(Boolean);
          return (
            <div key={h.id} style={{ ...card, padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
                <span style={{
                  background: '#eef2ff', color: '#4338ca', borderRadius: '8px', padding: '4px 10px',
                  fontWeight: '700', fontSize: '0.85rem', border: '1px solid #c7d2fe',
                }}>🏠 House {h.house_number}</span>
                <span style={{ fontWeight: '700', color: '#111827', fontSize: '1rem' }}>{h.household_name}</span>
                {mine && (
                  <span style={{ background: '#dcfce7', color: '#166534', borderRadius: '999px', padding: '3px 10px', fontSize: '0.72rem', fontWeight: '700', border: '1px solid #bbf7d0' }}>
                    ✓ Your household
                  </span>
                )}
              </div>

              {editing && editing.member_id === h.id ? (
                <EntryForm
                  editing={editing}
                  isOwnHousehold={mine}
                  household={data.my_household}
                  onCancel={() => setEditing(null)}
                  onSaved={async () => { setEditing(null); setMsg('✅ Listing saved to Ferrano Pages.'); await load(); }}
                />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                  {people.map((p) => (
                    <PersonCard
                      key={p.id}
                      person={p}
                      canEdit={canEdit(h.id)}
                      onEdit={(person) => openEdit(h, person)}
                      onDelete={(person) => remove(h, person)}
                    />
                  ))}
                  {canEdit(h.id) && [1, 2]
                    .filter((s) => !h.slots[s])
                    .map((s) => (
                      <button key={s} onClick={() => openAdd(h, s)} style={{
                        minHeight: '96px', borderRadius: '16px', border: `2px dashed ${SLOT_COLOR[s]}`,
                        background: '#fafaff', color: SLOT_COLOR[s], fontWeight: '700', fontSize: '0.9rem',
                        cursor: 'pointer',
                      }}>
                        ＋ Add person · slot {s}
                      </button>
                    ))}
                  {!people.length && !canEdit(h.id) && (
                    <div style={{ color: '#9ca3af', fontSize: '0.88rem', fontStyle: 'italic' }}>
                      No listing yet.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {!visible.length && (
          <div style={{ ...card, padding: '28px', textAlign: 'center', color: '#6b7280' }}>
            {q ? `No household or resident matches “${search}”.` : 'The directory is empty — households can add up to two people each.'}
          </div>
        )}
      </div>
    </div>
  );
}
