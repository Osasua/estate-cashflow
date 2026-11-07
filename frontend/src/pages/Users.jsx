import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { fmtDate } from '../format';

export default function Users() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [members, setMembers] = useState([]); // List of households for dropdown
  const [form, setForm] = useState({ name: '', email: '', role: 'treasurer', member_id: '' });
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');

  const loadData = async () => {
    try {
      const [usersRes, membersRes] = await Promise.all([
        api('/users'),
        api('/members')
      ]);
      setUsers(usersRes.users);
      setMembers(membersRes.members);
    } catch (e) {
      setMessage(e.message);
    }
  };

  useEffect(() => { loadData(); }, []);

  const createUser = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const res = await api('/users', { method: 'POST', body: form });
      setMessage(`✅ User created! Temporary Password: ${res.tempPassword}`);
      setForm({ name: '', email: '', role: 'treasurer', member_id: '' });
      loadData();
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    }
  };

  const startEdit = (u) => {
    setEditingId(u.id);
    setForm({
      name: u.name,
      email: u.email,
      role: u.role,
      member_id: u.member_id || ''
    });
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      await api(`/users/${editingId}`, { method: 'PUT', body: form });
      setMessage('✅ User updated successfully.');
      setEditingId(null);
      setForm({ name: '', email: '', role: 'treasurer', member_id: '' });
      loadData();
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ name: '', email: '', role: 'treasurer', member_id: '' });
  };

  const unlinkUser = async (u) => {
    if (!window.confirm(`Unlink ${u.email} from their household?\n\nThe account stays active with its role, password and sign-in history — only the household link is removed. Bills and payments stay with the house.`)) return;
    try {
      const res = await api(`/members/${u.member_id}/unlink`, { method: 'POST' });
      setMessage(`✅ ${res.message || `Unlinked ${u.email} — account kept`}`);
      loadData();
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    }
  };

  const deleteUser = async (u) => {
    if (!window.confirm(`Delete ${u.name} (${u.email})?\n\nThis removes their portal login only. Households, bills and payment history are kept, and past records keep their audit trail.`)) return;
    try {
      await api(`/users/${u.id}`, { method: 'DELETE' });
      setMessage(`✅ Deleted ${u.name}`);
      loadData();
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    }
  };

  return (
    <div>
      <h1>User Management</h1>
      {message && <p className={message.includes('❌') ? 'error' : 'muted'} style={{ marginBottom: '15px' }}>{message}</p>}

      {/* Create New Staff User */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <h3>Create New Admin or Treasurer</h3>
        <form onSubmit={createUser} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input 
            placeholder="Full Name" 
            value={form.name} 
            required 
            onChange={(e) => setForm({ ...form, name: e.target.value })} 
            style={{ flex: 1, padding: '8px' }}
          />
          <input 
            placeholder="Email Address" 
            type="email"
            value={form.email} 
            required 
            onChange={(e) => setForm({ ...form, email: e.target.value })} 
            style={{ flex: 1, padding: '8px' }}
          />
          <select 
            value={form.role} 
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            style={{ padding: '8px' }}
          >
            <option value="treasurer">Treasurer</option>
            <option value="admin">Admin</option>
            <option value="secretary">Secretary</option>
            <option value="facility">Facility Manager</option>
            <option value="gate">Gate Security</option>
          </select>
          
          <select 
            value={form.member_id} 
            onChange={(e) => setForm({ ...form, member_id: e.target.value || null })}
            style={{ padding: '8px' }}
            title="Optional: Link this user to a specific household"
          >
            <option value="">-- No Household Link --</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.house_number} - {m.household_name}</option>
            ))}
          </select>

          <button type="submit" style={{ padding: '8px 16px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Create User</button>
        </form>
      </div>

      {/* Existing Users List */}
      <div className="card">
        <h3>System Users</h3>
        <table style={{ width: '100%' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #eee' }}>
              <th style={{ padding: '10px' }}>Name</th>
              <th style={{ padding: '10px' }}>Email</th>
              <th style={{ padding: '10px' }}>Role</th>
              <th style={{ padding: '10px' }}>Linked Household</th>
              <th style={{ padding: '10px' }}>Last Sign-in</th>
              <th style={{ padding: '10px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderBottom: '1px solid #eee' }}>
                {editingId === u.id ? (
                  // EDIT MODE
                  <>
                    <td style={{ padding: '10px' }}><input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} style={{width: '100%'}} /></td>
                    <td style={{ padding: '10px' }} className="muted">{u.email} (Cannot change)</td>
                    <td style={{ padding: '10px' }}>
                      <select value={form.role} onChange={(e) => setForm({...form, role: e.target.value})} style={{width: '100%', padding: '5px'}}>
                        <option value="admin">Admin</option>
                        <option value="treasurer">Treasurer</option>
                        <option value="secretary">Secretary</option>
                        <option value="facility">Facility Manager</option>
                        <option value="gate">Gate Security</option>
                        <option value="member">Member</option>
                      </select>
                    </td>
                    <td style={{ padding: '10px' }}>
                      <select value={form.member_id || ''} onChange={(e) => setForm({...form, member_id: e.target.value || null})} style={{width: '100%', padding: '5px'}}>
                        <option value="">-- No Link --</option>
                        {members.map(m => (
                          <option key={m.id} value={m.id}>{m.house_number} - {m.household_name}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '10px' }} className="muted">
                      {u.last_login_at ? fmtDate(u.last_login_at) : 'Never'}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>
                      <button onClick={saveEdit} style={{marginRight: '5px', background: '#22c55e', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer'}}>Save</button>
                      <button onClick={cancelEdit} className="btn-ghost">Cancel</button>
                    </td>
                  </>
                ) : (
                  // VIEW MODE
                  <>
                    <td style={{ padding: '10px' }}>{u.name}</td>
                    <td style={{ padding: '10px' }}>{u.email}</td>
                    <td style={{ padding: '10px' }}>
                      <span className={`badge ${u.role === 'admin' ? 'paid' : u.role === 'treasurer' ? 'pending' : ''}`} style={{ background: u.role === 'member' ? '#eee' : u.role === 'secretary' ? '#ecfdf5' : '', color: u.role === 'secretary' ? '#059669' : undefined }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: '10px' }} className="muted">
                      {u.member_id ? 'Yes' : '—'}
                    </td>
                    <td style={{ padding: '10px' }} className="muted">
                      {u.last_login_at
                        ? `${fmtDate(u.last_login_at)}${u.last_login_ip ? ` · ${u.last_login_ip}` : ''}`
                        : 'Never'}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>
                      <button className="btn-ghost" onClick={() => startEdit(u)}>Edit</button>
                      {u.member_id && (
                        <button onClick={() => unlinkUser(u)} title="Detach this login from its household. The account is kept." style={{marginLeft: '5px', background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer'}}>Unlink</button>
                      )}
                      {u.id !== user?.id && (
                        <button onClick={() => deleteUser(u)} style={{marginLeft: '5px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer'}}>Delete</button>
                      )}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}