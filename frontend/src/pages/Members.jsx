import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { naira } from '../format';

export default function Members() {
  const { user } = useAuth();
  const staff = ['admin', 'treasurer'].includes(user.role);

  const [members, setMembers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [message, setMessage] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const load = () =>
    api('/members')
      .then((d) => setMembers(d.members))
      .catch((e) => setMessage(e.message));

  useEffect(() => { load(); }, []);

  const startEdit = (m) => {
    setEditing(m.id);
    setForm({
      household_name: m.household_name,
      house_number: m.house_number,
      phone: m.phone || '',
      email: m.email || '',
      monthly_due: m.monthly_due,
      active: m.active,
    });
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    try {
      await api(`/members/${editing}`, { method: 'PUT', body: form });
      setMessage('✅ Member updated successfully!');
      setEditing(null);
      setForm({});
      load();
    } catch (err) {
      setMessage('❌ Error updating member.');
    }
  };

  const cancelEdit = () => {
    setEditing(null);
    setForm({});
  };

  const addMember = async (e) => {
    e.preventDefault();
    try {
      await api('/members', { method: 'POST', body: form });
      setMessage('✅ New member added!');
      setShowAdd(false);
      setForm({});
      load();
    } catch (err) {
      setMessage('❌ Error adding member.');
    }
  };

  const createLoginAndEmail = async (memberId) => {
    if (!window.confirm('This will create a login account and email the member. Continue?')) return;
    try {
      const res = await api(`/members/${memberId}/create-login`, { method: 'POST' });
      setMessage(res.message);
      load();
    } catch (err) {
      setMessage(err.message || 'Error creating login.');
    }
  };

  const removeMember = async (memberId, currentStatus) => {
    const actionText = currentStatus ? 'remove (make inactive)' : 'restore (make active)';
    if (!window.confirm(`Are you sure you want to ${actionText} this member? Their financial history will be preserved.`)) return;
    
    try {
      await api(`/members/${memberId}`, { method: 'PUT', body: { active: !currentStatus } });
      setMessage(`Member ${currentStatus ? 'removed' : 'restored'} successfully.`);
      load();
    } catch (err) {
      setMessage('Error updating member status.');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Members Management</h1>
        {staff && (
          <button 
            onClick={() => { setShowAdd(true); setForm({ household_name: '', house_number: '', monthly_due: 10000 }); }}
            style={{ padding: '10px 20px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            + Add New Member
          </button>
        )}
      </div>

      {message && <p className={message.includes('❌') ? 'error' : 'muted'} style={{ marginBottom: '15px', padding: '10px', background: message.includes('❌') ? '#fee' : '#efe', borderRadius: '4px' }}>{message}</p>}

      {/* ADD NEW MEMBER FORM */}
      {showAdd && staff && (
        <div className="card" style={{ border: '2px solid #4f46e5', marginBottom: '20px', padding: '20px' }}>
          <h3>Add New Member</h3>
          <form onSubmit={addMember} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
            <input placeholder="Household Name" value={form.household_name || ''} required onChange={(e) => setForm({ ...form, household_name: e.target.value })} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
            <input placeholder="House Number" value={form.house_number || ''} required onChange={(e) => setForm({ ...form, house_number: e.target.value })} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
            <input placeholder="Phone" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
            <input placeholder="Email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
            <input placeholder="Monthly Due" type="number" value={form.monthly_due || 10000} onChange={(e) => setForm({ ...form, monthly_due: Number(e.target.value) })} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
            <div style={{ display: 'flex', gap: '10px', gridColumn: '1 / -1', justifyContent: 'flex-end' }}>
              <button type="submit" style={{ padding: '10px 20px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Save Member</button>
              <button type="button" className="btn-ghost" onClick={() => { setShowAdd(false); setForm({}); }} style={{ padding: '10px 20px' }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* MEMBERS TABLE */}
      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="mobile-cards" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee', background: '#f9fafb' }}>
              <th style={{ padding: '12px 10px', fontWeight: '600' }}>House #</th>
              <th style={{ padding: '12px 10px', fontWeight: '600' }}>Name</th>
              <th style={{ padding: '12px 10px', fontWeight: '600' }}>Phone</th>
              <th style={{ padding: '12px 10px', fontWeight: '600' }}>Email</th>
              <th style={{ padding: '12px 10px', fontWeight: '600' }}>Due</th>
              <th style={{ padding: '12px 10px', fontWeight: '600' }}>Status</th>
              <th style={{ padding: '12px 10px', fontWeight: '600' }}>Linked User</th>
              {staff && <th style={{ padding: '12px 10px', fontWeight: '600', textAlign: 'right' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} style={{ borderBottom: '1px solid #eee', opacity: m.active ? 1 : 0.5, background: editing === m.id ? '#f0f9ff' : 'transparent' }}>
                {editing === m.id ? (
                  // EDIT MODE
                  <>
                    <td data-label="House #" style={{ padding: '8px 10px' }}><input value={form.house_number} onChange={(e) => setForm({ ...form, house_number: e.target.value })} style={{ width: '70px', padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }} /></td>
                    <td data-label="Name" style={{ padding: '8px 10px' }}><input value={form.household_name} onChange={(e) => setForm({ ...form, household_name: e.target.value })} style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }} /></td>
                    <td data-label="Phone" style={{ padding: '8px 10px' }}><input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }} /></td>
                    <td data-label="Email" style={{ padding: '8px 10px' }}><input value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }} /></td>
                    <td data-label="Due" style={{ padding: '8px 10px' }}><input type="number" value={form.monthly_due} onChange={(e) => setForm({ ...form, monthly_due: Number(e.target.value) })} style={{ width: '90px', padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }} /></td>
                    <td data-label="Status" style={{ padding: '8px 10px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                        <span>{form.active ? 'Active' : 'Inactive'}</span>
                      </label>
                    </td>
                    <td data-label="Linked User" style={{ padding: '8px 10px' }} className="muted">—</td>
                    {staff && (
                      <td data-label="Actions" style={{ padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button onClick={saveEdit} style={{ padding: '6px 12px', background: '#22c55e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '5px', fontWeight: 'bold' }}>Save</button>
                        <button onClick={cancelEdit} className="btn-ghost" style={{ padding: '6px 12px' }}>Cancel</button>
                      </td>
                    )}
                  </>
                ) : (
                  // VIEW MODE
                  <>
                    <td data-label="House #" style={{ padding: '12px 10px', fontWeight: '500' }}>{m.house_number}</td>
                    <td data-label="Name" style={{ padding: '12px 10px' }}>{m.household_name}</td>
                    <td data-label="Phone" style={{ padding: '12px 10px' }} className="muted">{m.phone || '—'}</td>
                    <td data-label="Email" style={{ padding: '12px 10px' }} className="muted">{m.email || '—'}</td>
                    <td data-label="Due" style={{ padding: '12px 10px' }}>{naira(m.monthly_due)}</td>
                    <td data-label="Status" style={{ padding: '12px 10px' }}>
                      <span className={`badge ${m.active ? 'paid' : 'pending'}`} style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '0.85rem' }}>
                        {m.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td data-label="Linked User" style={{ padding: '12px 10px' }} className="muted">{m.user_name || m.user_email || '—'}</td>
                    {staff && (
                      <td data-label="Actions" style={{ padding: '12px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end' }}>
                          <button className="btn-ghost" onClick={() => startEdit(m)} style={{ padding: '6px 12px', border: '1px solid #ddd', borderRadius: '4px' }}>Edit</button>
                          {!m.user_email && m.active && (
                            <button className="btn-ghost" style={{ color: '#4f46e5', fontWeight: 'bold', padding: '6px 12px', border: '1px solid #4f46e5', borderRadius: '4px' }} onClick={() => createLoginAndEmail(m.id)}>
                              Create Login
                            </button>
                          )}
                          <button 
                            className="btn-ghost" 
                            style={{ color: m.active ? '#ef4444' : '#22c55e', fontWeight: 'bold', padding: '6px 12px', border: `1px solid ${m.active ? '#ef4444' : '#22c55e'}`, borderRadius: '4px' }} 
                            onClick={() => removeMember(m.id, m.active)}
                          >
                            {m.active ? 'Remove' : 'Restore'}
                          </button>
                        </div>
                      </td>
                    )}
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {members.length === 0 && <p className="muted" style={{ padding: '20px', textAlign: 'center' }}>No members found.</p>}
      </div>
    </div>
  );
}