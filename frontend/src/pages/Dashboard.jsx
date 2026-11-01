import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const FUND_TYPES = [
  { value: 'monthly', label: 'Monthly', color: '#6366f1' },
  { value: 'float', label: 'Float', color: '#22c55e' },
  { value: 'projects', label: 'Projects', color: '#f59e0b' },
  { value: 'end-of-year', label: 'End of Year', color: '#ef4444' },
  { value: 'welfare', label: 'Welfare', color: '#06b6d4' }
];

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7'];

export default function Dashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('Overview');
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState({});
  const [selectedActivation, setSelectedActivation] = useState(null);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  useEffect(() => {
    loadDashboardData();
  }, [activeTab]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'Overview') {
        // Load summary for all fund types
        const promises = FUND_TYPES.map(async (fund) => {
          const reportRes = await api(`/reports/summary?startDate=${currentYear}-01-01&endDate=${currentYear}-12-31&type=${fund.value}`);
          return { type: fund.value, label: fund.label, ...reportRes };
        });
        const results = await Promise.all(promises);
        const data = {};
        results.forEach(r => { data[r.type] = r; });
        setDashboardData(data);
      } else {
        // Load specific fund type data
        const fundType = FUND_TYPES.find(f => f.label.toLowerCase() === activeTab.toLowerCase())?.value || 'monthly';
        const reportRes = await api(`/reports/summary?startDate=${currentYear}-01-01&endDate=${currentYear}-12-31&type=${fundType}`);
        
        // Load activation data for Monthly/Float/etc
        const activationsRes = await api(`/contributions?type=${fundType}&year=${currentYear}`);
        
        setDashboardData({
          [fundType]: {
            ...reportRes,
            activations: activationsRes.contributions || []
          }
        });
      }
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return `₦${Number(amount).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getFundData = (fundType) => {
    return dashboardData[fundType] || { kpis: { opening_balance: 0, total_received: 0, total_expenses: 0, closing_balance: 0 } };
  };

  // Calculate net collection rate (accounts for expenses)
  const calculateNetRate = (fundType) => {
    const data = getFundData(fundType);
    const { opening_balance, total_received, total_expenses } = data.kpis;
    
    // Net position = what we have after expenses
    const netPosition = opening_balance + total_received - total_expenses;
    
    // If we started with negative (deficit), calculate recovery rate
    if (opening_balance < 0) {
      const deficitToRecover = Math.abs(opening_balance);
      const recovered = Math.max(0, netPosition);
      return deficitToRecover > 0 ? (recovered / deficitToRecover) * 100 : 0;
    }
    
    // Normal case: how much of received is still available
    return total_received > 0 ? ((total_received - total_expenses) / total_received) * 100 : 0;
  };

  const renderOverviewTab = () => {
    const overviewData = FUND_TYPES.map(fund => {
      const data = getFundData(fund.value);
      return {
        name: fund.label,
        opening: data.kpis.opening_balance,
        received: data.kpis.total_received,
        expenses: data.kpis.total_expenses,
        closing: data.kpis.closing_balance,
        netRate: calculateNetRate(fund.value)
      };
    });

    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '32px' }}>
          {FUND_TYPES.map((fund, idx) => {
            const data = getFundData(fund.value);
            const netRate = calculateNetRate(fund.value);
            return (
              <div key={fund.value} style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: `2px solid ${fund.color}20`, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: fund.color }} />
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600', color: '#111827' }}>{fund.label} Fund</h3>
                </div>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>Opening Balance:</span>
                    <span style={{ fontWeight: '600', color: data.kpis.opening_balance >= 0 ? '#22c55e' : '#ef4444' }}>{formatCurrency(data.kpis.opening_balance)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>Total Received:</span>
                    <span style={{ fontWeight: '600', color: '#22c55e' }}>{formatCurrency(data.kpis.total_received)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>Total Expenses:</span>
                    <span style={{ fontWeight: '600', color: '#ef4444' }}>{formatCurrency(data.kpis.total_expenses)}</span>
                  </div>
                  <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '12px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>Closing Balance:</span>
                    <span style={{ fontWeight: '700', fontSize: '1.1rem', color: data.kpis.closing_balance >= 0 ? '#6366f1' : '#ef4444' }}>{formatCurrency(data.kpis.closing_balance)}</span>
                  </div>
                  <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '8px', marginTop: '8px' }}>
                    <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '4px' }}>Net Collection Rate</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: '700', color: netRate >= 80 ? '#22c55e' : netRate >= 50 ? '#f59e0b' : '#ef4444' }}>
                      {netRate.toFixed(1)}%
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '2px' }}>
                      {netRate >= 100 ? '✅ Surplus generated' : netRate >= 50 ? '⚠️ Partial recovery' : '❌ Deficit remains'}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Combined Chart */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '1.25rem', fontWeight: '600', color: '#111827' }}>Financial Overview by Fund Type</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={overviewData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value)} />
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

  const renderFundTab = () => {
    const fundType = FUND_TYPES.find(f => f.label.toLowerCase() === activeTab.toLowerCase())?.value || 'monthly';
    const data = getFundData(fundType);
    const { opening_balance, total_received, total_expenses, closing_balance } = data.kpis;
    const netRate = calculateNetRate(fundType);
    const fundConfig = FUND_TYPES.find(f => f.value === fundType);

    // Calculate metrics
    const totalExpected = data.activations?.reduce((sum, c) => sum + (parseFloat(c.amount_due) || 0), 0) || 0;
    const totalCollected = data.activations?.reduce((sum, c) => sum + (parseFloat(c.amount_paid) || 0), 0) || 0;
    const householdsOwing = data.activations?.filter(c => (parseFloat(c.amount_paid) || 0) < (parseFloat(c.amount_due) || 0)).length || 0;
    const collectionRate = totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0;

    // Get latest activation
    const latestActivation = data.activations?.length > 0 ? data.activations[0] : null;

    return (
      <div>
        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '32px' }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: `2px solid ${fundConfig.color}20`, borderLeft: `4px solid ${fundConfig.color}` }}>
            <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>💰</span> OPENING BALANCE
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: '700', color: opening_balance >= 0 ? '#22c55e' : '#ef4444' }}>
              {formatCurrency(opening_balance)}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '4px' }}>From previous period</div>
          </div>

          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '2px solid #22c55e20', borderLeft: '4px solid #22c55e' }}>
            <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>📥</span> TOTAL RECEIVED
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#22c55e' }}>
              {formatCurrency(total_received)}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '4px' }}>{collectionRate.toFixed(1)}% collection rate</div>
          </div>

          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '2px solid #ef444420', borderLeft: '4px solid #ef4444' }}>
            <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>📤</span> TOTAL EXPENSES
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#ef4444' }}>
              {formatCurrency(total_expenses)}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '4px' }}>
              {total_expenses > 0 ? `${((total_expenses / total_received) * 100).toFixed(1)}% of received` : 'No expenses recorded'}
            </div>
          </div>

          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '2px solid #a855f720', borderLeft: '4px solid #a855f7' }}>
            <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>💵</span> CLOSING BALANCE
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: '700', color: closing_balance >= 0 ? '#7c3aed' : '#ef4444' }}>
              {formatCurrency(closing_balance)}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '4px' }}>
              {closing_balance >= 0 ? '✅ Positive position' : '❌ Deficit'}
            </div>
          </div>
        </div>

        {/* Net Position Alert */}
        <div style={{
          background: netRate >= 100 ? '#ecfdf5' : netRate >= 50 ? '#fffbeb' : '#fff1f2',
          border: `1px solid ${netRate >= 100 ? '#a7f3d0' : netRate >= 50 ? '#fde68a' : '#fecdd3'}`,
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '2rem' }}>{netRate >= 100 ? '✅' : netRate >= 50 ? '⚠️' : '❌'}</span>
            <div>
              <div style={{ fontWeight: '600', color: netRate >= 100 ? '#065f46' : netRate >= 50 ? '#92400e' : '#991b1b', marginBottom: '4px' }}>
                Net Financial Position: {netRate.toFixed(1)}%
              </div>
              <div style={{ fontSize: '0.9rem', color: netRate >= 100 ? '#059669' : netRate >= 50 ? '#d97706' : '#e11d48' }}>
                {netRate >= 100 
                  ? `Excellent! You have a surplus of ${formatCurrency(closing_balance)} after all expenses.`
                  : netRate >= 50
                  ? `Partial recovery achieved. ${formatCurrency(Math.abs(closing_balance))} still needed to break even.`
                  : `Critical: ${formatCurrency(Math.abs(closing_balance))} deficit. Immediate action required.`
                }
              </div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {/* Collection Trend */}
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.25rem', fontWeight: '600', color: '#111827' }}>
              Collection Trend
            </h3>
            <p style={{ margin: '0 0 24px 0', color: '#6b7280', fontSize: '0.9rem' }}>Last 6 months</p>
            {data.activations && data.activations.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.activations.slice(0, 6).map(a => ({
                  month: `${MONTHS[a.period_month - 1]} ${a.period_year}`,
                  collected: parseFloat(a.amount_paid) || 0,
                  expected: parseFloat(a.amount_due) || 0
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                  <Line type="monotone" dataKey="collected" stroke="#22c55e" strokeWidth={2} name="Collected" />
                  <Line type="monotone" dataKey="expected" stroke="#6366f1" strokeWidth={2} strokeDasharray="5 5" name="Expected" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>No collection data available</div>
            )}
          </div>

          {/* Expense Breakdown */}
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.25rem', fontWeight: '600', color: '#111827' }}>
              Expense Breakdown
            </h3>
            <p style={{ margin: '0 0 24px 0', color: '#6b7280', fontSize: '0.9rem' }}>By category</p>
            {data.expense_breakdown && data.expense_breakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={data.expense_breakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="total"
                    label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {data.expense_breakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>No expenses recorded</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '2rem', fontWeight: '700', color: '#111827' }}>Financial Dashboard</h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '1.05rem' }}>
          Real-time overview of estate finances • {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', borderBottom: '2px solid #e5e7eb', paddingBottom: '8px' }}>
        {['Overview', ...FUND_TYPES.map(f => f.label)].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 20px',
              background: activeTab === tab ? FUND_TYPES.find(f => f.label === tab)?.color || '#6366f1' : 'transparent',
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
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af' }}>Loading dashboard...</div>
      ) : (
        activeTab === 'Overview' ? renderOverviewTab() : renderFundTab()
      )}
    </div>
  );
}