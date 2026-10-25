import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import Skeleton from '../components/Skeleton';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7'];

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
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
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
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeView, setActiveView] = useState('monthly');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api('/dashboard');
      console.log('Dashboard data:', res);
      setData(res);
    } catch (err) {
      console.error('Dashboard error:', err);
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px' }}>
        <Skeleton height="40px" width="400px" style={{ marginBottom: '24px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
          {[1, 2, 3, 4].map(i => <Skeleton key={i} height="120px" width="100%" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚠️</div>
        <h2 style={{ color: '#ef4444' }}>Error Loading Dashboard</h2>
        <p style={{ color: '#6b7280' }}>{error}</p>
        <button onClick={loadData} style={{ marginTop: '16px', padding: '10px 24px', background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>
          Try Again
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📊</div>
        <p>No dashboard data available</p>
      </div>
    );
  }

  // Destructure with proper names
  const cashBalance = data.cash_balance || 0;
  const monthlyData = data.monthly || { due: 0, paid: 0 };
  const occasionalData = data.occasional || { due: 0, paid: 0 };
  const spentThisMonth = data.spent_this_month || 0;
  const householdsOwing = data.households_owing || 0;
  const trend = data.trend || [];
  const categories = data.categories || [];

  // Determine which data to show based on active view
  const currentData = activeView === 'monthly' ? monthlyData : occasionalData;
  const collectionRate = currentData.due > 0 ? ((currentData.paid / currentData.due) * 100).toFixed(1) : 0;

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
          <p style={{ margin: '0 0 10px 0', fontWeight: '600', color: '#111827' }}>{label}</p>
          {payload.map((entry, index) => (
            <div key={index} style={{ display: 'flex', justifyContent: 'space-between', margin: '6px 0', gap: '20px' }}>
              <span style={{ color: '#6b7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: entry.color, display: 'inline-block' }}></span>
                {entry.name}
              </span>
              <span style={{ fontWeight: '600', color: '#111827' }}>₦{entry.value.toLocaleString()}</span>
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
          Financial Dashboard
        </h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '1.05rem' }}>
          Real-time overview of estate finances • {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* View Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '2px solid #e5e7eb' }}>
        <button 
          onClick={() => setActiveView('monthly')}
          style={{
            padding: '10px 20px',
            background: activeView === 'monthly' ? '#6366f1' : 'transparent',
            color: activeView === 'monthly' ? 'white' : '#6b7280',
            border: 'none',
            fontWeight: activeView === 'monthly' ? '600' : '500',
            cursor: 'pointer',
            borderRadius: '8px 8px 0 0'
          }}
        >
          Monthly Contributions
        </button>
        <button 
          onClick={() => setActiveView('occasional')}
          style={{
            padding: '10px 20px',
            background: activeView === 'occasional' ? '#6366f1' : 'transparent',
            color: activeView === 'occasional' ? 'white' : '#6b7280',
            border: 'none',
            fontWeight: activeView === 'occasional' ? '600' : '500',
            cursor: 'pointer',
            borderRadius: '8px 8px 0 0'
          }}
        >
          Occasional Contributions
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <KPICard
          title="Cash Balance"
          value={`₦${cashBalance.toLocaleString()}`}
          subtitle="Total available funds"
          color="indigo"
          icon="💰"
        />
        <KPICard
          title={activeView === 'monthly' ? 'Monthly Collected' : 'Occasional Collected'}
          value={`₦${currentData.paid.toLocaleString()}`}
          subtitle={`${collectionRate}% of ₦${currentData.due.toLocaleString()} expected`}
          color="emerald"
          icon=""
        />
        <KPICard
          title="Spent This Month"
          value={`₦${spentThisMonth.toLocaleString()}`}
          subtitle="Total expenses"
          color="rose"
          icon="📤"
        />
        <KPICard
          title="Households Owing"
          value={householdsOwing.toString()}
          subtitle="Behind on monthly payments"
          color="amber"
          icon="⚠️"
        />
      </div>

      {/* Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        {/* Cash Flow Trend */}
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          border: '1px solid #e5e7eb',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.125rem', fontWeight: '600', color: '#111827' }}>
            Cash Flow Trend
          </h3>
          <p style={{ margin: '0 0 24px 0', fontSize: '0.9rem', color: '#6b7280' }}>
            Last 6 months performance
          </p>
          {trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={trend} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorMonthly" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorOccasional" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `₦${(v/1000).toFixed(0)}k` : `₦${v}`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="Monthly" stroke="#6366f1" strokeWidth={2} fill="url(#colorMonthly)" dot={{ r: 4, fill: '#6366f1' }} />
                <Area type="monotone" dataKey="Occasional" stroke="#f59e0b" strokeWidth={2} fill="url(#colorOccasional)" dot={{ r: 4, fill: '#f59e0b' }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '320px', color: '#9ca3af' }}>
              No trend data available
            </div>
          )}
        </div>

        {/* Spending by Category */}
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          border: '1px solid #e5e7eb',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.125rem', fontWeight: '600', color: '#111827' }}>
            Spending by Category
          </h3>
          <p style={{ margin: '0 0 24px 0', fontSize: '0.9rem', color: '#6b7280' }}>
            This month's breakdown
          </p>
          {categories.length > 0 ? (
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
                >
                  {categories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 12, fontWeight: '500' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '320px', color: '#9ca3af', fontSize: '1rem' }}>
              No expenses recorded this month
            </div>
          )}
        </div>
      </div>

      {/* Collection Progress Bar */}
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        border: '1px solid #e5e7eb',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: '#111827' }}>
            {activeView === 'monthly' ? 'Monthly' : 'Occasional'} Collection Progress
          </h3>
          <span style={{ fontSize: '1.5rem', fontWeight: '700', color: collectionRate >= 80 ? '#059669' : collectionRate >= 50 ? '#d97706' : '#e11d48' }}>
            {collectionRate}%
          </span>
        </div>
        <div style={{ background: '#f3f4f6', borderRadius: '12px', height: '16px', overflow: 'hidden' }}>
          <div style={{
            width: `${Math.min(collectionRate, 100)}%`,
            height: '100%',
            background: collectionRate >= 80 ? 'linear-gradient(90deg, #22c55e 0%, #10b981 100%)' : collectionRate >= 50 ? 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)' : 'linear-gradient(90deg, #ef4444 0%, #f43f5e 100%)',
            borderRadius: '12px',
            transition: 'width 0.5s ease'
          }}></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '0.9rem', color: '#6b7280' }}>
          <span>₦{currentData.paid.toLocaleString()} collected</span>
          <span>₦{currentData.due.toLocaleString()} expected</span>
        </div>
      </div>
    </div>
  );
}