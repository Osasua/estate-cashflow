import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { naira } from '../format';

export default function Members() {
  const { user } = useAuth();
  const isStaff = ['admin', 'treasurer'].includes(user?.role);
  
  const [members, setMembers] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  // Form States
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const emptyForm = { household_name: '', house_number: '', phone: '', email: '', monthly_due: 10000, opening_balance: 0 };
  const [formData, setFormData] = useState(emptyForm);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const data = await api('/members');
      setMembers(data.members || []); 
    } catch (e) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMembers(); }, []);

  // --- ACTIONS ---

  const handleAdd = async (e) => {
  e.preventDefault();
  try {
    await api('/members', { method: 'POST', body: formData });
    setMessage('✅ Member added successfully.');
    setIsAdding(false);
    setFormData(emptyForm);
    loadMembers();
  } catch (err) {
    // Show detailed error with option to reactivate if member exists but is inactive
    let errorMsg = err.message;
    if (err.message.includes('already assigned to')) {
      errorMsg = `❌ ${err.message} If this member moved out, you can reactivate them from the list below, or use a different house number.`;
    } else {
      errorMsg = `❌ ${err.message}`;
    }
    setMessage(errorMsg);
  }
};

  const startEdit = (member) => {
    setEditingId(member.id);
    setFormData({
      household_name: member.household_name,
      house_number: member.house_number,
      phone: member.phone || '',
      email: member.email || '',
      monthly_due: member.monthly_due || 10000,
      opening_balance: member.opening_balance || 0
    });
  };

  const handleSaveEdit = async (id) => {
    try {
      await api(`/members/${id}`, { method: 'PUT', body: formData });
      setMessage('✅ Member updated successfully.');
      setEditingId(null);
      setFormData(emptyForm);
      loadMembers();
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    }
  };

  const handleMoveOut = async (id) => {
    if (!window.confirm('Mark this member as moved out? Their history will be preserved, but they will be marked inactive.')) return;
    try {
      await api(`/members/${id}`, { method: 'PUT', body: { active: false } });
      setMessage('✅ Member marked as moved out.');
      loadMembers();
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    }
  };

  const handleReactivate = async (id) => {
    if (!window.confirm('Reactivate this member?')) return;
    try {
      await api(`/members/${id}`, { method: 'PUT', body: { active: true } });
      setMessage('✅ Member reactivated.');
      loadMembers();
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('⚠️ PERMANENTLY DELETE this member? This cannot be undone and will fail if they have payment history.')) return;
    try {
      const res = await api(`/members/${id}`, { method: 'DELETE' });
      setMessage(`✅ ${res.message}`);
      loadMembers();
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    }
  };

  const handleCreateLogin = async (id) => {
    if (!window.confirm('Create a portal login for this member?')) return;
    try {
      const res = await api(`/members/${id}/create-login`, { method: 'POST' });
      alert(res.message); 
      setMessage('✅ Login created successfully.');
      loadMembers(); // Refresh list
    } catch (err) {
      setMessage(`❌ ${err.message}`);
      loadMembers(); // ✅ CRITICAL: Refresh list even on error so the button changes to "Reset Pwd"
    }
  };

  const handleResetPassword = async (id) => {
    if (!window.confirm('Reset password for this member?')) return;
    try {
      const res = await api(`/members/${id}/reset-password`, { method: 'POST' });
      
      // DEBUG: Log exactly what the server sent back
      console.log(' Raw Backend Response:', res);
      
      // Show message, or error, or 'undefined' if the server sent nothing
      const msg = res.message || res.error || 'No message received from server';
      alert(msg);
      
      if (res.message) {
        setMessage('✅ Password reset successfully.');
      }
      loadMembers();
    } catch (err) {
      console.error('Frontend Catch Error:', err);
      setMessage(`❌ ${err.message}`);
    }
  };

  // --- UI HELPERS ---
  const inputStyle = { width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.875rem', boxSizing: 'border-box' };
  const btnPrimary = { padding: '8px 16px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '500', fontSize: '0.875rem' };
  const btnGhost = { padding: '6px 12px', background: 'transparent', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', color: '#374151' };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '600', color: '#1f2937' }}>Members Directory</h1>
        {isStaff && !isAdding && (
          <button onClick={() => { setIsAdding(true); setFormData(emptyForm); }} style={btnPrimary}>+ Add New Member</button>
        )}
      </div>

      {message && (
        <div style={{
          padding: '12px 16px', background: message.includes('✅') ? '#f0fdf4' : '#fef2f2',
          color: message.includes('✅') ? '#166534' : '#991b1b', borderRadius: '6px', marginBottom: '20px',
          fontSize: '0.875rem', border: `1px solid ${message.includes('✅') ? '#bbf7d0' : '#fecaca'}`
        }}>{message}</div>
      )}

      {/* ADD FORM */}
      {isAdding && (
        <form onSubmit={handleAdd} style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e5e7eb', marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>Add New Member</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <input required placeholder="Household Name" value={formData.household_name} onChange={e => setFormData({...formData, household_name: e.target.value})} style={inputStyle} />
            <input required placeholder="House Number" value={formData.house_number} onChange={e => setFormData({...formData, house_number: e.target.value})} style={inputStyle} />
            <input placeholder="Phone" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} style={inputStyle} />
            <input type="email" placeholder="Email (for portal login)" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} style={inputStyle} />
            <input type="number" placeholder="Monthly Due" value={formData.monthly_due} onChange={e => setFormData({...formData, monthly_due: Number(e.target.value)})} style={inputStyle} />
            <input type="number" placeholder="Previous Arrears (₦)" value={formData.opening_balance} onChange={e => setFormData({...formData, opening_balance: Number(e.target.value)})} style={inputStyle} />
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setIsAdding(false)} style={btnGhost}>Cancel</button>
            <button type="submit" style={btnPrimary}>Save Member</button>
          </div>
        </form>
      )}

      {/* TABLE */}
      <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Loading members...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>House No.</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Household</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Phone</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Email</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Linked User</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Outstanding</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Status</th>
                  {isStaff && <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {members.map((member, idx) => (
                  <tr key={member.id} style={{ 
                    borderBottom: idx !== members.length - 1 ? '1px solid #f3f4f6' : 'none',
                    opacity: member.active === false ? 0.6 : 1,
                    background: member.active === false ? '#fafafa' : 'transparent'
                  }}>
                    <td style={{ padding: '12px 16px', fontSize: '0.875rem', fontWeight: '600', color: '#1f2937' }}>
                      {editingId === member.id ? (
                        <input value={formData.house_number} onChange={e => setFormData({...formData, house_number: e.target.value})} style={{...inputStyle, width: '80px'}} />
                      ) : member.house_number}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#4b5563' }}>
                      {editingId === member.id ? (
                        <input value={formData.household_name} onChange={e => setFormData({...formData, household_name: e.target.value})} style={inputStyle} />
                      ) : member.household_name}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#4b5563' }}>
                      {editingId === member.id ? (
                        <input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} style={inputStyle} />
                      ) : member.phone || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#4b5563' }}>
                      {editingId === member.id ? (
                        <input value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} style={inputStyle} />
                      ) : member.email || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#4b5563' }}>
                      {member.user_name ? (
                        <span style={{ color: '#166534', fontWeight: '500' }}>{member.user_email}</span>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>—</span>
                      )}
                    </td>
                    
                    {/* FIXED: Added visible labels above the edit inputs */}
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.875rem', fontWeight: '600', color: (member.outstanding_balance || 0) > 0 ? '#ef4444' : '#10b981' }}>
                      {editingId === member.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                          <div>
                            <div style={{ fontSize: '0.65rem', color: '#6b7280', textAlign: 'right', marginBottom: '2px' }}>Monthly Due (₦)</div>
                            <input type="number" value={formData.monthly_due} onChange={e => setFormData({...formData, monthly_due: Number(e.target.value)})} style={{...inputStyle, width: '110px', textAlign: 'right'}} />
                          </div>
                          <div>
                            <div style={{ fontSize: '0.65rem', color: '#6b7280', textAlign: 'right', marginBottom: '2px' }}>Prev. Year Arrears (₦)</div>
                            <input type="number" value={formData.opening_balance} onChange={e => setFormData({...formData, opening_balance: Number(e.target.value)})} style={{...inputStyle, width: '110px', textAlign: 'right'}} />
                          </div>
                        </div>
                      ) : naira(member.outstanding_balance || 0)}
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        display: 'inline-block', padding: '4px 8px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '500',
                        background: member.active === false ? '#fee2e2' : '#dcfce7',
                        color: member.active === false ? '#991b1b' : '#166534'
                      }}>
                        {member.active === false ? 'Moved Out' : 'Active'}
                      </span>
                    </td>
                    {isStaff && (
                      <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {editingId === member.id ? (
                          <>
                            <button onClick={() => handleSaveEdit(member.id)} style={{...btnPrimary, marginRight: '8px', padding: '6px 12px', fontSize: '0.75rem'}}>Save</button>
                            <button onClick={() => { setEditingId(null); setFormData(emptyForm); }} style={btnGhost}>Cancel</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(member)} style={{...btnGhost, marginRight: '8px'}}>Edit</button>
                            
                            {member.active !== false ? (
                              <button onClick={() => handleMoveOut(member.id)} style={{...btnGhost, marginRight: '8px', color: '#991b1b', borderColor: '#fecaca', background: '#fef2f2'}}>Move Out</button>
                            ) : (
                              <button onClick={() => handleReactivate(member.id)} style={{...btnGhost, marginRight: '8px', color: '#166534', borderColor: '#bbf7d0', background: '#f0fdf4'}}>Reactivate</button>
                            )}

                            {member.user_email ? (
                              <button onClick={() => handleResetPassword(member.id)} style={{...btnGhost, marginRight: '8px', color: '#7c3aed', borderColor: '#ddd6fe', background: '#f5f3ff'}}>Reset Pwd</button>
                            ) : (
                              <button onClick={() => handleCreateLogin(member.id)} style={{...btnGhost, marginRight: '8px', color: '#1d4ed8', borderColor: '#bfdbfe', background: '#eff6ff'}}>Create Login</button>
                            )}

                            <button onClick={() => handleDelete(member.id)} style={{...btnGhost, color: '#dc2626', borderColor: '#fecaca', background: '#fef2f2'}}>Remove</button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}