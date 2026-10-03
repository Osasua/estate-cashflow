import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { naira } from '../format';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import Skeleton from '../components/Skeleton';

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#64748b', '#84cc16'];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// ✅ Unified KPI Card Style
const kpiStyle = (color) => ({
  background: '#fff',
  padding: '20px 24px',
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
  borderLeft: `4px solid ${color}`,
  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
});

function Panel({ title, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '20px' }}>
      <h3 style={{ margin: '0 0 20px 0', fontSize: '1rem', fontWeight: '600', color: '#1f2937' }}>{title}</h3>
      <div style={{ minHeight: '240px' }}>{children}</div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [monthBreakdown, setMonthBreakdown] = useState(null);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);

  useEffect(() => {
    api('/dashboard').then(setData).catch((e) => setError(e.message));
  }, []);

  const formatMonthName = (dateStr) => {
    if (!dateStr) return '';
    const [year, month] = dateStr.split('-');
    return `${MONTH_NAMES[parseInt(month) - 1]} ${year}`;
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
      const res = await api(`/reports/summary?startDate=${startDate}&endDate=${endDate}`);
      setMonthBreakdown(res);
    } catch (e) {
      console.error("Failed to load breakdown", e);
    } finally {
      setLoadingBreakdown(false);
    }
  };

  if (error) return <p style={{ color: '#ef4444', padding: '20px' }}>{error}</p>;
  if (!data) return (
    <div style={{ padding: '20px' }}>
      <Skeleton height="30px" width="200px" style={{ marginBottom: '20px' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[1,2,3,4].map(i => <Skeleton key={i} height="100px" width="100%" />)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <Skeleton height="300px" width="100%" />
        <Skeleton height="300px" width="100%" />
      </div>
    </div>
  );

  const { kpis, daily, weekly, categories, trend } = data;
  const isMember = user?.role === 'member';

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px 0' }}>
      <h1 style={{ margin: '0 0 24px 0', fontSize: '1.5rem', fontWeight: '600', color: '#1f2937' }}>
        {isMember ? `Welcome, ${user?.name || 'Resident'}` : 'Summary Dashboard'}
      </h1>
      
      {/* ✅ Unified KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={kpiStyle('#4f46e5')}>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px', fontWeight: '500' }}>Cash Balance</div>
          <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#111827' }}>{naira(kpis.balance)}</div>
        </div>
        <div style={kpiStyle('#10b981')}>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px', fontWeight: '500' }}>Collected This Month</div>
          <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#111827' }}>{naira(kpis.month_in)}</div>
          <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '6px' }}>of {naira(kpis.month_due)} expected (Monthly)</div>
        </div>
        <div style={kpiStyle('#ef4444')}>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px', fontWeight: '500' }}>Spent This Month</div>
          <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#111827' }}>{naira(kpis.month_expense)}</div>
        </div>
        <div style={kpiStyle('#f59e0b')}>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px', fontWeight: '500' }}>Households Owing (Monthly)</div>
          <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#111827' }}>{kpis.pending_count}</div>
          <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '6px' }}>Behind on recurring dues</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <Panel title="Daily Expenses — Last 14 Days">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={daily || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => naira(v)} />
              <Bar dataKey="total" fill="#6366f1" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Weekly Expenses — Last 8 Weeks">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={weekly || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => naira(v)} />
              <Bar dataKey="total" fill="#22c55e" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Spending by Category — This Month">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={categories || []} dataKey="total" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                {(categories || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => naira(v)} />
              <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Cash Flow Trend — Last 6 Months">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => naira(v)} />
              <Legend />
              <Line type="monotone" dataKey="income" name="Contributions" stroke="#22c55e" strokeWidth={2} />
              <Line type="monotone" dataKey="expense" name="Expenses" stroke="#ef4444" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* Monthly Expense Summary Table */}
      <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: '#1f2937' }}>
            Monthly Expense Summary (Last 6 Months) 
            <span style={{ fontSize: '0.8rem', fontWeight: '400', color: '#6b7280', marginLeft: '8px' }}>(Click a month to see details)</span>
          </h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#f9fafb' }}>
              <tr>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Month</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Total Contributions (Income)</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Total Expenses</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Net Flow</th>
              </tr>
            </thead>
            <tbody>
              {(trend || []).map((row, i) => {
                const net = row.income - row.expense;
                const isSelected = selectedMonth === row.month;
                return (
                  <tbody key={row.month}>
                    <tr 
                      onClick={() => handleRowClick(row.month)}
                      style={{ 
                        borderBottom: '1px solid #f3f4f6', 
                        cursor: 'pointer', 
                        background: isSelected ? '#f9fafb' : 'transparent',
                        transition: 'background 0.2s'
                      }}
                    >
                      <td style={{ padding: '12px 16px', fontSize: '0.875rem', fontWeight: isSelected ? '600' : '400', color: '#1f2937' }}>
                        {formatMonthName(row.month)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.875rem', color: '#10b981' }}>{naira(row.income)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.875rem', color: '#ef4444' }}>{naira(row.expense)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.875rem', fontWeight: '600', color: net >= 0 ? '#10b981' : '#ef4444' }}>
                        {naira(net)}
                      </td>
                    </tr>
                    
                    {isSelected && (
                      <tr>
                        <td colSpan="4" style={{ padding: '0', background: '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                          <div style={{ padding: '20px' }}>
                            {loadingBreakdown ? (
                              <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading breakdown...</p>
                            ) : monthBreakdown && monthBreakdown.expense_breakdown ? (
                              <div>
                                <h4 style={{ marginBottom: '12px', fontSize: '0.875rem', fontWeight: '600', color: '#1f2937' }}>
                                  Expense Breakdown for {formatMonthName(row.month)}
                                </h4>
                                <table style={{ width: '100%', fontSize: '0.875rem' }}>
                                  <thead>
                                    <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                                      <th style={{ padding: '8px 12px', color: '#6b7280', fontWeight: '500' }}>Category</th>
                                      <th style={{ padding: '8px 12px', textAlign: 'right', color: '#6b7280', fontWeight: '500' }}>Amount Spent</th>
                                      <th style={{ padding: '8px 12px', textAlign: 'right', color: '#6b7280', fontWeight: '500' }}>% of Total</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {monthBreakdown.expense_breakdown.map((item, idx) => {
                                      const percentage = row.expense > 0 ? ((item.total / row.expense) * 100).toFixed(1) : 0;
                                      return (
                                        <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                          <td style={{ padding: '8px 12px', color: '#374151' }}>{item.name}</td>
                                          <td style={{ padding: '8px 12px', textAlign: 'right', color: '#1f2937' }}>{naira(item.total)}</td>
                                          <td style={{ padding: '8px 12px', textAlign: 'right', color: '#6b7280' }}>{percentage}%</td>
                                        </tr>
                                      );
                                    })}
                                    {monthBreakdown.expense_breakdown.length === 0 && (
                                      <tr><td colSpan="3" style={{ padding: '12px', textAlign: 'center', color: '#9ca3af' }}>No expenses recorded for this month.</td></tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>No data available.</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                );
              })}
              {(!trend || trend.length === 0) && (
                <tr><td colSpan="4" style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>No data available.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}