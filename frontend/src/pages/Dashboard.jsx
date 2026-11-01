import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';

const FUND_TYPES = [
  { value: 'monthly', label: 'Monthly', color: '#6366f1' },
  { value: 'float', label: 'Float', color: '#22c55e' },
  { value: 'projects', label: 'Projects', color: '#f59e0b' },
  { value: 'end-of-year', label: 'End of Year', color: '#ef4444' },
  { value: 'welfare', label: 'Welfare', color: '#06b6d4' }
];

const CHART_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#ec4899', '#14b8a6'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function Dashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('Overview');
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState({});
  const [selectedActivation, setSelectedActivation] = useState(null);

  const now = new Date();
  const currentYear = now.getFullYear();

  useEffect(() => {
    loadDashboardData();
  }, [activeTab]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Load report data for all fund types (includes opening balance, expenses, etc.)
      const reportPromises = FUND_TYPES.map(async (fund) => {
        const res = await api(`/reports/summary?startDate=${currentYear}-01-01&endDate=${currentYear}-12-31&type=${fund.value}`);
        return { type: fund.value, ...res };
      });
      const reports = await Promise.all(reportPromises);
      const reportMap = {};
      reports.forEach(r => { reportMap[r.type] = r; });

      // Load contribution activations for each fund type
      const activationPromises = FUND_TYPES.map(async (fund) => {
        try {
          const res = await api(`/contributions?type=${fund.value}&year=${currentYear}`);
          return { type: fund.value, activations: res.contributions || [] };
        } catch (e) {
          return { type: fund.value, activations: [] };
        }
      });
      const activations = await Promise.all(activationPromises);
      const activationMap = {};
      activations.forEach(a => { activationMap[a.type] = a.activations; });

      setDashboardData({ reports: reportMap, activations: activationMap });
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => `₦${Number(amount).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatCompact = (amount) => {
    if (amount >= 1000000) return `₦${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `₦${(amount / 1000).toFixed(0)}k`;
    return `₦${amount}`;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: '#fff', padding: '12px', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: '600', color: '#111827' }}>{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ margin: '4px 0', color: entry.color, fontSize: '0.9rem' }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" style={{ fontSize: '12px', fontWeight: '600' }}>
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  // Overview Tab
  const renderOverviewTab = () => {
    const overviewData = FUND_TYPES.map(fund => {
      const report = dashboardData.reports?.[fund.value];
      return {
        name: fund.label,
        opening: report?.kpis?.opening_balance || 0,
        received: report?.kpis?.total_received || 0,
        expenses: report?.kpis?.total_expenses || 0,
        closing: report?.kpis?.closing_balance || 0
      };
    });

    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '32px' }}>
          {FUND_TYPES.map((fund) => {
            const report = dashboardData.reports?.[fund.value];
            const kpis = report?.kpis || { opening_balance: 0, total_received: 0, total_expenses: 0, closing_balance: 0 };
            return (
              <div key={fund.value} style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: `2px solid ${fund.color}20`, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: fund.color }} />
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600', color: '#111827' }}>{fund.label} Fund</h3>
                </div>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>Opening:</span>
                    <span style={{ fontWeight: '600', color: kpis.opening_balance >= 0 ? '#22c55e' : '#ef4444' }}>{formatCurrency(kpis.opening_balance)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>Received:</span>
                    <span style={{ fontWeight: '600', color: '#22c55e' }}>{formatCurrency(kpis.total_received)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>Expenses:</span>
                    <span style={{ fontWeight: '600', color: '#ef4444' }}>{formatCurrency(kpis.total_expenses)}</span>
                  </div>
                  <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '12px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>Closing:</span>
                    <span style={{ fontWeight: '700', fontSize: '1.1rem', color: kpis.closing_balance >= 0 ? '#6366f1' : '#ef4444' }}>{formatCurrency(kpis.closing_balance)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '1.25rem', fontWeight: '600', color: '#111827' }}>Financial Overview by Fund Type</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={overviewData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(v) => formatCompact(v)} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="opening" name="Opening Balance" fill="#6366f1" />
              <Bar dataKey="received" name="Total Received" fill="#22c55e" />
              <Bar dataKey="expenses" name="Total Expenses" fill="#ef4444" />
              <Bar dataKey="closing" name="Closing Balance" fill="#a855f7" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  // Fund-specific Tab (Monthly, Float, Projects, etc.)
  const renderFundTab = () => {
    const fundConfig = FUND_TYPES.find(f => f.label.toLowerCase() === activeTab.toLowerCase());
    const fundType = fundConfig?.value || 'monthly';
    const report = dashboardData.reports?.[fundType];
    const activations = dashboardData.activations?.[fundType] || [];
    const kpis = report?.kpis || { opening_balance: 0, total_received: 0, total_expenses: 0, closing_balance: 0 };
    const expenseBreakdown = report?.expense_breakdown || [];
    const dailyTrend = report?.daily_trend || [];

    // Calculate activation metrics
    const totalExpected = activations.reduce((sum, c) => sum + (parseFloat(c.amount_due) || 0), 0);
    const totalCollected = activations.reduce((sum, c) => sum + (parseFloat(c.amount_paid) || 0), 0);
    const householdsOwing = activations.filter(c => (parseFloat(c.amount_paid) || 0) < (parseFloat(c.amount_due) || 0)).length;
    const collectionRate = totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0;

    // Get latest activation
    const latestActivation = activations.length > 0 ? activations[0] : null;
    const latestActivationLabel = latestActivation 
      ? `${MONTHS[latestActivation.period_month - 1]} ${latestActivation.period_year}` 
      : 'N/A';

    // Group activations by period for chart
    const activationGroups = {};
    activations.forEach(a => {
      const key = `${MONTHS[a.period_month - 1]} ${a.period_year}`;
      if (!activationGroups[key]) activationGroups[key] = { period: key, expected: 0, collected: 0 };
      activationGroups[key].expected += parseFloat(a.amount_due) || 0;
      activationGroups[key].collected += parseFloat(a.amount_paid) || 0;
    });
    const collectionsPerActivation = Object.values(activationGroups);

    // Household status for latest activation
    const paidCount = activations.filter(c => {
      const paid = parseFloat(c.amount_paid) || 0;
      const due = parseFloat(c.amount_due) || 0;
      return due > 0 && paid >= due;
    }).length;
    const pendingCount = activations.length - paidCount;
    const householdStatusData = [
      { name: 'Paid', value: paidCount, color: '#22c55e' },
      { name: 'Pending', value: pendingCount, color: '#ef4444' }
    ];

    // === FLOAT-SPECIFIC LAYOUT ===
    if (fundType === 'float') {
      return (
        <div>
          {/* Float KPI Cards - 4 cards as requested */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '32px' }}>
            {/* Opening Balance */}
            <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '2px solid #6366f120', borderLeft: `4px solid #6366f1` }}>
              <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>💰</span> OPENING BALANCE
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: '700', color: kpis.opening_balance >= 0 ? '#4f46e5' : '#ef4444' }}>
                {formatCurrency(kpis.opening_balance)}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '4px' }}>From previous period</div>
            </div>

            {/* Total Raised — Float (RETAINED) */}
            <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '2px solid #22c55e20', borderLeft: '4px solid #22c55e' }}>
              <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>💵</span> TOTAL RAISED — FLOAT
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#059669' }}>
                {formatCurrency(kpis.total_received)}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '4px' }}>
                {activations.length} activation{activations.length !== 1 ? 's' : ''} · all-time
              </div>
            </div>

            {/* Latest Activation (RETAINED) */}
            <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '2px solid #f59e0b20', borderLeft: '4px solid #f59e0b' }}>
              <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>📅</span> LATEST ACTIVATION
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#111827' }}>
                {latestActivationLabel}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '4px' }}>
                {formatCurrency(totalCollected)} of {formatCurrency(totalExpected)} collected
              </div>
            </div>

            {/* Float Expenses (NEW) */}
            <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '2px solid #ef444420', borderLeft: '4px solid #ef4444' }}>
              <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>📤</span> FLOAT EXPENSES
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#e11d48' }}>
                {formatCurrency(kpis.total_expenses)}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '4px' }}>
                {expenseBreakdown.length} categor{expenseBreakdown.length !== 1 ? 'ies' : 'y'}
              </div>
            </div>
          </div>

          {/* Float Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Expense Breakdown - Donut Chart */}
            <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: '600', color: '#111827' }}>Expense Breakdown</h3>
              <p style={{ margin: '0 0 24px 0', color: '#6b7280', fontSize: '0.9rem' }}>Distribution by category</p>
              {expenseBreakdown.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📊</div>
                  No expenses recorded
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                  <ResponsiveContainer width="50%" height={300}>
                    <PieChart>
                      <Pie data={expenseBreakdown} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="total" label={renderPieLabel} labelLine={false}>
                        {expenseBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ flex: 1 }}>
                    {expenseBreakdown.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: CHART_COLORS[idx % CHART_COLORS.length], flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{formatCurrency(item.total)} ({item.count})</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Expense Trend - Area Chart */}
            <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: '600', color: '#111827' }}>Expense Trend</h3>
              <p style={{ margin: '0 0 24px 0', color: '#6b7280', fontSize: '0.9rem' }}>Spending over time</p>
              {dailyTrend.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📈</div>
                  No expense data available
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={dailyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="floatExpenseGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="label" tick={{ fontSize: '0.75rem', fill: '#6b7280' }} angle={-45} textAnchor="end" height={60} />
                    <YAxis tickFormatter={(v) => formatCompact(v)} tick={{ fontSize: '0.75rem', fill: '#6b7280' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="total" name="Amount" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#floatExpenseGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      );
    }

    // === MONTHLY & OTHER FUND TYPES ===
    return (
      <div>
        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '32px' }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '2px solid #6366f120', borderLeft: `4px solid ${fundConfig.color}` }}>
            <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>💰</span> TOTAL COLLECTED — {fundConfig.label.toUpperCase()}
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#4f46e5' }}>
              {formatCurrency(kpis.total_received)}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '4px' }}>All-time contributions</div>
          </div>

          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '2px solid #22c55e20', borderLeft: '4px solid #22c55e' }}>
            <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>📥</span> COLLECTED THIS MONTH
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#059669' }}>
              {formatCurrency(totalCollected)}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '4px' }}>
              {totalExpected > 0 ? `${((totalCollected / totalExpected) * 100).toFixed(1)}% of ${formatCurrency(totalExpected)} expected` : 'No bills generated'}
            </div>
          </div>

          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '2px solid #ef444420', borderLeft: '4px solid #ef4444' }}>
            <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>📤</span> SPENT THIS MONTH
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#e11d48' }}>
              {formatCurrency(kpis.total_expenses)}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '4px' }}>Total {fundConfig.label.toLowerCase()} expenses</div>
          </div>

          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '2px solid #f59e0b20', borderLeft: '4px solid #f59e0b' }}>
            <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>⚠️</span> HOUSEHOLDS OWING
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#d97706' }}>
              {householdsOwing}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '4px' }}>Behind on {fundConfig.label} payments</div>
          </div>
        </div>

        {/* Charts */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {/* Collection Trend */}
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: '600', color: '#111827' }}>Collection Trend</h3>
            <p style={{ margin: '0 0 24px 0', color: '#6b7280', fontSize: '0.9rem' }}>Last 6 months · {fundConfig.label}</p>
            {collectionsPerActivation.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={collectionsPerActivation.slice(-6)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="period" tick={{ fontSize: '0.75rem' }} />
                  <YAxis tickFormatter={(v) => formatCompact(v)} tick={{ fontSize: '0.75rem' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line type="monotone" dataKey="collected" stroke="#22c55e" strokeWidth={2} name="Collected" />
                  <Line type="monotone" dataKey="expected" stroke="#6366f1" strokeWidth={2} strokeDasharray="5 5" name="Expected" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af' }}>No collection data available</div>
            )}
          </div>

          {/* Spending by Category */}
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: '600', color: '#111827' }}>Spending by Category</h3>
            <p style={{ margin: '0 0 24px 0', color: '#6b7280', fontSize: '0.9rem' }}>This period's breakdown</p>
            {expenseBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={expenseBreakdown} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="total" label={renderPieLabel} labelLine={false}>
                    {expenseBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af' }}>No expenses recorded this period</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '2rem', fontWeight: '700', color: '#111827' }}>Financial Dashboard</h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '1.05rem' }}>
          Real-time overview of estate finances • {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', borderBottom: '2px solid #e5e7eb', paddingBottom: '8px', flexWrap: 'wrap' }}>
        {['Overview', ...FUND_TYPES.map(f => f.label)].map(tab => {
          const fundConfig = FUND_TYPES.find(f => f.label === tab);
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 20px',
                background: activeTab === tab ? (fundConfig?.color || '#6366f1') : 'transparent',
                color: activeTab === tab ? 'white' : '#6b7280',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af' }}>Loading dashboard...</div>
      ) : (
        activeTab === 'Overview' ? renderOverviewTab() : renderFundTab()
      )}
    </div>
  );
}