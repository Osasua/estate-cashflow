import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { naira } from '../format';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts';
import Skeleton from '../components/Skeleton';

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#64748b', '#84cc16', '#ec4899', '#14b8a6'];

const TABS = [
  { key: 'monthly', label: 'Monthly' },
  { key: 'float', label: 'Float' },
  { key: 'projects', label: 'Projects' },
  { key: 'end-of-year', label: 'End of Year' },
  { key: 'welfare', label: 'Welfare' },
];

function KPICard({ title, value, subtitle, color, icon }) {
  const colorMap = {
    indigo: { bg: '#eef2ff', text: '#4f46e5' },
    emerald: { bg: '#ecfdf5', text: '#059669' },
    rose: { bg: '#fff1f2', text: '#e11d48' },
    amber: { bg: '#fffbeb', text: '#d97706' },
  };
  const c = colorMap[color] || colorMap.indigo;

  return (
    <div style={{
      background: '#fff',
      borderRadius: '16px',
      padding: '24px',
      border: '1px solid #e5e7eb',
      borderLeft: `4px solid ${c.text}`,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      transition: 'all 0.3s ease'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>{icon}</div>
      </div>
      <div style={{ fontSize: '2.25rem', fontWeight: '700', color: '#111827', lineHeight: 1.1, marginBottom: '8px' }}>{value}</div>
      {subtitle && <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>{subtitle}</div>}
    </div>
  );
}

function ChartPanel({ title, subtitle, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: '#111827' }}>{title}</h3>
        {subtitle && <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>{subtitle}</p>}
      </div>
      <div style={{ minHeight: '300px' }}>{children}</div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('monthly');
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [monthBreakdown, setMonthBreakdown] = useState(null);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);

  useEffect(() => {
    api('/dashboard').then(setData).catch((e) => setError(e.message));
  }, []);

  const formatMonthName = (dateStr) => {
    if (!dateStr) return '';
    const [year, month] = dateStr.split('-');
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  };

  const handleRowClick = async (dateStr) => {
    if (selectedMonth === dateStr) {
      setSelectedMonth(null);
      setMonthBreakdown(null);
      return;
    }
    setSelectedMonth(dateStr);
    setLoadingBreakdown(true);
    setMonthBreakdown(null);

    try {
      const [year, month] = dateStr.split('-');
      const startDate = `${year}-${month}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${month}-${lastDay}`;
      const res = await api(`/dashboard/monthly-breakdown?startDate=${startDate}&endDate=${endDate}`);
      setMonthBreakdown(res);
    } catch (e) {
      console.error("Failed to load breakdown", e);
      setMonthBreakdown({ error: e.message });
    } finally {
      setLoadingBreakdown(false);
    }
  };

  if (error) return <div style={{ padding: '40px', color: '#ef4444', textAlign: 'center' }}><h2>Error Loading Dashboard</h2><p>{error}</p></div>;
  if (!data) return <div style={{ padding: '40px' }}><Skeleton height="40px" width="300px" style={{ marginBottom: '24px' }} /><div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>{[1,2,3,4].map(i => <Skeleton key={i} height="140px" width="100%" />)}</div></div>;

  const { cash_balance, total_expenses, kpis, trend, daily, weekly, categories } = data;
  const isMember = user?.role === 'member';
  
  // Get data for active tab
  const currentKpi = kpis[activeTab] || { due: 0, paid: 0, outstanding: 0, pending_count: 0 };
  const currentTrend = trend[activeTab] || [];
  const collectionRate = currentKpi.due > 0 ? ((currentKpi.paid / currentKpi.due) * 100).toFixed(1) : 0;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: 'white', padding: '14px 18px', border: '1px solid #e5e7eb', borderRadius: '10px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontSize: '0.875rem', minWidth: '180px' }}>
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
          {isMember ? `Welcome back, ${user?.name || 'Resident'}` : 'Financial Dashboard'}
        </h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '1.05rem' }}>
          Real-time overview of estate finances • {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Tabs - Mirroring Contributions */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '2px solid #e5e7eb', paddingBottom: '2px', flexWrap: 'wrap' }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setSelectedMonth(null); setMonthBreakdown(null); }}
            style={{
              padding: '10px 20px',
              background: activeTab === tab.key ? '#6366f1' : 'transparent',
              color: activeTab === tab.key ? 'white' : '#6b7280',
              border: 'none',
              borderBottom: activeTab === tab.key ? '3px solid #6366f1' : '3px solid transparent',
              fontWeight: activeTab === tab.key ? '600' : '500',
              cursor: 'pointer',
              borderRadius: '8px 8px 0 0',
              marginBottom: '-2px',
              transition: 'all 0.2s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* KPI Cards - Specific to active tab */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <KPICard
          title="Cash Balance"
          value={naira(cash_balance)}
          subtitle="Total available funds (all types)"
          color="indigo"
          icon="💰"
        />
        <KPICard
          title="Expected"
          value={naira(currentKpi.due)}
          subtitle={`${activeTab === 'monthly' ? 'Monthly' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} contributions due`}
          color="indigo"
          icon="📋"
        />
        <KPICard
          title="Collected"
          value={naira(currentKpi.paid)}
          subtitle={`${collectionRate}% of expected`}
          color="emerald"
          icon="📥"
        />
        <KPICard
          title="Outstanding"
          value={naira(currentKpi.outstanding)}
          subtitle={`${currentKpi.pending_count} household(s) owing`}
          color="rose"
          icon="⚠️"
        />
      </div>

      {/* Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        {/* Cash Flow Trend - For active type */}
        <ChartPanel title={`${TABS.find(t => t.key === activeTab).label} Contribution Trend`} subtitle="Last 6 months">
          {currentTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={currentTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="short_month" tick={{ fontSize: 12, fill: '#6b7280', fontWeight: '500' }} axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `₦${(v/1000).toFixed(0)}k` : `₦${v}`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '13px', fontWeight: '500' }} />
                <Area type="monotone" dataKey="income" name="Contributions" stroke="#22c55e" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" dot={{ r: 5, fill: '#22c55e', strokeWidth: 2, stroke: '#fff' }} />
                <Area type="monotone" dataKey="expense" name="Expenses" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorExpense)" dot={{ r: 5, fill: '#ef4444', strokeWidth: 2, stroke: '#fff' }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '320px', color: '#9ca3af' }}>
              No {TABS.find(t => t.key === activeTab).label} contribution data yet
            </div>
          )}
        </ChartPanel>

        {/* Spending by Category */}
        <ChartPanel title="Spending by Category" subtitle="This month's breakdown">
          {categories && categories.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie data={categories} dataKey="total" nameKey="name" cx="45%" cy="50%" innerRadius={75} outerRadius={110} paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {categories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 12, fontWeight: '500' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: '1rem' }}>No expenses recorded this month</div>
          )}
        </ChartPanel>

        {/* Daily Expenses */}
        <ChartPanel title="Daily Expenses" subtitle="Last 14 days">
          {daily && daily.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={daily} margin={{ top: 20, right: 20, left: 0, bottom: 40 }}>
                <defs>
                  <linearGradient id="dailyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity={1} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6b7280', fontWeight: '600' }} axisLine={false} tickLine={false} angle={-45} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: '600' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `₦${(v/1000).toFixed(0)}k` : `₦${v}`} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(6, 182, 212, 0.1)', radius: 8 }} />
                <Bar dataKey="total" fill="url(#dailyGradient)" radius={[10, 10, 4, 4]} maxBarSize={60} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '320px', color: '#9ca3af' }}>No daily expense data</div>
          )}
        </ChartPanel>

        {/* Weekly Expenses */}
        <ChartPanel title="Weekly Expenses" subtitle="Last 8 weeks">
          {weekly && weekly.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={weekly} margin={{ top: 20, right: 20, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#6b7280', fontWeight: '600' }} axisLine={false} tickLine={false} angle={-45} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: '600' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : `${v}`} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(34, 197, 94, 0.1)', radius: 8 }} />
                <Bar dataKey="total" fill="#22c55e" radius={[12, 12, 6, 6]} maxBarSize={70} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '320px', color: '#9ca3af' }}>No weekly expense data</div>
          )}
        </ChartPanel>

        {/* Payment History */}
        <ChartPanel title={`${TABS.find(t => t.key === activeTab).label} Payment History`} subtitle="Last 6 months">
          {currentTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={currentTrend} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
                <defs>
                  <linearGradient id="grad0" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={1} /><stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.8} /></linearGradient>
                  <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b5cf6" stopOpacity={1} /><stop offset="100%" stopColor="#a855f7" stopOpacity={0.8} /></linearGradient>
                  <linearGradient id="grad2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a855f7" stopOpacity={1} /><stop offset="100%" stopColor="#d946ef" stopOpacity={0.8} /></linearGradient>
                  <linearGradient id="grad3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d946ef" stopOpacity={1} /><stop offset="100%" stopColor="#ec4899" stopOpacity={0.8} /></linearGradient>
                  <linearGradient id="grad4" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ec4899" stopOpacity={1} /><stop offset="100%" stopColor="#f43f5e" stopOpacity={0.8} /></linearGradient>
                  <linearGradient id="grad5" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f43f5e" stopOpacity={1} /><stop offset="100%" stopColor="#ef4444" stopOpacity={0.8} /></linearGradient>
                  <filter id="barShadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#6366f1" floodOpacity="0.3"/></filter>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="short_month" tick={{ fontSize: 13, fill: '#6b7280', fontWeight: '700' }} axisLine={false} tickLine={false} interval={0} angle={-45} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 12, fill: '#9ca3af', fontWeight: '600' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : `${v}`} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.08)', radius: 8 }} />
                <Bar dataKey="income" name="Contributions" radius={[16, 16, 8, 8]} maxBarSize={70} animationDuration={1500} animationEasing="ease-out">
                  {currentTrend.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={`url(#grad${index % 6})`} filter="url(#barShadow)" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '320px', color: '#9ca3af' }}>No {TABS.find(t => t.key === activeTab).label} payment history</div>
          )}
        </ChartPanel>
      </div>

      {/* Monthly Summary Table */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ padding: '24px 28px', borderBottom: '1px solid #e5e7eb', background: 'linear-gradient(to right, #f9fafb, #ffffff)' }}>
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: '#111827' }}>{TABS.find(t => t.key === activeTab).label} Financial Summary</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>Click any month to view detailed expense breakdown</p>
        </div>

        {currentTrend.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={{ padding: '16px 28px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>Month</th>
                  <th style={{ padding: '16px 28px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#059669', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>Contributions</th>
                  <th style={{ padding: '16px 28px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#e11d48', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>Expenses</th>
                  <th style={{ padding: '16px 28px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>Net Flow</th>
                </tr>
              </thead>
              <tbody>
                {currentTrend.map((row) => {
                  const isSelected = selectedMonth === row.month;
                  const netColor = row.net >= 0 ? '#059669' : '#e11d48';
                  const netBg = row.net >= 0 ? '#ecfdf5' : '#fff1f2';
                  return (
                    <React.Fragment key={row.month}>
                      <tr
                        onClick={() => handleRowClick(row.month)}
                        style={{ cursor: 'pointer', background: isSelected ? '#f0fdf4' : 'transparent', transition: 'background 0.2s ease' }}
                        onMouseEnter={(e) => !isSelected && (e.currentTarget.style.background = '#f9fafb')}
                        onMouseLeave={(e) => !isSelected && (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '16px 28px', fontSize: '0.95rem', fontWeight: isSelected ? '600' : '500', color: '#111827', borderBottom: '1px solid #f3f4f6' }}>{formatMonthName(row.month)}</td>
                        <td style={{ padding: '16px 28px', textAlign: 'right', fontSize: '0.95rem', fontWeight: '600', color: '#059669', borderBottom: '1px solid #f3f4f6', fontVariantNumeric: 'tabular-nums' }}>{naira(row.income)}</td>
                        <td style={{ padding: '16px 28px', textAlign: 'right', fontSize: '0.95rem', fontWeight: '600', color: '#e11d48', borderBottom: '1px solid #f3f4f6', fontVariantNumeric: 'tabular-nums' }}>{naira(row.expense)}</td>
                        <td style={{ padding: '16px 28px', textAlign: 'right', borderBottom: '1px solid #f3f4f6' }}>
                          <span style={{ display: 'inline-block', padding: '6px 14px', background: netBg, color: netColor, borderRadius: '8px', fontSize: '0.9rem', fontWeight: '700', fontVariantNumeric: 'tabular-nums' }}>{row.net >= 0 ? '+' : ''}{naira(row.net)}</span>
                        </td>
                      </tr>
                      {isSelected && (
                        <tr>
                          <td colSpan="4" style={{ padding: '0', background: '#f0fdf4' }}>
                            <div style={{ padding: '24px' }}>
                              {loadingBreakdown ? (
                                <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>Loading breakdown...</div>
                              ) : monthBreakdown?.error ? (
                                <div style={{ textAlign: 'center', padding: '20px', color: '#ef4444' }}>Error: {monthBreakdown.error}</div>
                              ) : monthBreakdown?.expense_breakdown && monthBreakdown.expense_breakdown.length > 0 ? (
                                <div>
                                  <h4 style={{ marginBottom: '16px', fontSize: '1rem', fontWeight: '600', color: '#111827' }}>Expense Breakdown — {formatMonthName(row.month)}</h4>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                                    {monthBreakdown.expense_breakdown.map((item, i) => {
                                      const percentage = row.expense > 0 ? ((item.total / row.expense) * 100).toFixed(1) : 0;
                                      return (
                                        <div key={i} style={{ background: '#fff', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                                          <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '6px', fontWeight: '500' }}>{item.name}</div>
                                          <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#111827', marginBottom: '4px' }}>{naira(item.total)}</div>
                                          <div style={{ display: 'inline-block', padding: '3px 10px', background: '#f3f4f6', color: '#6b7280', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600' }}>{percentage}% of total</div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : (
                                <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af' }}>
                                  <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📊</div>
                                  <p style={{ fontSize: '0.95rem', fontWeight: '500' }}>No expenses recorded for {formatMonthName(row.month)}</p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '80px 20px', textAlign: 'center', color: '#9ca3af' }}>
            <div style={{ fontSize: '4rem', marginBottom: '16px' }}>📊</div>
            <p style={{ fontSize: '1.1rem', fontWeight: '600', color: '#6b7280' }}>No {TABS.find(t => t.key === activeTab).label} data yet</p>
            <p style={{ fontSize: '0.9rem' }}>Data will appear once {activeTab} contributions are recorded</p>
          </div>
        )}
      </div>
    </div>
  );
}