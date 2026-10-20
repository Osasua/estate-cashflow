import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { naira } from '../format';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area,
} from 'recharts';
import Skeleton from '../components/Skeleton';

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#64748b', '#84cc16', '#ec4899', '#14b8a6'];

function KPICard({ title, value, subtitle, color, icon }) {
  const colorMap = {
    indigo: { bg: '#eef2ff', text: '#4f46e5', border: '#c7d2fe' },
    emerald: { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' },
    rose: { bg: '#fff1f2', text: '#e11d48', border: '#fecdd3' },
    violet: { bg: '#f5f3ff', text: '#7c3aed', border: '#ddd6fe' },
  };
  const c = colorMap[color] || colorMap.indigo;

  return (
    <div style={{
      background: '#fff',
      borderRadius: '16px',
      padding: '24px',
      border: '1px solid #e5e7eb',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '120px',
        height: '120px',
        background: `radial-gradient(circle at top right, ${c.bg} 0%, transparent 70%)`,
        opacity: 0.6
      }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: c.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.25rem'
          }}>{icon}</div>
        </div>
        <div style={{ fontSize: '2.25rem', fontWeight: '700', color: '#111827', lineHeight: 1.1, marginBottom: '8px' }}>{value}</div>
        {subtitle && <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>{subtitle}</div>}
      </div>
    </div>
  );
}

function ChartPanel({ title, subtitle, children, action }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: '16px',
      border: '1px solid #e5e7eb',
      padding: '24px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: '#111827' }}>{title}</h3>
          {subtitle && <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>{subtitle}</p>}
        </div>
        {action}
      </div>
      <div style={{ minHeight: '300px' }}>{children}</div>
    </div>
  );
}

export default function Reports() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  useEffect(() => {
    // Set default dates to current month
    const now = new Date();
    const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const lastDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`;
    setStartDate(firstDay);
    setEndDate(lastDay);
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      loadData();
    }
  }, [startDate, endDate, selectedCategory]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ startDate, endDate });
      if (selectedCategory) params.append('category_id', selectedCategory);
      const res = await api(`/reports/summary?${params.toString()}`);
      setData(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
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

  if (error) return <div style={{ padding: '40px', color: '#ef4444', textAlign: 'center' }}><h2>Error</h2><p>{error}</p></div>;
  if (loading || !data) return <div style={{ padding: '40px' }}><Skeleton height="40px" width="300px" style={{ marginBottom: '24px' }} /><div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>{[1,2,3,4].map(i => <Skeleton key={i} height="140px" width="100%" />)}</div></div>;

  const { kpis, expense_breakdown, daily_trend, top_expenses, categories, filters } = data;

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '2rem', fontWeight: '700', color: '#111827', letterSpacing: '-0.02em' }}>
          Reports & Analytics
        </h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '1.05rem' }}>
          Comprehensive financial insights and expense tracking
        </p>
      </div>

      {/* Filters */}
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        border: '1px solid #e5e7eb',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.9rem' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.9rem' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Category Filter</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.9rem' }}
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <KPICard
          title="Opening Balance"
          value={naira(kpis.opening_balance)}
          subtitle={`As of ${filters.start_date}`}
          color="indigo"
          icon="💼"
        />
        <KPICard
          title="Total Received"
          value={naira(kpis.total_received)}
          subtitle="Contributions collected"
          color="emerald"
          icon=""
        />
        <KPICard
          title="Total Expenses"
          value={naira(kpis.total_expenses)}
          subtitle={`${expense_breakdown.length} categories`}
          color="rose"
          icon="📤"
        />
        <KPICard
          title="Closing Balance"
          value={naira(kpis.closing_balance)}
          subtitle={`As of ${filters.end_date}`}
          color="violet"
          icon="💰"
        />
      </div>

      {/* Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        {/* Expense Breakdown Pie Chart */}
        <ChartPanel title="Expense Breakdown" subtitle="By category">
          {expense_breakdown && expense_breakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={expense_breakdown}
                  dataKey="total"
                  nameKey="name"
                  cx="45%"
                  cy="50%"
                  innerRadius={75}
                  outerRadius={110}
                  paddingAngle={3}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {expense_breakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 12, fontWeight: '500' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: '1rem' }}>
              No expenses in selected period
            </div>
          )}
        </ChartPanel>

        {/* Daily Expense Trend */}
        <ChartPanel title="Daily Expense Trend" subtitle="Spending over time">
          {daily_trend && daily_trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={daily_trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6b7280', fontWeight: '500' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `₦${(v/1000).toFixed(0)}k` : `₦${v}`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="total" name="Expenses" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorExpense)" dot={{ r: 5, fill: '#ef4444', strokeWidth: 2, stroke: '#fff' }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: '1rem' }}>
              No daily data available
            </div>
          )}
        </ChartPanel>
      </div>

      {/* Top Expenses Table */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ padding: '24px 28px', borderBottom: '1px solid #e5e7eb', background: 'linear-gradient(to right, #f9fafb, #ffffff)' }}>
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: '#111827' }}>
            Top Expenses
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>Largest transactions in selected period</p>
        </div>

        {top_expenses && top_expenses.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={{ padding: '16px 28px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>Date</th>
                  <th style={{ padding: '16px 28px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>Description</th>
                  <th style={{ padding: '16px 28px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>Category</th>
                  <th style={{ padding: '16px 28px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>Vendor</th>
                  <th style={{ padding: '16px 28px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {top_expenses.map((expense, idx) => (
                  <tr key={expense.id} style={{ transition: 'background 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '16px 28px', fontSize: '0.9rem', color: '#6b7280', borderBottom: '1px solid #f3f4f6', fontVariantNumeric: 'tabular-nums' }}>
                      {new Date(expense.spent_on).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '16px 28px', fontSize: '0.9rem', fontWeight: '500', color: '#111827', borderBottom: '1px solid #f3f4f6' }}>
                      {expense.description}
                    </td>
                    <td style={{ padding: '16px 28px', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        background: COLORS[idx % COLORS.length] + '20',
                        color: COLORS[idx % COLORS.length],
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: '600'
                      }}>
                        {expense.category_name || 'Uncategorized'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 28px', fontSize: '0.9rem', color: '#6b7280', borderBottom: '1px solid #f3f4f6' }}>
                      {expense.vendor || '—'}
                    </td>
                    <td style={{ padding: '16px 28px', textAlign: 'right', fontSize: '0.95rem', fontWeight: '700', color: '#ef4444', borderBottom: '1px solid #f3f4f6', fontVariantNumeric: 'tabular-nums' }}>
                      {naira(expense.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '80px 20px', textAlign: 'center', color: '#9ca3af' }}>
            <div style={{ fontSize: '4rem', marginBottom: '16px' }}>📊</div>
            <p style={{ fontSize: '1.1rem', fontWeight: '600', color: '#6b7280' }}>No expenses found</p>
            <p style={{ fontSize: '0.9rem' }}>Try adjusting your date range or category filter</p>
          </div>
        )}
      </div>
    </div>
  );
}