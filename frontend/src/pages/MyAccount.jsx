import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { naira, fmtDate } from '../format';
import PayButton from '../components/PayButton';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7'];

// ✅ Unified KPI Card Style (Matches Expenses & Reports)
const kpiStyle = (color) => ({
  background: '#fff',
  padding: '20px 24px',
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
  borderLeft: `4px solid ${color}`,
  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
});

export default function MyAccount() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('summary');
  const [timeFilter, setTimeFilter] = useState('monthly');

  useEffect(() => {
    api('/resident/dashboard')
      .then(setData)
      .catch((e) => console.error(e));
  }, []);

  const handleSuccess = useCallback(async (reference) => {
    console.log('🟢 MyAccount received success callback:', reference);
    try {
      await api('/payments/verify', { method: 'POST', body: { reference: reference.reference } });
      alert('Payment Successful!');
      const newData = await api('/resident/dashboard');
      setData(newData);
    } catch (error) {
      console.error('Verification failed:', error);
      alert('Payment was made but verification failed. Please contact admin.');
    }
  }, []);

  const handleClose = useCallback(() => { console.log('🔴 Payment popup closed'); }, []);

  const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || 'pk_test_d6736c254ac79fe7ebc92216fc97d5c29ba6c626';
  const userEmail = user?.email || 'osasua@gmail.com';

  const filterContributions = (contributions) => {
    const now = new Date();
    return contributions.filter(c => {
      if (timeFilter === 'monthly') return c.period_year === now.getFullYear() && c.period_month === now.getMonth() + 1;
      else if (timeFilter === 'quarterly') {
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const cQuarter = Math.floor((c.period_month - 1) / 3);
        return c.period_year === now.getFullYear() && cQuarter === currentQuarter;
      } else if (timeFilter === 'yearly') return c.period_year === now.getFullYear();
      return true;
    });
  };

  const filteredContributions = filterContributions(data?.contributions || []);
  const filteredDue = filteredContributions.reduce((sum, c) => sum + Number(c.amount_due), 0);
  const filteredPaid = filteredContributions.reduce((sum, c) => sum + Number(c.amount_paid), 0);

  // --- CHART DATA FOR SUMMARY TAB ---
  const paymentTrendData = (data?.recentPayments || []).reduce((acc, payment) => {
    const monthKey = `${MONTHS[payment.period_month - 1]} ${payment.period_year}`;
    const existing = acc.find(item => item.month === monthKey);
    if (existing) {
      existing.amount += Number(payment.amount);
    } else {
      acc.push({ month: monthKey, amount: Number(payment.amount) });
    }
    return acc;
  }, []).slice(0, 6).reverse();

  const summaryContributionTypeData = (data?.contributions || []).reduce((acc, c) => {
    const type = c.type || 'Monthly';
    const existing = acc.find(item => item.name === type);
    if (existing) {
      existing.value += Number(c.amount_paid);
    } else {
      acc.push({ name: type, value: Number(c.amount_paid) });
    }
    return acc;
  }, []);

  // --- CHART DATA FOR HISTORY TAB ---
  const historyContributionTypeData = filteredContributions.reduce((acc, c) => {
    const type = (c.type || 'monthly').toLowerCase();
    const existing = acc.find(item => item.name === type);
    if (existing) {
      existing.value += Number(c.amount_due);
    } else {
      acc.push({ name: type.charAt(0).toUpperCase() + type.slice(1), value: Number(c.amount_due) });
    }
    return acc;
  }, []);

  const historyPaymentStatusData = filteredContributions.reduce((acc, c) => {
    const type = (c.type || 'monthly').toLowerCase();
    const typeName = type.charAt(0).toUpperCase() + type.slice(1);
    const existing = acc.find(item => item.type === typeName);
    if (existing) {
      existing.paid += Number(c.amount_paid);
      existing.pending += Math.max(0, Number(c.amount_due) - Number(c.amount_paid));
    } else {
      acc.push({ 
        type: typeName, 
        paid: Number(c.amount_paid), 
        pending: Math.max(0, Number(c.amount_due) - Number(c.amount_paid)) 
      });
    }
    return acc;
  }, []);

  const fullyPaidCount = filteredContributions.filter(c => Number(c.amount_paid) >= Number(c.amount_due)).length;
  const pendingCount = filteredContributions.filter(c => Number(c.amount_paid) < Number(c.amount_due)).length;
  const completionRate = filteredContributions.length > 0 ? Math.round((fullyPaidCount / filteredContributions.length) * 100) : 0;

  if (!data) return <p className="muted" style={{ padding: '40px', textAlign: 'center' }}>Loading your account...</p>;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px 0' }}>
      <h1 style={{ margin: '0 0 24px 0', fontSize: '1.5rem', fontWeight: '600', color: '#1f2937' }}>My Account — {user?.name || 'Resident'}</h1>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', borderBottom: '2px solid #e5e7eb' }}>
        <button 
          onClick={() => setActiveTab('summary')} 
          style={{ 
            padding: '10px 20px', 
            border: 'none', 
            background: 'transparent', 
            cursor: 'pointer', 
            fontWeight: activeTab === 'summary' ? '600' : '400', 
            borderBottom: activeTab === 'summary' ? '3px solid #4f46e5' : '3px solid transparent', 
            color: activeTab === 'summary' ? '#4f46e5' : '#6b7280',
            transition: 'all 0.2s'
          }}
        >
          Account Summary
        </button>
        <button 
          onClick={() => setActiveTab('history')} 
          style={{ 
            padding: '10px 20px', 
            border: 'none', 
            background: 'transparent', 
            cursor: 'pointer', 
            fontWeight: activeTab === 'history' ? '600' : '400', 
            borderBottom: activeTab === 'history' ? '3px solid #4f46e5' : '3px solid transparent', 
            color: activeTab === 'history' ? '#4f46e5' : '#6b7280',
            transition: 'all 0.2s'
          }}
        >
          Contribution History
        </button>
      </div>

      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: '500' }}>Viewing:</span>
        <select 
          value={timeFilter} 
          onChange={(e) => setTimeFilter(e.target.value)} 
          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.875rem', color: '#374151' }}
        >
          <option value="monthly">This Month</option>
          <option value="quarterly">This Quarter</option>
          <option value="yearly">This Year</option>
          <option value="all">All Time</option>
        </select>
      </div>

      {/* ================= SUMMARY TAB ================= */}
      {activeTab === 'summary' && (
        <>
          {/* ✅ Unified KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={kpiStyle('#6366f1')}>
              <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px', fontWeight: '500' }}>Total Due</div>
              <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#111827' }}>{naira(filteredDue)}</div>
            </div>
            <div style={kpiStyle('#22c55e')}>
              <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px', fontWeight: '500' }}>Total Paid</div>
              <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#111827' }}>{naira(filteredPaid)}</div>
            </div>
            <div style={kpiStyle('#ef4444')}>
              <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px', fontWeight: '500' }}>Outstanding Balance</div>
              <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#111827' }}>{naira(filteredDue - filteredPaid)}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <h3 style={{ marginBottom: '20px', fontSize: '1rem', fontWeight: '600', color: '#1f2937' }}>Payment History (Last 6 Months)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={paymentTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => naira(v)} />
                  <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <h3 style={{ marginBottom: '20px', fontSize: '1rem', fontWeight: '600', color: '#1f2937' }}>Contributions by Type</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={summaryContributionTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3}>
                    {summaryContributionTypeData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => naira(v)} />
                  <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: '#1f2937' }}>Recent Payments</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Date</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Period</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Method</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentPayments.map((p, i) => (
                    <tr key={i} style={{ borderBottom: i !== data.recentPayments.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                      <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#374151' }}>{fmtDate(p.paid_at)}</td>
                      <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#1f2937' }}>{p.period_month ? `${MONTHS[p.period_month - 1]} ${p.period_year}` : 'N/A'}</td>
                      <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#6b7280', textTransform: 'capitalize' }}>{p.method}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.875rem', fontWeight: '600', color: '#1f2937' }}>{naira(p.amount)}</td>
                    </tr>
                  ))}
                  {data.recentPayments.length === 0 && (
                    <tr><td colSpan="4" style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>No payments found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ================= HISTORY TAB ================= */}
      {activeTab === 'history' && (
        <>
          {/* Personal Analytics Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <h3 style={{ marginBottom: '20px', fontSize: '1rem', fontWeight: '600', color: '#1f2937' }}>Contributions by Type</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie 
                    data={historyContributionTypeData} 
                    dataKey="value" 
                    nameKey="name" 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={60} 
                    outerRadius={90} 
                    paddingAngle={3}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {historyContributionTypeData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => naira(v)} />
                  <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <h3 style={{ marginBottom: '20px', fontSize: '1rem', fontWeight: '600', color: '#1f2937' }}>Payment Status by Type</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={historyPaymentStatusData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="type" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => naira(v)} />
                  <Legend />
                  <Bar dataKey="paid" name="Paid" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pending" name="Pending" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ✅ Unified Summary Cards for History */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={kpiStyle('#22c55e')}>
              <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px', fontWeight: '500' }}>Fully Paid</div>
              <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#111827' }}>{fullyPaidCount} <span style={{ fontSize: '0.875rem', fontWeight: '400', color: '#6b7280' }}>contributions</span></div>
            </div>
            <div style={kpiStyle('#ef4444')}>
              <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px', fontWeight: '500' }}>Pending</div>
              <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#111827' }}>{pendingCount} <span style={{ fontSize: '0.875rem', fontWeight: '400', color: '#6b7280' }}>contributions</span></div>
            </div>
            <div style={kpiStyle('#6366f1')}>
              <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px', fontWeight: '500' }}>Completion Rate</div>
              <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#111827' }}>{completionRate}% <span style={{ fontSize: '0.875rem', fontWeight: '400', color: '#6b7280' }}>of total</span></div>
            </div>
          </div>

          {/* Contribution History Table */}
          <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: '#1f2937' }}>Contribution History</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Period</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Type</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Due</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Paid</th>
                    <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Status</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContributions.map((c, i) => {
                    const isPending = Number(c.amount_paid) < Number(c.amount_due);
                    const amountLeft = Number(c.amount_due) - Number(c.amount_paid);
                    return (
                      <tr key={i} style={{ borderBottom: i !== filteredContributions.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                        <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#374151' }}>{c.period_month ? `${MONTHS[c.period_month - 1]} ${c.period_year}` : 'N/A'}</td>
                        <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#6b7280', textTransform: 'capitalize' }}>{c.type || 'monthly'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.875rem', color: '#1f2937' }}>{naira(c.amount_due)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.875rem', color: '#1f2937' }}>{naira(c.amount_paid)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span style={{ 
                            padding: '4px 12px', 
                            borderRadius: '12px', 
                            fontSize: '0.75rem', 
                            fontWeight: '600', 
                            background: !isPending ? '#dcfce7' : '#fee2e2', 
                            color: !isPending ? '#166534' : '#991b1b' 
                          }}>
                            {!isPending ? 'Paid' : 'Pending'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          {isPending ? (
                            <PayButton amountLeft={amountLeft} email={userEmail} contributionId={c.id} userId={user.id} publicKey={publicKey} onSuccess={handleSuccess} onClose={handleClose} />
                          ) : (
                            <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredContributions.length === 0 && (
                    <tr><td colSpan="6" style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>No contributions found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}