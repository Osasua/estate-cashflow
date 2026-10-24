import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { naira } from '../format';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import Skeleton from '../components/Skeleton';

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#64748b', '#84cc16', '#ec4899', '#14b8a6'];

export default function MyAccount() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState('this_month');

  useEffect(() => {
    loadData();
  }, [viewing]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api(`/my-account?viewing=${viewing}`);
      setData(res);
    } catch (err) {
      console.error('Failed to load account data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) {
    return (
      <div style={{ padding: '40px' }}>
        <Skeleton height="40px" width="300px" style={{ marginBottom: '24px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          {[1, 2, 3].map(i => <Skeleton key={i} height="120px" width="100%" />)}
        </div>
      </div>
    );
  }

  const { summary, payment_history, contributions_by_type, recent_payments } = data;

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

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '2rem', fontWeight: '700', color: '#111827', letterSpacing: '-0.02em' }}>
          My Account — {user?.household_name || 'Resident'}
        </h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '1.05rem' }}>
          View your contribution history and account status
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '24px', marginBottom: '24px', borderBottom: '2px solid #e5e7eb' }}>
        <button style={{
          padding: '12px 24px',
          background: 'transparent',
          border: 'none',
          borderBottom: '3px solid #6366f1',
          color: '#6366f1',
          fontWeight: '600',
          fontSize: '1rem',
          cursor: 'pointer'
        }}>
          Account Summary
        </button>
        <button style={{
          padding: '12px 24px',
          background: 'transparent',
          border: 'none',
          borderBottom: '3px solid transparent',
          color: '#6b7280',
          fontWeight: '500',
          fontSize: '1rem',
          cursor: 'pointer'
        }}>
          Contribution History
        </button>
      </div>

      {/* Viewing Filter */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{ fontSize: '0.9rem', fontWeight: '600', color: '#374151', marginRight: '12px' }}>Viewing:</label>
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
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '8px', fontWeight: '500' }}>Total Due</div>
          <div style={{ fontSize: '2.25rem', fontWeight: '700', color: '#111827' }}>{naira(summary.total_due)}</div>
        </div>
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid #e5e7eb',
          borderLeft: '4px solid #22c55e',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '8px', fontWeight: '500' }}>Total Paid</div>
          <div style={{ fontSize: '2.25rem', fontWeight: '700', color: '#111827' }}>{naira(summary.total_paid)}</div>
        </div>
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid #e5e7eb',
          borderLeft: '4px solid #ef4444',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '8px', fontWeight: '500' }}>Outstanding Balance</div>
          <div style={{ fontSize: '2.25rem', fontWeight: '700', color: '#111827' }}>{naira(summary.outstanding)}</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        {/* Payment History - ENHANCED */}
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

        {/* Contributions by Type - ENHANCED */}
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
                  label={({ type, percent }) => `${type} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
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
      </div>

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
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}></div>
            <p style={{ fontSize: '1rem', fontWeight: '600', color: '#6b7280' }}>No payments recorded yet</p>
          </div>
        )}
      </div>
    </div>
  );
}