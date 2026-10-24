import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import Skeleton from '../components/Skeleton';

const ROW_COLORS = [
  '#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', 
  '#a855f7', '#64748b', '#84cc16', '#ec4899', '#14b8a6'
];

export default function Members() {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const res = await api('/members');
      setMembers(res.members || res || []);
    } catch (err) {
      console.error('Failed to load members:', err);
      setMessage(' Failed to load members');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleMoveOut = async (id) => {
    if (!window.confirm('Mark this member as moved out?')) return;
    try {
      await api(`/members/${id}`, { method: 'PUT', body: { status: 'moved_out' } });
      setMessage('✅ Member marked as moved out');
      setTimeout(() => setMessage(''), 3000);
      await loadMembers();
    } catch (err) {
      setMessage('❌ ' + err.message);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleReactivate = async (id) => {
    try {
      await api(`/members/${id}`, { method: 'PUT', body: { status: 'active' } });
      setMessage('✅ Member reactivated');
      setTimeout(() => setMessage(''), 3000);
      await loadMembers();
    } catch (err) {
      setMessage('❌ ' + err.message);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleResetPassword = async (id) => {
    if (!window.confirm('Reset password for this member?')) return;
    try {
      await api(`/members/${id}/reset-password`, { method: 'POST' });
      setMessage('✅ Password reset email sent');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('❌ ' + err.message);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleCreateLogin = async (id) => {
    try {
      await api(`/members/${id}/create-login`, { method: 'POST' });
      setMessage('✅ Login created successfully');
      setTimeout(() => setMessage(''), 3000);
      await loadMembers();
    } catch (err) {
      setMessage('❌ ' + err.message);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  if (loading) return <div style={{ padding: '40px' }}><Skeleton height="40px" width="300px" /><div style={{ marginTop: '24px' }}>{[1,2,3,4,5].map(i => <Skeleton key={i} height="60px" width="100%" style={{ marginBottom: '12px' }} />)}</div></div>;

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '2rem', fontWeight: '700', color: '#111827' }}>
            Members Directory
          </h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '1.05rem' }}>
            Manage estate residents and their accounts
          </p>
        </div>
      </div>

      {/* Message Banner */}
      {message && (
        <div style={{
          background: message.includes('✅') ? '#ecfdf5' : '#fff1f2',
          border: `1px solid ${message.includes('✅') ? '#a7f3d0' : '#fecdd3'}`,
          borderLeft: `4px solid ${message.includes('✅') ? '#22c55e' : '#ef4444'}`,
          borderRadius: '12px',
          padding: '16px 24px',
          marginBottom: '24px',
          fontSize: '0.95rem',
          fontWeight: '500',
          color: '#111827'
        }}>
          {message}
        </div>
      )}

      {/* Members Table */}
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        border: '1px solid #e5e7eb',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        {members.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
            <div style={{ fontSize: '4rem', marginBottom: '16px' }}>👥</div>
            <p style={{ fontSize: '1.1rem', fontWeight: '600', color: '#6b7280' }}>No members yet</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>House No.</th>
                  <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>Household</th>
                  <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>Phone</th>
                  <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>Email</th>
                  <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>Linked User</th>
                  <th style={{ padding: '16px 20px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>Outstanding</th>
                  <th style={{ padding: '16px 20px', textAlign: 'center', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>Status</th>
                  <th style={{ padding: '16px 20px', textAlign: 'center', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member, idx) => {
                  const rowColor = ROW_COLORS[idx % ROW_COLORS.length];
                  const outstanding = parseFloat(member.outstanding) || 0;
                  const isLinked = member.linked_user || member.user_email;
                  
                  return (
                    <tr
                      key={member.id}
                      style={{
                        borderLeft: `4px solid ${rowColor}`,
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '16px 20px', fontSize: '0.95rem', fontWeight: '700', color: '#111827', borderBottom: '1px solid #f3f4f6' }}>
                        {member.house_number}
                      </td>
                      <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: rowColor,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1rem',
                            color: 'white',
                            fontWeight: '700'
                          }}>
                            {member.household_name?.charAt(0) || 'M'}
                          </div>
                          <span style={{ fontSize: '0.95rem', fontWeight: '600', color: '#111827' }}>
                            {member.household_name}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: '0.9rem', color: '#6b7280', borderBottom: '1px solid #f3f4f6' }}>
                        {member.phone}
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: '0.9rem', color: '#6b7280', borderBottom: '1px solid #f3f4f6' }}>
                        {member.email}
                      </td>
                      <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
                        {isLinked ? (
                          <span style={{
                            display: 'inline-block',
                            padding: '4px 12px',
                            background: '#eef2ff',
                            color: '#4f46e5',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                            fontWeight: '600'
                          }}>
                            {isLinked}
                          </span>
                        ) : (
                          <span style={{ color: '#9ca3af' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'right', borderBottom: '1px solid #f3f4f6' }}>
                        <span style={{
                          fontSize: '0.95rem',
                          fontWeight: '700',
                          color: outstanding > 0 ? '#e11d48' : outstanding < 0 ? '#059669' : '#6b7280'
                        }}>
                          {outstanding > 0 ? '₦' : outstanding < 0 ? '-' : '₦'}{Math.abs(outstanding).toLocaleString()}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'center', borderBottom: '1px solid #f3f4f6' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '6px 14px',
                          background: member.status === 'active' ? '#dcfce7' : '#fef3c7',
                          color: member.status === 'active' ? '#166534' : '#92400e',
                          borderRadius: '20px',
                          fontSize: '0.8rem',
                          fontWeight: '600'
                        }}>
                          {member.status === 'active' ? 'Active' : 'Moved Out'}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button
                            onClick={() => {/* Edit handler */}}
                            style={{
                              padding: '6px 12px',
                              background: '#fff',
                              color: rowColor,
                              border: `2px solid ${rowColor}`,
                              borderRadius: '6px',
                              fontWeight: '600',
                              fontSize: '0.8rem',
                              cursor: 'pointer'
                            }}
                          >
                            Edit
                          </button>
                          {member.status === 'active' ? (
                            <button
                              onClick={() => handleMoveOut(member.id)}
                              style={{
                                padding: '6px 12px',
                                background: '#fff',
                                color: '#dc2626',
                                border: '2px solid #fecaca',
                                borderRadius: '6px',
                                fontWeight: '600',
                                fontSize: '0.8rem',
                                cursor: 'pointer'
                              }}
                            >
                              Move Out
                            </button>
                          ) : (
                            <button
                              onClick={() => handleReactivate(member.id)}
                              style={{
                                padding: '6px 12px',
                                background: '#dcfce7',
                                color: '#166534',
                                border: '2px solid #86efac',
                                borderRadius: '6px',
                                fontWeight: '600',
                                fontSize: '0.8rem',
                                cursor: 'pointer'
                              }}
                            >
                              Reactivate
                            </button>
                          )}
                          {isLinked ? (
                            <button
                              onClick={() => handleResetPassword(member.id)}
                              style={{
                                padding: '6px 12px',
                                background: '#fff',
                                color: '#7c3aed',
                                border: '2px solid #ddd6fe',
                                borderRadius: '6px',
                                fontWeight: '600',
                                fontSize: '0.8rem',
                                cursor: 'pointer'
                              }}
                            >
                              Reset Pwd
                            </button>
                          ) : (
                            <button
                              onClick={() => handleCreateLogin(member.id)}
                              style={{
                                padding: '6px 12px',
                                background: '#ecfdf5',
                                color: '#059669',
                                border: '2px solid #a7f3d0',
                                borderRadius: '6px',
                                fontWeight: '600',
                                fontSize: '0.8rem',
                                cursor: 'pointer'
                              }}
                            >
                              Create Login
                            </button>
                          )}
                        </div>
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