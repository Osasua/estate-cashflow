import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import Skeleton from '../Skeleton';
import { PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const CHART_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7'];

export default function OccasionDashboard({ typeKey, typeLabel }) {
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [latestActivation, setLatestActivation] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');

    const loadData = async () => {
      try {
        const now = new Date();
        const year = now.getFullYear();
        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;
        
        // 1. Fetch Report Data (This gives us Opening Balance, Total Raised, Expenses)
        const reportRes = await api(`/reports/summary?startDate=${startDate}&endDate=${endDate}&type=${typeKey}`);
        
        // 2. Fetch Contributions across all 12 months to find the Latest Activation date
        const allMonthsPromises = Array.from({ length: 12 }, (_, i) => 
          api(`/contributions?type=${typeKey}&year=${year}&month=${i + 1}`)
        );
        const allMonthsResults = await Promise.all(allMonthsPromises);
        const allContribs = allMonthsResults.flatMap(res => res.contributions || []);

        // Find the most recent activation
        const latest = allContribs.length > 0 
          ? allContribs.sort((a, b) => {
              const dateA = new Date(a.period_year, a.period_month - 1);
              const dateB = new Date(b.period_year, b.period_month - 1);
              return dateB - dateA;
            })[0]
          : null;

        if (alive) {
          setReportData(reportRes);
          setLatestActivation(latest);
        }
      } catch (err) {
        if (alive) {
          console.error('Failed to load occasion dashboard data:', err);
          setError('Failed to load data for ' + typeLabel);
        }
      } finally {
        if (alive) setLoading(false);
      }
    };

    loadData();
    return () => { alive = false; };
  }, [typeKey, typeLabel]);

  const formatCurrency = (amount) => {
    return `₦${Number(amount).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatCompact = (amount) => {
    if (amount >= 1000000) return `₦${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `₦${(amount / 1000).toFixed(0)}k`;
    return `₦${amount}`;
  };

  if (loading) {
    return (
      <div style={{ marginTop: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '32px' }}>
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} height="140px" width="100%" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return <div style={{ padding: '40px', color: '#ef4444', textAlign: 'center' }}>{error}</div>;
  }

  // Extract synced data from Reports API
  const openingBalance = reportData?.kpis?.opening_balance || 0;
  const totalRaised = reportData?.kpis?.total_received || 0; // ✅ SYNCED WITH REPORTS PAGE
  const totalExpenses = reportData?.kpis?.total_expenses || 0;
  const expenseBreakdown = reportData?.expense_breakdown || [];
  const dailyTrend = reportData?.daily_trend || [];
  const closingBalance = openingBalance + totalRaised - totalExpenses;

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const latestActivationLabel = latestActivation 
    ? `${months[latestActivation.period_month - 1]} ${latestActivation.period_year}`
    : 'None';

  // Custom Tooltip for Charts
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

  return (
    <div style={{ marginTop: '24px' }}>
      {/* --- 4 KPI CARDS --- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        
        {/* 1. Opening Balance */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb', borderLeft: '4px solid #6366f1' }}>
          <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>💰</span> OPENING BALANCE
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: '700', color: openingBalance >= 0 ? '#4f46e5' : '#ef4444' }}>
            {formatCurrency(openingBalance)}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '4px' }}>From previous period</div>
        </div>

        {/* 2. Total Raised (SYNCED) */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb', borderLeft: '4px solid #22c55e' }}>
          <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>📥</span> TOTAL RAISED — {typeLabel.toUpperCase()}
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#059669' }}>
            {formatCurrency(totalRaised)}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '4px' }}>
            Collections this year
          </div>
        </div>

        {/* 3. Latest Activation */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>📅</span> LATEST ACTIVATION
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#111827' }}>
            {latestActivationLabel}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '4px' }}>
            {latestActivation 
              ? `${formatCurrency(latestActivation.amount_paid || 0)} of ${formatCurrency(latestActivation.amount_due || 0)}`
              : 'No activations yet'}
          </div>
        </div>

        {/* 4. Expenses */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb', borderLeft: '4px solid #ef4444' }}>
          <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>📤</span> {typeLabel.toUpperCase()} EXPENSES
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#e11d48' }}>
            {formatCurrency(totalExpenses)}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '4px' }}>
            {expenseBreakdown.length > 0 ? `${expenseBreakdown.length} categories` : 'No expenses recorded'}
          </div>
        </div>
      </div>

      {/* --- FUND SUMMARY (Moved above analytics) --- */}
      <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.25rem', fontWeight: '600', color: '#111827' }}>
          {typeLabel} Fund Summary
        </h3>
        <p style={{ color: '#6b7280', margin: 0, fontSize: '1.05rem', lineHeight: '1.6' }}>
          Opening Balance ({formatCurrency(openingBalance)}) + Total Raised ({formatCurrency(totalRaised)}) - Expenses ({formatCurrency(totalExpenses)}) = 
          <strong style={{ color: closingBalance >= 0 ? '#059669' : '#e11d48', marginLeft: '4px' }}>
            {formatCurrency(closingBalance)} Closing Balance
          </strong>
        </p>
      </div>

      {/* --- ANALYTICS CHARTS --- */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        
        {/* Expense Breakdown Pie Chart */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: '600', color: '#111827' }}>Expense Breakdown</h3>
          <p style={{ margin: '0 0 24px 0', color: '#6b7280', fontSize: '0.9rem' }}>Distribution by category</p>
          
          {expenseBreakdown.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af' }}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📊</div>
              No expenses recorded for this period
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <ResponsiveContainer width="50%" height={300}>
                <PieChart>
                  <Pie
                    data={expenseBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="total"
                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
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

        {/* Expense Trend Area Chart */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: '600', color: '#111827' }}>Expense Trend</h3>
          <p style={{ margin: '0 0 24px 0', color: '#6b7280', fontSize: '0.9rem' }}>Spending over time</p>
          
          {dailyTrend.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af' }}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📈</div>
              No daily expense data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dailyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="label" 
                  tick={{ fontSize: '0.75rem', fill: '#6b7280' }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  tickFormatter={(value) => formatCompact(value)}
                  tick={{ fontSize: '0.75rem', fill: '#6b7280' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="total" 
                  name="Amount"
                  stroke="#ef4444" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorTotal)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

      </div>
    </div>
  );
}