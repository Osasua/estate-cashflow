import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { naira } from '../format';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import Skeleton from '../components/Skeleton';
import Tabs from '../components/Tabs';

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#64748b', '#84cc16', '#ec4899', '#14b8a6'];

// Same fund tabs as the dashboard, plus an Overview of all funds
const ACCOUNT_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'float', label: 'Float' },
  { key: 'projects', label: 'Projects' },
  { key: 'end-of-year', label: 'End of Year' },
  { key: 'welfare', label: 'Welfare' },
];
const TAB_LABEL = ACCOUNT_TABS.reduce((m, t) => ({ ...m, [t.key]: t.label }), {});
const OCCASION_TABS = ['float', 'projects', 'end-of-year', 'welfare'];

const STATUS_PILL = {
  paid: { bg: '#dcfce7', color: '#166534', label: '✓ Paid' },
  partial: { bg: '#fef3c7', color: '#92400e', label: '⚠ Partial' },
  pending: { bg: '#fee2e2', color: '#991b1b', label: '⏳ Pending' },
};

export default function MyAccount() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState('this_month');
  const [tab, setTab] = useState('overview');
  
  // Payment Modal State
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [paymentEmail, setPaymentEmail] = useState(user?.email || '');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  useEffect(() => {
    // Check if user was redirected back from a successful payment
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('payment') === 'success') {
      // Clean up the URL so it doesn't trigger on every render
      window.history.replaceState({}, document.title, window.location.pathname);
      // Force a fresh load of data to reflect the paid status
      loadData();
    } else {
      loadData();
    }
  }, [viewing, tab]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api(`/my-account?viewing=${viewing}${tab !== 'overview' ? `&type=${encodeURIComponent(tab)}` : ''}`);
      if (tab !== 'overview' && res?.scope?.type !== tab) {
        setError('Per-fund account data is not available yet. The backend needs the My Account "?type=" update (see docs/BACKEND_CONTRACT.md).');
        return;
      }
      setData(res);
    } catch (err) {
      console.error('Failed to load account data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handlePayClick = (bill) => {
    setSelectedBill(bill);
    setPaymentEmail(user?.email || '');
    setPaymentError('');
    setShowPayModal(true);
  };

  const handleInitializePayment = async () => {
    if (!paymentEmail) {
      setPaymentError('Email address is required for receipt');
      return;
    }

    // CRITICAL FIX: Send the contribution ID (selectedBill.id), not member_id
    const contributionId = selectedBill.id;
    
    if (!contributionId) {
      setPaymentError('Unable to identify the bill. Please refresh and try again.');
      return;
    }

    setPaymentLoading(true);
    setPaymentError('');

    try {
      const response = await api('/payments/initialize', {
        method: 'POST',
        body: {
          contribution_id: contributionId, // This is what the webhook needs to update the correct bill!
          amount: selectedBill.outstanding,
          email: paymentEmail,
          reference: `ESTATE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }
      });

      window.location.href = response.authorization_url;

    } catch (err) {
      setPaymentError(err.message || 'Failed to initialize payment');
      setPaymentLoading(false);
    }
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'white',
          padding: '14px 18px',
          border: '1px solid #e5e7eb',
          borderRadius: '10px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
          fontSize: '0.875rem',
          minWidth: '180px'
        }}>
          <p style={{ margin: '0 0 10px 0', fontWeight: '600', color: '#111827', fontSize: '0.9rem' }}>{label}</p>
          {payload.map((entry, index) => (
            <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '6px 0', gap: '20px' }}>
              <span style={{ color: '#6b7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: entry.color, display: 'inline-block' }}></span>
                {entry.name}
              </span>
              <span style={{ fontWeight: '600', color: '#111827' }}>{naira(entry.value)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div style={{ padding: '40px' }}>
        <Skeleton height="40px" width="300px" style={{ marginBottom: '24px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          {[1, 2, 3].map(i => <Skeleton key={i} height="120px" width="100%" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚠️</div>
        <h2 style={{ color: '#ef4444', marginBottom: '8px' }}>Error Loading Account</h2>
        <p style={{ color: '#6b7280' }}>{error}</p>
        <button 
          onClick={loadData}
          style={{ marginTop: '16px', padding: '10px 24px', background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>👤</div>
        <p>No account data available</p>
      </div>
    );
  }

  const { member, summary, payment_history, contributions_by_type, recent_payments } = data;
  const occasions = data.occasions || null;
  const scoped = tab !== 'overview';
  const isOccasion = OCCASION_TABS.includes(tab);
  const statusDonut = scoped && occasions ? [
    { name: 'Paid', value: occasions.filter((o) => o.status === 'paid').length, color: '#22c55e' },
    { name: 'Partial', value: occasions.filter((o) => o.status === 'partial').length, color: '#f59e0b' },
    { name: 'Pending', value: occasions.filter((o) => o.status === 'pending').length, color: '#ef4444' },
  ].filter((d) => d.value > 0) : [];

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '2rem', fontWeight: '700', color: '#111827', letterSpacing: '-0.02em' }}>
          My Account — {member?.household_name || user?.household_name || 'Resident'}
        </h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '1.05rem' }}>
          View your contribution history and account status
        </p>
      </div>

      {/* Fund tabs — mirror the dashboard */}
      <Tabs tabs={ACCOUNT_TABS} active={tab} onChange={setTab} />

      {/* Viewing Filter (overview + monthly only) */}
      {(tab === 'overview' || tab === 'monthly') && (
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <label style={{ fontSize: '0.9rem', fontWeight: '600', color: '#374151' }}>Viewing:</label>
        <select
          value={viewing}
          onChange={(e) => setViewing(e.target.value)}
          style={{
            padding: '8px 16px',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            fontSize: '0.9rem',
            background: '#fff',
            cursor: 'pointer'
          }}
        >
          <option value="this_month">This Month</option>
          <option value="last_month">Last Month</option>
          <option value="last_3_months">Last 3 Months</option>
          <option value="last_6_months">Last 6 Months</option>
          <option value="year_to_date">Year to Date</option>
        </select>
      </div>
      )}

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid #e5e7eb',
          borderLeft: '4px solid #6366f1',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '8px', fontWeight: '500' }}>{scoped ? `Total Due — ${TAB_LABEL[tab]}` : 'Total Due'}</div>
          <div style={{ fontSize: '2.25rem', fontWeight: '700', color: '#111827' }}>{naira(summary.total_due)}</div>
          <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '6px' }}>{isOccasion ? 'All-time for this fund' : 'Selected viewing window'}</div>
        </div>
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid #e5e7eb',
          borderLeft: '4px solid #22c55e',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '8px', fontWeight: '500' }}>{scoped ? `Total Paid — ${TAB_LABEL[tab]}` : 'Total Paid'}</div>
          <div style={{ fontSize: '2.25rem', fontWeight: '700', color: '#111827' }}>{naira(summary.total_paid)}</div>
          <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '6px' }}>{isOccasion ? 'All-time for this fund' : 'Selected viewing window'}</div>
        </div>
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid #e5e7eb',
          borderLeft: '4px solid #ef4444',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '8px', fontWeight: '500' }}>{scoped ? `Outstanding — ${TAB_LABEL[tab]}` : 'Outstanding Balance'}</div>
          <div style={{ fontSize: '2.25rem', fontWeight: '700', color: '#111827' }}>{naira(summary.outstanding)}</div>
          <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '6px' }}>{isOccasion ? 'All-time for this fund' : 'Selected viewing window'}</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        {/* Panel A: per-activation bars (occasion funds) or 6-month history */}
        {isOccasion ? (
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          border: '1px solid #e5e7eb',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <h3 style={{ margin: '0 0 24px 0', fontSize: '1.125rem', fontWeight: '600', color: '#111827' }}>
            Your {TAB_LABEL[tab]} Activations
          </h3>
          {occasions && occasions.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={occasions} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="short" tick={{ fontSize: 12, fill: '#6b7280', fontWeight: '600' }} axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={{ fontSize: 12, fill: '#9ca3af', fontWeight: '600' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : `₦${v}`} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.08)' }} />
                <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '13px', fontWeight: '500' }} />
                <Bar dataKey="due" name="Billed" fill="#6366f1" fillOpacity={0.35} radius={[10, 10, 4, 4]} maxBarSize={60} />
                <Bar dataKey="paid" name="Paid" fill="#22c55e" radius={[10, 10, 4, 4]} maxBarSize={60} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '320px', color: '#9ca3af', fontSize: '1rem' }}>
              You have no {TAB_LABEL[tab]} activations yet
            </div>
          )}
        </div>
        ) : (
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          border: '1px solid #e5e7eb',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <h3 style={{ margin: '0 0 24px 0', fontSize: '1.125rem', fontWeight: '600', color: '#111827' }}>
            Payment History (Last 6 Months)
          </h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={payment_history || []} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
              <defs>
                <linearGradient id="myAcctGrad0" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={1} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.8} />
                </linearGradient>
                <linearGradient id="myAcctGrad1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={1} />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity={0.8} />
                </linearGradient>
                <linearGradient id="myAcctGrad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity={1} />
                  <stop offset="100%" stopColor="#d946ef" stopOpacity={0.8} />
                </linearGradient>
                <linearGradient id="myAcctGrad3" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d946ef" stopOpacity={1} />
                  <stop offset="100%" stopColor="#ec4899" stopOpacity={0.8} />
                </linearGradient>
                <linearGradient id="myAcctGrad4" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ec4899" stopOpacity={1} />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.8} />
                </linearGradient>
                <linearGradient id="myAcctGrad5" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity={1} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.8} />
                </linearGradient>
                <filter id="myAcctShadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#6366f1" floodOpacity="0.3"/>
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis
                dataKey="short_month"
                tick={{ fontSize: 13, fill: '#6b7280', fontWeight: '700' }}
                axisLine={false}
                tickLine={false}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#9ca3af', fontWeight: '600' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => v >= 1000 ? `₦${(v/1000).toFixed(0)}k` : `₦${v}`}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: 'rgba(99, 102, 241, 0.08)', radius: 8 }}
              />
              <Bar
                dataKey="amount_paid"
                name="Amount Paid"
                radius={[16, 16, 8, 8]}
                maxBarSize={70}
                animationDuration={1500}
                animationEasing="ease-out"
              >
                {
                  (payment_history || []).map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={`url(#myAcctGrad${index})`}
                      filter="url(#myAcctShadow)"
                    />
                  ))
                }
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}

        {/* Panel B: your status (scoped) or contributions by type (overview) */}
        {scoped ? (
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          border: '1px solid #e5e7eb',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <h3 style={{ margin: '0 0 24px 0', fontSize: '1.125rem', fontWeight: '600', color: '#111827' }}>
            Your Status — {TAB_LABEL[tab]}
          </h3>
          {statusDonut.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={statusDonut}
                  dataKey="value"
                  nameKey="name"
                  cx="45%"
                  cy="50%"
                  innerRadius={75}
                  outerRadius={110}
                  paddingAngle={3}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {statusDonut.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 12, fontWeight: '500' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '320px', color: '#9ca3af', fontSize: '1rem' }}>
              No bills for this fund yet
            </div>
          )}
        </div>
        ) : (
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          border: '1px solid #e5e7eb',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <h3 style={{ margin: '0 0 24px 0', fontSize: '1.125rem', fontWeight: '600', color: '#111827' }}>
            Contributions by Type
          </h3>
          {contributions_by_type && contributions_by_type.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={contributions_by_type}
                  dataKey="total"
                  nameKey="type"
                  cx="45%"
                  cy="50%"
                  innerRadius={75}
                  outerRadius={110}
                  paddingAngle={3}
                >
                  {contributions_by_type.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 12, fontWeight: '500' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '320px', color: '#9ca3af', fontSize: '1rem' }}>
              No contribution data available
            </div>
          )}
        </div>
        )}
      </div>

      {/* Per-period bills table (scoped tabs) */}
      {scoped && occasions && occasions.length > 0 && (
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: '32px' }}>
        <div style={{ padding: '24px 28px', borderBottom: '1px solid #e5e7eb', background: 'linear-gradient(to right, #f9fafb, #ffffff)' }}>
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: '#111827' }}>
            {isOccasion ? `${TAB_LABEL[tab]} Activations` : 'Monthly Bills'}
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
            Your bill and payment status per {isOccasion ? 'activation' : 'month'}
          </p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: '14px 28px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>Period</th>
                <th style={{ padding: '14px 28px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>Billed</th>
                <th style={{ padding: '14px 28px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>Paid</th>
                <th style={{ padding: '14px 28px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>Outstanding</th>
                <th style={{ padding: '14px 28px', textAlign: 'center', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>Status</th>
                <th style={{ padding: '14px 28px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>Reference</th>
                <th style={{ padding: '14px 28px', textAlign: 'center', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {[...occasions].reverse().map((o) => {
                const pill = STATUS_PILL[o.status] || STATUS_PILL.pending;
                const hasOutstanding = o.outstanding > 0;
                return (
                  <tr key={o.period} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '14px 28px', fontSize: '0.95rem', fontWeight: '600', color: '#111827' }}>{o.label}</td>
                    <td style={{ padding: '14px 28px', textAlign: 'right', fontSize: '0.95rem', fontWeight: '600', color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{naira(o.due)}</td>
                    <td style={{ padding: '14px 28px', textAlign: 'right', fontSize: '0.95rem', fontWeight: '600', color: '#059669', fontVariantNumeric: 'tabular-nums' }}>{naira(o.paid)}</td>
                    <td style={{ padding: '14px 28px', textAlign: 'right', fontSize: '0.95rem', fontWeight: '600', color: hasOutstanding ? '#e11d48' : '#9ca3af', fontVariantNumeric: 'tabular-nums' }}>{naira(o.outstanding)}</td>
                    <td style={{ padding: '14px 28px', textAlign: 'center' }}>
                      <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '600', background: pill.bg, color: pill.color }}>{pill.label}</span>
                    </td>
                    <td style={{ padding: '14px 28px', fontSize: '0.9rem', color: '#4b5563' }}>{o.references || <span style={{ color: '#d1d5db' }}>—</span>}</td>
                    <td style={{ padding: '14px 28px', textAlign: 'center' }}>
                      {hasOutstanding ? (
                        <button
                          onClick={() => handlePayClick(o)}
                          style={{
                            padding: '6px 16px',
                            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '0.8rem',
                            boxShadow: '0 2px 4px rgba(99, 102, 241, 0.3)'
                          }}
                        >
                          Pay Now
                        </button>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Recent Payments Table */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ padding: '24px 28px', borderBottom: '1px solid #e5e7eb', background: 'linear-gradient(to right, #f9fafb, #ffffff)' }}>
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: '#111827' }}>
            Recent Payments
          </h3>
        </div>

        {recent_payments && recent_payments.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={{ padding: '16px 28px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>Date</th>
                  <th style={{ padding: '16px 28px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>Period</th>
                  <th style={{ padding: '16px 28px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>Type</th>
                  <th style={{ padding: '16px 28px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>Amount</th>
                  <th style={{ padding: '16px 28px', textAlign: 'center', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {recent_payments.map((payment, idx) => (
                  <tr key={payment.id} style={{ transition: 'background 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '16px 28px', fontSize: '0.9rem', color: '#6b7280', borderBottom: '1px solid #f3f4f6' }}>
                      {new Date(payment.payment_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '16px 28px', fontSize: '0.9rem', fontWeight: '500', color: '#111827', borderBottom: '1px solid #f3f4f6' }}>
                      {payment.period}
                    </td>
                    <td style={{ padding: '16px 28px', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        background: COLORS[idx % COLORS.length] + '15',
                        color: COLORS[idx % COLORS.length],
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: '600'
                      }}>
                        {payment.type}
                      </span>
                    </td>
                    <td style={{ padding: '16px 28px', textAlign: 'right', fontSize: '0.95rem', fontWeight: '700', color: '#059669', borderBottom: '1px solid #f3f4f6', fontVariantNumeric: 'tabular-nums' }}>
                      {naira(payment.amount)}
                    </td>
                    <td style={{ padding: '16px 28px', textAlign: 'center', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        background: payment.status === 'completed' ? '#dcfce7' : '#fef3c7',
                        color: payment.status === 'completed' ? '#166534' : '#92400e',
                        borderRadius: '12px',
                        fontSize: '0.8rem',
                        fontWeight: '600'
                      }}>
                        {payment.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#9ca3af' }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📭</div>
            <p style={{ fontSize: '1rem', fontWeight: '600', color: '#6b7280' }}>No payments recorded yet</p>
          </div>
        )}
      </div>

      {/* Payment Modal Overlay */}
      {showPayModal && selectedBill && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }} onClick={() => setShowPayModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'white', borderRadius: '16px', padding: '32px',
            width: '90%', maxWidth: '480px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ margin: '0 0 24px 0', fontSize: '1.5rem', fontWeight: '700', color: '#111827' }}>
              💳 Pay Outstanding Bill
            </h3>

            <div style={{ marginBottom: '24px', padding: '16px', background: '#f9fafb', borderRadius: '12px' }}>
              <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px' }}>Period</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#111827', marginBottom: '12px' }}>
                {selectedBill.label}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px' }}>Amount Due</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#e11d48' }}>
                ₦{selectedBill.outstanding?.toLocaleString()}
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                Email Address *
              </label>
              <input
                type="email"
                value={paymentEmail}
                onChange={(e) => setPaymentEmail(e.target.value)}
                placeholder="your@email.com"
                style={{
                  width: '100%', padding: '12px', border: '2px solid #e5e7eb',
                  borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box'
                }}
              />
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '6px' }}>
                Receipt will be sent to this email after successful payment
              </div>
            </div>

            {paymentError && (
              <div style={{
                marginBottom: '16px', padding: '12px', background: '#fee2e2',
                color: '#991b1b', borderRadius: '8px', fontSize: '0.875rem'
              }}>
                {paymentError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowPayModal(false)}
                style={{
                  padding: '12px 24px', background: '#f3f4f6', color: '#374151',
                  border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleInitializePayment}
                disabled={paymentLoading}
                style={{
                  padding: '12px 24px',
                  background: paymentLoading ? '#9ca3af' : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  color: 'white', border: 'none', borderRadius: '8px',
                  fontWeight: '600', cursor: paymentLoading ? 'not-allowed' : 'pointer',
                  boxShadow: paymentLoading ? 'none' : '0 4px 12px rgba(99, 102, 241, 0.3)'
                }}
              >
                {paymentLoading ? 'Processing...' : 'Proceed to Pay'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}