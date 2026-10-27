import React, { useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts';
import { api } from '../../api';
import { naira } from '../../format';
import {
  COLORS, formatMonthName, contributionStatus, StatusPill,
  KPICard, ChartPanel, CustomTooltip, kFormatter,
} from './shared';

const th = (align) => ({
  padding: '16px 28px',
  textAlign: align,
  fontSize: '0.75rem',
  fontWeight: '600',
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  borderBottom: '1px solid #e5e7eb',
});

const td = (align) => ({
  padding: '16px 28px',
  textAlign: align,
  fontSize: '0.95rem',
  fontWeight: '600',
  borderBottom: '1px solid #f3f4f6',
  fontVariantNumeric: 'tabular-nums',
});

/**
 * Per-contribution-type dashboard tab (Monthly / Float / Projects /
 * End of Year / Welfare).
 *
 * Data contract (GET /dashboard?type=<t>):
 *  - kpis.month_in / month_due / pending_count  -> scoped to the type
 *  - kpis.month_expense                          -> scoped to the type
 *  - kpis.type_all_time_collected                -> all-time collected for type
 *    (falls back to the visible 6-month window if the backend predates it)
 *  - trend rows: { month, short_month, income, due, outstanding } (type-scoped)
 *  - daily / weekly / categories                 -> scoped to the type
 */
export default function TypeDashboard({ data, typeKey, typeLabel }) {
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [rows, setRows] = useState(null);
  const [loadingRows, setLoadingRows] = useState(false);

  const { kpis, daily, weekly, categories, trend } = data;
  const collectionRate = kpis.month_due > 0 ? ((kpis.month_in / kpis.month_due) * 100).toFixed(1) : 0;
  const hasAllTime = kpis.type_all_time_collected != null;
  const allTimeCollected = hasAllTime
    ? kpis.type_all_time_collected
    : (trend || []).reduce((s, r) => s + (Number(r.income) || 0), 0);

  const handleRowClick = async (dateStr) => {
    if (selectedMonth === dateStr) {
      setSelectedMonth(null);
      setRows(null);
      return;
    }
    setSelectedMonth(dateStr);
    setLoadingRows(true);
    setRows(null);
    try {
      const [year, month] = dateStr.split('-');
      const res = await api(`/contributions?month=${parseInt(month, 10)}&year=${year}&type=${encodeURIComponent(typeKey)}`);
      setRows(res.contributions || []);
    } catch (e) {
      console.error('Failed to load households', e);
      setRows({ error: e.message });
    } finally {
      setLoadingRows(false);
    }
  };

  return (
    <>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <KPICard
          title={`Total Collected — ${typeLabel}`}
          value={naira(allTimeCollected)}
          subtitle={hasAllTime ? 'All-time contributions' : 'Last 6 months'}
          color="indigo"
          icon="💰"
        />
        <KPICard
          title="Collected This Month"
          value={naira(kpis.month_in)}
          subtitle={`${collectionRate}% of ${naira(kpis.month_due)} expected`}
          color="emerald"
          icon="📥"
        />
        <KPICard
          title="Spent This Month"
          value={naira(kpis.month_expense)}
          subtitle={`Total ${typeLabel.toLowerCase()} expenses`}
          color="rose"
          icon="📤"
        />
        <KPICard
          title="Households Owing"
          value={kpis.pending_count}
          subtitle={`Behind on ${typeLabel} payments`}
          color="amber"
          icon="⚠️"
        />
      </div>

      {/* Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        {/* Collection Trend (type-scoped, single series) */}
        <ChartPanel title="Collection Trend" subtitle={`Last 6 months · ${typeLabel}`}>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={trend || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`typeIncome-${typeKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis
                dataKey="short_month"
                tick={{ fontSize: 12, fill: '#6b7280', fontWeight: '500' }}
                axisLine={false}
                tickLine={false}
                interval={0}
              />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={kFormatter} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '13px', fontWeight: '500' }} />
              <Area
                type="monotone"
                dataKey="income"
                name={`${typeLabel} collections`}
                stroke="#22c55e"
                strokeWidth={3}
                fillOpacity={1}
                fill={`url(#typeIncome-${typeKey})`}
                dot={{ r: 5, fill: '#22c55e', strokeWidth: 2, stroke: '#fff' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartPanel>

        {/* Spending by Category — estate-wide */}
        <ChartPanel title="Spending by Category" subtitle={`This month's ${typeLabel.toLowerCase()} breakdown`}>
          {categories && categories.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={categories}
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
                  {categories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 12, fontWeight: '500' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: '1rem' }}>
              No expenses recorded this month
            </div>
          )}
        </ChartPanel>

        {/* Daily Expenses — estate-wide */}
        <ChartPanel title="Daily Expenses" subtitle={`Last 14 days · ${typeLabel} fund`}>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={daily || []} margin={{ top: 20, right: 20, left: 0, bottom: 40 }}>
              <defs>
                <linearGradient id="dailyGradientType" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={1} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: '#6b7280', fontWeight: '600' }}
                axisLine={false}
                tickLine={false}
                angle={-45}
                textAnchor="end"
                height={50}
              />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: '600' }} axisLine={false} tickLine={false} tickFormatter={kFormatter} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(6, 182, 212, 0.1)', radius: 8 }} />
              <Bar dataKey="total" fill="url(#dailyGradientType)" radius={[10, 10, 4, 4]} maxBarSize={60} animationDuration={1200} animationEasing="ease-out" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        {/* Weekly Expenses — estate-wide */}
        <ChartPanel title="Weekly Expenses" subtitle={`Last 8 weeks · ${typeLabel} fund`}>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={weekly || []} margin={{ top: 20, right: 20, left: 0, bottom: 40 }}>
              <defs>
                <linearGradient id="weeklyGradientType" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={1} />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.9} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 11, fill: '#6b7280', fontWeight: '600' }}
                axisLine={false}
                tickLine={false}
                angle={-45}
                textAnchor="end"
                height={50}
              />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: '600' }} axisLine={false} tickLine={false} tickFormatter={kFormatter} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(34, 197, 94, 0.1)', radius: 8 }} />
              <Bar dataKey="total" fill="url(#weeklyGradientType)" radius={[12, 12, 6, 6]} maxBarSize={70} animationDuration={1500} animationEasing="ease-out" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        {/* Payment History (type-scoped) */}
        <ChartPanel title="Payment History (Last 6 Months)" subtitle={`${typeLabel} collections`}>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={trend || []} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
              <defs>
                <linearGradient id="typeGrad0" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={1} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.8} />
                </linearGradient>
                <linearGradient id="typeGrad1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={1} />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity={0.8} />
                </linearGradient>
                <linearGradient id="typeGrad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity={1} />
                  <stop offset="100%" stopColor="#d946ef" stopOpacity={0.8} />
                </linearGradient>
                <linearGradient id="typeGrad3" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d946ef" stopOpacity={1} />
                  <stop offset="100%" stopColor="#ec4899" stopOpacity={0.8} />
                </linearGradient>
                <linearGradient id="typeGrad4" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ec4899" stopOpacity={1} />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.8} />
                </linearGradient>
                <linearGradient id="typeGrad5" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity={1} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.8} />
                </linearGradient>
                <filter id="typeBarShadow" x="-50%" y="-50%" width="200%" height="200%">
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
              <YAxis tick={{ fontSize: 12, fill: '#9ca3af', fontWeight: '600' }} axisLine={false} tickLine={false} tickFormatter={kFormatter} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.08)', radius: 8 }} />
              <Bar dataKey="income" name={`${typeLabel} collections`} radius={[16, 16, 8, 8]} maxBarSize={70} animationDuration={1500} animationEasing="ease-out">
                {
                  (trend || []).map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={`url(#typeGrad${index % 6})`}
                      filter="url(#typeBarShadow)"
                    />
                  ))
                }
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>

      {/* Contribution Summary Table (type-scoped) */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ padding: '24px 28px', borderBottom: '1px solid #e5e7eb', background: 'linear-gradient(to right, #f9fafb, #ffffff)' }}>
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: '#111827' }}>
            {typeLabel} Contribution Summary
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>Click any month to view household payment status</p>
        </div>

        {trend && trend.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={th('left')}>Month</th>
                  <th style={th('right')}>Expected</th>
                  <th style={th('right')}>Collected</th>
                  <th style={th('right')}>Outstanding</th>
                  <th style={th('right')}>Collection %</th>
                </tr>
              </thead>
              <tbody>
                {trend.map((row) => {
                  const isSelected = selectedMonth === row.month;
                  const due = Number(row.due) || 0;
                  const collected = Number(row.income) || 0;
                  const outstanding = row.outstanding != null ? Number(row.outstanding) : due - collected;
                  const rate = due > 0 ? ((collected / due) * 100).toFixed(1) : null;
                  const rateColor = rate === null ? '#9ca3af' : parseFloat(rate) >= 100 ? '#059669' : parseFloat(rate) >= 50 ? '#d97706' : '#e11d48';
                  const rateBg = rate === null ? '#f3f4f6' : parseFloat(rate) >= 100 ? '#ecfdf5' : parseFloat(rate) >= 50 ? '#fffbeb' : '#fff1f2';
                  return (
                    <React.Fragment key={row.month}>
                      <tr
                        onClick={() => handleRowClick(row.month)}
                        style={{
                          cursor: 'pointer',
                          background: isSelected ? '#f0fdf4' : 'transparent',
                          transition: 'background 0.2s ease'
                        }}
                        onMouseEnter={(e) => !isSelected && (e.currentTarget.style.background = '#f9fafb')}
                        onMouseLeave={(e) => !isSelected && (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ ...td('left'), color: '#111827', fontWeight: isSelected ? '600' : '500' }}>
                          {formatMonthName(row.month)}
                        </td>
                        <td style={{ ...td('right'), color: '#111827' }}>{naira(due)}</td>
                        <td style={{ ...td('right'), color: '#059669' }}>{naira(collected)}</td>
                        <td style={{ ...td('right'), color: outstanding > 0 ? '#e11d48' : '#9ca3af' }}>{naira(outstanding)}</td>
                        <td style={{ ...td('right'), textAlign: 'right' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '6px 14px',
                            background: rateBg,
                            color: rateColor,
                            borderRadius: '8px',
                            fontSize: '0.9rem',
                            fontWeight: '700',
                            fontVariantNumeric: 'tabular-nums'
                          }}>
                            {rate === null ? '—' : `${rate}%`}
                          </span>
                        </td>
                      </tr>

                      {isSelected && (
                        <tr>
                          <td colSpan="5" style={{ padding: '0', background: '#f0fdf4' }}>
                            <div style={{ padding: '24px' }}>
                              {loadingRows ? (
                                <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>Loading households...</div>
                              ) : rows?.error ? (
                                <div style={{ textAlign: 'center', padding: '20px', color: '#ef4444' }}>Error loading households: {rows.error}</div>
                              ) : rows && rows.length > 0 ? (
                                <div>
                                  <h4 style={{ marginBottom: '16px', fontSize: '1rem', fontWeight: '600', color: '#111827' }}>
                                    Households — {formatMonthName(row.month)} · {typeLabel}
                                  </h4>
                                  <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                      <thead>
                                        <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                                          <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.72rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>House</th>
                                          <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.72rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Household</th>
                                          <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '0.72rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Due</th>
                                          <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '0.72rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Paid</th>
                                          <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: '0.72rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                                          <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.72rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reference</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {rows.map((c) => (
                                          <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                            <td style={{ padding: '10px 16px', fontWeight: '600', color: '#111827' }}>{c.house_number}</td>
                                            <td style={{ padding: '10px 16px', color: '#111827' }}>{c.household_name}</td>
                                            <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '600', color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{naira(parseFloat(c.amount_due) || 0)}</td>
                                            <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '600', color: '#059669', fontVariantNumeric: 'tabular-nums' }}>{naira(parseFloat(c.amount_paid) || 0)}</td>
                                            <td style={{ padding: '10px 16px', textAlign: 'center' }}><StatusPill status={contributionStatus(c)} /></td>
                                            <td style={{ padding: '10px 16px', fontSize: '0.9rem', color: '#4b5563' }}>{c.references || <span style={{ color: '#d1d5db' }}>—</span>}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af' }}>
                                  <div style={{ fontSize: '2rem', marginBottom: '8px' }}>💰</div>
                                  <p style={{ fontSize: '0.95rem', fontWeight: '500' }}>No {typeLabel} contributions for {formatMonthName(row.month)}</p>
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
            <div style={{ fontSize: '4rem', marginBottom: '16px' }}>💰</div>
            <p style={{ fontSize: '1.1rem', fontWeight: '600', color: '#6b7280' }}>No {typeLabel} contribution data yet</p>
            <p style={{ fontSize: '0.9rem' }}>Data will appear here once {typeLabel.toLowerCase()} contributions are recorded</p>
          </div>
        )}
      </div>
    </>
  );
}
