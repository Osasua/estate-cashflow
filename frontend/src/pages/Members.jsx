import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import Skeleton from '../components/Skeleton';

const ROW_COLORS = [
  { border: '#6366f1', bg: '#eef2ff', text: '#4f46e5', gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' },
  { border: '#22c55e', bg: '#ecfdf5', text: '#059669', gradient: 'linear-gradient(135deg, #22c55e 0%, #10b981 100%)' },
  { border: '#f59e0b', bg: '#fffbeb', text: '#d97706', gradient: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)' },
  { border: '#ef4444', bg: '#fff1f2', text: '#e11d48', gradient: 'linear-gradient(135deg, #ef4444 0%, #f43f5e 100%)' },
  { border: '#06b6d4', bg: '#ecfeff', text: '#0891b2', gradient: 'linear-gradient(135deg, #06b6d4 0%, #22d3ee 100%)' },
  { border: '#a855f7', bg: '#f5f3ff', text: '#7c3aed', gradient: 'linear-gradient(135deg, #a855f7 0%, #d946ef 100%)' },
  { border: '#64748b', bg: '#f8fafc', text: '#475569', gradient: 'linear-gradient(135deg, #64748b 0%, #94a3b8 100%)' },
  { border: '#84cc16', bg: '#f0fdf4', text: '#16a34a', gradient: 'linear-gradient(135deg, #84cc16 0%, #a3e635 100%)' },
];

export default function Members() {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [editingMember, setEditingMember] = useState(null);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const res = await api('/members');
      console.log('Members API response:', res);
      setMembers(res.members || res || []);
    } catch (err) {
      console.error('Failed to load members:', err);
      setMessage('❌ Failed to load members: ' + err.message);
      setTimeout(() => setMessage(''), 5000);
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
      setMessage('✅ Member reactivated successfully');
      setTimeout(() => setMessage(''), 3000);
      await loadMembers();
    } catch (err) {
      setMessage('❌ ' + err.message);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleResetPassword = async (id) => {
    if (!window.confirm('Send password reset email to this member?')) return;
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

  const handleEditClick = (member) => {
    setEditingMember(member);
    setEditForm({
      household_name: member.household_name || '',
      phone: member.phone || '',
      email: member.email || '',
      house_number: member.house_number || ''
    });
  };

  const handleEditSave = async () => {
    try {
      await api(`/members/${editingMember.id}`, { method: 'PUT', body: editForm });
      setMessage('✅ Member updated successfully');
      setTimeout(() => setMessage(''), 3000);
      setEditingMember(null);
      await loadMembers();
    } catch (err) {
      setMessage('❌ ' + err.message);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  if (loading) return <div style={{ padding: '40px' }}><Skeleton height="40px" width="300px" /><div style={{ marginTop: '24px' }}>{[1,2,3,4,5].map(i => <Skeleton key={i} height="60px" width="100%" style={{ marginBottom: '12px' }} />)}</div></div>;

  const activeCount = members.filter(m => m.status === 'active').length;
  const movedOutCount = members.filter(m => m.status === 'moved_out').length;

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '2rem', fontWeight: '700', color: '#111827', letterSpacing: '-0.02em' }}>
            Members Directory
          </h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '1.05rem' }}>
            Manage estate residents and their accounts
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{
            background: '#ecfdf5',
            border: '2px solid #a7f3d0',
            borderRadius: '12px',
            padding: '12px 20px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: '600', textTransform: 'uppercase' }}>Active</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#059669' }}>{activeCount}</div>
          </div>
          <div style={{
            background: '#fffbeb',
            border: '2px solid #fde68a',
            borderRadius: '12px',
            padding: '12px 20px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: '600', textTransform: 'uppercase' }}>Moved Out</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#d97706' }}>{movedOutCount}</div>
          </div>
          <div style={{
            background: '#eef2ff',
            border: '2px solid #c7d2fe',
            borderRadius: '12px',
            padding: '12px 20px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#4f46e5', fontWeight: '600', textTransform: 'uppercase' }}>Total</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#4f46e5' }}>{members.length}</div>
          </div>
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
          color: '#111827',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span style={{ fontSize: '1.2rem' }}>{message.includes('✅') ? '✓' : '⚠'}</span>
          {message}
        </div>
      )}

      {/* Members Table */}
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        border: '1px solid #e5e7eb',
        borderLeft: '4px solid #6366f1',
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
      }}>
        <div style={{ padding: '24px 28px', borderBottom: '1px solid #e5e7eb', background: 'linear-gradient(to right, #f9fafb, #ffffff)' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600', color: '#111827' }}>
            📋 All Members
          </h3>
        </div>

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
                  const color = ROW_COLORS[idx % ROW_COLORS.length];
                  const outstanding = parseFloat(member.outstanding) || 0;
                  const isLinked = member.linked_user || member.user_email;
                  // Fix: Check multiple possible status values
                  const isActive = member.status === 'active' || member.status === 'Active' || member.is_active === true;
                  
                  return (
                    <tr
                      key={member.id}
                      style={{
                        borderLeft: `4px solid ${color.border}`,
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = color.bg + '30'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '16px 20px', fontSize: '0.95rem', fontWeight: '700', color: '#111827', borderBottom: '1px solid #f3f4f6' }}>
                        {member.house_number}
                      </td>
                      <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            background: color.gradient,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.1rem',
                            color: 'white',
                            fontWeight: '700',
                            boxShadow: `0 2px 6px ${color.border}40`
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
                            padding: '6px 12px',
                            background: '#eef2ff',
                            color: '#4f46e5',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            border: '1px solid #c7d2fe'
                          }}>
                            🔗 {isLinked}
                          </span>
                        ) : (
                          <span style={{ color: '#9ca3af', fontSize: '0.9rem' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'right', borderBottom: '1px solid #f3f4f6' }}>
                        <span style={{
                          fontSize: '0.95rem',
                          fontWeight: '700',
                          color: outstanding > 0 ? '#e11d48' : outstanding < 0 ? '#059669' : '#6b7280',
                          fontVariantNumeric: 'tabular-nums'
                        }}>
                          {outstanding !== 0 ? (outstanding > 0 ? '₦' : '-₦') : '₦'}{Math.abs(outstanding).toLocaleString()}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'center', borderBottom: '1px solid #f3f4f6' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '6px 14px',
                          background: isActive ? '#dcfce7' : '#fef3c7',
                          color: isActive ? '#166534' : '#92400e',
                          borderRadius: '20px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          border: `1px solid ${isActive ? '#86efac' : '#fde68a'}`
                        }}>
                          {isActive ? '✓ Active' : '📦 Moved Out'}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => handleEditClick(member)}
                            style={{
                              padding: '6px 12px',
                              background: '#fff',
                              color: color.text,
                              border: `2px solid ${color.border}`,
                              borderRadius: '6px',
                              fontWeight: '600',
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = color.bg;
                              e.currentTarget.style.transform = 'translateY(-1px)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = '#fff';
                              e.currentTarget.style.transform = 'translateY(0)';
                            }}
                          >
                            ✏️ Edit
                          </button>
                          {isActive ? (
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
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#fef2f2';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#fff';
                                e.currentTarget.style.transform = 'translateY(0)';
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
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#bbf7d0';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#dcfce7';
                                e.currentTarget.style.transform = 'translateY(0)';
                              }}
                            >
                              ✅ Reactivate
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
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#f5f3ff';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#fff';
                                e.currentTarget.style.transform = 'translateY(0)';
                              }}
                            >
                              🔑 Reset Pwd
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
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#d1fae5';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#ecfdf5';
                                e.currentTarget.style.transform = 'translateY(0)';
                              }}
                            >
                              👤 Create Login
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

      {/* Edit Modal */}
      {editingMember && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
          backdropFilter: 'blur(4px)'
        }} onClick={() => setEditingMember(null)}>
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            maxWidth: '500px',
            width: '100%',
            padding: '32px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            borderLeft: '4px solid #6366f1'
          }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 24px 0', fontSize: '1.5rem', fontWeight: '700', color: '#111827' }}>
              ✏️ Edit Member
            </h2>
            <div style={{ display: 'grid', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '600', color: '#374151' }}>House Number</label>
                <input
                  value={editForm.house_number}
                  onChange={(e) => setEditForm({...editForm, house_number: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '0.95rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '600', color: '#374151' }}>Household Name</label>
                <input
                  value={editForm.household_name}
                  onChange={(e) => setEditForm({...editForm, household_name: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '0.95rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '600', color: '#374151' }}>Phone</label>
                <input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '0.95rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '600', color: '#374151' }}>Email</label>
                <input
                  value={editForm.email}
                  onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '0.95rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setEditingMember(null)}
                style={{
                  padding: '10px 20px',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                style={{
                  padding: '10px 24px',
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                }}
              >
                💾 Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}