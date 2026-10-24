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
];

export default function Contributions() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('Monthly');
  const [contributions, setContributions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    month: new Date().toLocaleString('default', { month: 'long' }),
    year: new Date().getFullYear().toString(),
    customAmount: '',
    defaultersOnly: false
  });

  useEffect(() => {
    loadContributions();
  }, [activeTab]);

  const loadContributions = async () => {
    setLoading(true);
    try {
      const res = await api(`/contributions?tab=${activeTab.toLowerCase().replace(' ', '_')}`);
      setContributions(res.contributions || res || []);
    } catch (err) {
      console.error('Failed to load contributions:', err);
      setMessage(' Failed to load contributions');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateBills = async () => {
    try {
      await api('/contributions/generate', {
        method: 'POST',
        body: {
          month: form.month,
          year: form.year,
          customAmount: form.customAmount ? parseFloat(form.customAmount) : null,
          defaultersOnly: form.defaultersOnly
        }
      });
      setMessage('✅ Bills generated successfully');
      setTimeout(() => setMessage(''), 3000);
      await loadContributions();
    } catch (err) {
      setMessage('❌ ' + err.message);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleRecordPayment = (contribution) => {
    // Open payment modal or redirect - existing functionality
    console.log('Record payment for:', contribution);
  };

  const handleEdit = (contribution) => {
    // Edit existing contribution - existing functionality
    console.log('Edit contribution:', contribution);
  };

  const expected = contributions.reduce((sum, c) => sum + (parseFloat(c.due) || 0), 0);
  const collected = contributions.reduce((sum, c) => sum + (parseFloat(c.paid) || 0), 0);
  const outstanding = expected - collected;

  if (loading) return <div style={{ padding: '40px' }}><Skeleton height="40px" width="300px" /><div style={{ marginTop: '24px' }}>{[1,2,3].map(i => <Skeleton key={i} height="120px" width="100%" style={{ marginBottom: '12px' }} />)}</div></div>;

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '2rem', fontWeight: '700', color: '#111827', letterSpacing: '-0.02em' }}>
          Contributions
        </h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '1.05rem' }}>
          Manage estate contributions and payments
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '2px solid #e5e7eb', paddingBottom: '2px', flexWrap: 'wrap' }}>
        {['Monthly', 'Float', 'Projects', 'End of Year', 'Welfare'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 20px',
              background: activeTab === tab ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' : 'transparent',
              color: activeTab === tab ? 'white' : '#6b7280',
              border: 'none',
              borderBottom: activeTab === tab ? '3px solid #6366f1' : '3px solid transparent',
              fontWeight: activeTab === tab ? '600' : '500',
              cursor: 'pointer',
              borderRadius: '8px 8px 0 0',
              transition: 'all 0.2s',
              marginBottom: '-2px'
            }}
            onMouseEnter={(e) => { if (activeTab !== tab) e.currentTarget.style.background = '#f3f4f6'; }}
            onMouseLeave={(e) => { if (activeTab !== tab) e.currentTarget.style.background = 'transparent'; }}
          >
            {tab}
          </button>
        ))}
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

      {/* Form Section */}
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        border: '1px solid #e5e7eb',
        borderLeft: '4px solid #6366f1',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 2px 8px rgba(99, 102, 241, 0.08)'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: '#374151' }}>Month</label>
            <select
              value={form.month}
              onChange={(e) => setForm({ ...form, month: e.target.value })}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '0.95rem',
                background: '#fff'
              }}
            >
              {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: '#374151' }}>Year</label>
            <input
              type="number"
              value={form.year}
              onChange={(e) => setForm({ ...form, year: e.target.value })}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '0.95rem'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: '#374151' }}>Custom Amount (Optional)</label>
            <input
              type="number"
              value={form.customAmount}
              onChange={(e) => setForm({ ...form, customAmount: e.target.value })}
              placeholder="Leave blank for default"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '0.95rem'
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
            <input
              type="checkbox"
              id="defaulters"
              checked={form.defaultersOnly}
              onChange={(e) => setForm({ ...form, defaultersOnly: e.target.checked })}
              style={{ width: '18px', height: '18px', marginRight: '8px', cursor: 'pointer' }}
            />
            <label htmlFor="defaulters" style={{ fontSize: '0.9rem', color: '#374151', cursor: 'pointer' }}>Defaulters only</label>
          </div>
          <button
            onClick={handleGenerateBills}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              fontSize: '0.95rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            Generate Bills
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid #e5e7eb',
          borderLeft: '4px solid #6366f1',
          boxShadow: '0 2px 8px rgba(99, 102, 241, 0.08)'
        }}>
          <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px', fontWeight: '500' }}>Expected</div>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#4f46e5' }}>₦{expected.toLocaleString()}</div>
        </div>
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid #e5e7eb',
          borderLeft: '4px solid #22c55e',
          boxShadow: '0 2px 8px rgba(34, 197, 94, 0.08)'
        }}>
          <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px', fontWeight: '500' }}>Collected</div>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#059669' }}>₦{collected.toLocaleString()}</div>
        </div>
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid #e5e7eb',
          borderLeft: '4px solid #ef4444',
          boxShadow: '0 2px 8px rgba(239, 68, 68, 0.08)'
        }}>
          <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px', fontWeight: '500' }}>Outstanding</div>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#e11d48' }}>₦{outstanding.toLocaleString()}</div>
        </div>
      </div>

      {/* Table */}
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        border: '1px solid #e5e7eb',
        borderLeft: '4px solid #6366f1',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
      }}>
        {contributions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
            <div style={{ fontSize: '4rem', marginBottom: '16px' }}>💰</div>
            <p style={{ fontSize: '1.1rem', fontWeight: '600', color: '#6b7280' }}>No contributions yet</p>
            <p style={{ fontSize: '0.95rem' }}>Generate bills to get started</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>House</th>
                  <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>Household</th>
                  <th style={{ padding: '16px 20px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>Due</th>
                  <th style={{ padding: '16px 20px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>Paid</th>
                  <th style={{ padding: '16px 20px', textAlign: 'center', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>Status</th>
                  <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>Reference</th>
                  <th style={{ padding: '16px 20px', textAlign: 'center', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {contributions.map((c, idx) => {
                  const color = ROW_COLORS[idx % ROW_COLORS.length];
                  const isPaid = c.status === 'paid' || c.paid > 0;
                  
                  return (
                    <tr
                      key={c.id}
                      style={{
                        borderLeft: `4px solid ${color.border}`,
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = color.bg + '30'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '16px 20px', fontSize: '0.95rem', fontWeight: '700', color: '#111827', borderBottom: '1px solid #f3f4f6' }}>
                        {c.house_number}
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
                            {c.household?.charAt(0) || 'H'}
                          </div>
                          <span style={{ fontSize: '0.95rem', fontWeight: '600', color: '#111827' }}>
                            {c.household}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'right', fontSize: '0.95rem', fontWeight: '700', color: '#6b7280', borderBottom: '1px solid #f3f4f6' }}>
                        {parseFloat(c.due || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'right', fontSize: '0.95rem', fontWeight: '700', color: isPaid ? '#059669' : '#9ca3af', borderBottom: '1px solid #f3f4f6' }}>
                        ₦{parseFloat(c.paid || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'center', borderBottom: '1px solid #f3f4f6' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '6px 14px',
                          background: isPaid ? '#dcfce7' : '#fee2e2',
                          color: isPaid ? '#166534' : '#991b1b',
                          borderRadius: '20px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          border: `1px solid ${isPaid ? '#86efac' : '#fecaca'}`
                        }}>
                          {isPaid ? '✓ Paid' : '⏳ Pending'}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: '0.9rem', color: '#6b7280', borderBottom: '1px solid #f3f4f6' }}>
                        {c.reference || '—'}
                      </td>
                      <td style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button
                            onClick={() => handleEdit(c)}
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
                            onMouseEnter={(e) => e.currentTarget.style.background = color.bg}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                          >
                            ️ Edit
                          </button>
                          {isPaid ? (
                            <button
                              onClick={() => handleRecordPayment(c)}
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
                              onMouseEnter={(e) => e.currentTarget.style.background = '#d1fae5'}
                              onMouseLeave={(e) => e.currentTarget.style.background = '#ecfdf5'}
                            >
                              ➕ Add Payment
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRecordPayment(c)}
                              style={{
                                padding: '6px 12px',
                                background: '#fff',
                                color: '#059669',
                                border: '2px solid #86efac',
                                borderRadius: '6px',
                                fontWeight: '600',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#ecfdf5'}
                              onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                            >
                              💵 Record Payment
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