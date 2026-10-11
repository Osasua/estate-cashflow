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

  // ✅ This safely marks them as moved out WITHOUT deleting their history
  const handleMoveOut = async (id) => {
    if (!window.confirm('Are you sure you want to mark this member as moved out? Their history will be preserved, but they will be marked as inactive.')) return;
    
    try {
      await api(`/members/${id}`, { 
        method: 'PUT', 
        body: { active: false } 
      });
      setMessage('✅ Member marked as moved out successfully.');
      loadMembers();
    } catch (err) {
      setMessage('❌ Error updating member status.');
    }
  };

  // ✅ This brings them back to active status
  const handleReactivate = async (id) => {
    if (!window.confirm('Reactivate this member?')) return;
    
    try {
      await api(`/members/${id}`, { 
        method: 'PUT', 
        body: { active: true } 
      });
      setMessage('✅ Member reactivated.');
      loadMembers();
    } catch (err) {
      setMessage('❌ Error reactivating member.');
    }
  };

  const handleCreateLogin = async (id) => {
    if (!window.confirm('Create a portal login for this member? A temporary password will be emailed to them.')) return;
    try {
      const res = await api(`/members/${id}/create-login`, { method: 'POST' });
      setMessage(`✅ ${res.message}`);
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px 0' }}>
      <h1 style={{ margin: '0 0 24px 0', fontSize: '1.5rem', fontWeight: '600', color: '#1f2937' }}>
        Members Directory
      </h1>

      {message && (
        <div style={{
          padding: '12px 16px',
          background: message.includes('✅') ? '#f0fdf4' : '#fef2f2',
          color: message.includes('✅') ? '#166534' : '#991b1b',
          borderRadius: '6px',
          marginBottom: '20px',
          fontSize: '0.875rem',
          border: `1px solid ${message.includes('✅') ? '#bbf7d0' : '#fecaca'}`
        }}>
          {message}
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: '#1f2937' }}>
            All Households ({members.length})
          </h2>
        </div>
        
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Loading members...</div>
        ) : members.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>No members found.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>House No.</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Household Name</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Contact</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Portal User</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Total Due</th>
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
                      {member.house_number}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#4b5563' }}>
                      {member.household_name}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#4b5563' }}>
                      <div>{member.phone || '-'}</div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{member.email || '-'}</div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#4b5563' }}>
                      {member.user_name ? (
                        <span style={{ color: '#166534', fontWeight: '500' }}>{member.user_email}</span>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>No login</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.875rem', fontWeight: '500', color: member.total_due > 0 ? '#ef4444' : '#10b981' }}>
                      {naira(member.total_due)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 8px',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        background: member.active === false ? '#fee2e2' : '#dcfce7',
                        color: member.active === false ? '#991b1b' : '#166534'
                      }}>
                        {member.active === false ? 'Moved Out' : 'Active'}
                      </span>
                    </td>
                    {isStaff && (
                      <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {member.active !== false ? (
                          <button 
                            onClick={() => handleMoveOut(member.id)}
                            style={{
                              padding: '6px 12px',
                              background: '#fef2f2',
                              color: '#991b1b',
                              border: '1px solid #fecaca',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              fontWeight: '500',
                              marginRight: '8px'
                            }}
                          >
                            Mark as Moved Out
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleReactivate(member.id)}
                            style={{
                              padding: '6px 12px',
                              background: '#f0fdf4',
                              color: '#166534',
                              border: '1px solid #bbf7d0',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              fontWeight: '500',
                              marginRight: '8px'
                            }}
                          >
                            Reactivate
                          </button>
                        )}
                        
                        {!member.user_email && (
                          <button 
                            onClick={() => handleCreateLogin(member.id)}
                            style={{
                              padding: '6px 12px',
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1px solid #bfdbfe',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              fontWeight: '500'
                            }}
                          >
                            Create Login
                          </button>
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