import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';

const FUND_TYPES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'float', label: 'Float' },
  { value: 'projects', label: 'Projects' },
  { value: 'end-of-year', label: 'End of Year' },
  { value: 'welfare', label: 'Welfare' }
];

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7'];

export default function Reports() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  
  const now = new Date();
  const [filters, setFilters] = useState({
    startDate: `${now.getFullYear()}-01-01`,
    endDate: `${now.getFullYear()}-12-31`,
    type: 'float' // Default to Float as requested
  });

  const [report, setReport] = useState({
    kpis: { opening_balance: 0, total_received: 0, total_expenses: 0, closing_balance: 0, manual_opening_balance: 0, effective_date: '' },
    expense_breakdown: [],
    daily_trend: []
  });

  const [showModal, setShowModal] = useState(false);
  const [balanceForm, setBalanceForm] = useState({
    type: 'float',
    effective_date: `${now.getFullYear() - 1}-12-31`,
    amount: '',
    notes: ''
  });

  useEffect(() => {
    loadReport();
  }, [filters]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: filters.startDate,
        endDate: filters.endDate,
        type: filters.type
      });
      const res = await api(`/reports/summary?${params}`);
      setReport(res);
    } catch (err) {
      setMessage('❌ Failed to load report: ' + err.message);
      setTimeout(() => setMessage(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleSetBalance = async () => {
    try {
      await api('/reports/opening-balance', {
        method: 'POST',
        body: balanceForm
      });
      setMessage('✅ Opening balance set successfully');
      setTimeout(() => setMessage(''), 3000);
      setShowModal(false);
      setBalanceForm({ ...balanceForm, amount: '', notes: '' });
      loadReport();
    } catch (err) {
      setMessage('❌ Failed: ' + err.message);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const formatCurrency = (amount) => `₦${Number(amount).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const maxBreakdown = Math.max(...report.expense_breakdown.map(e => e.total), 1);

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '2rem', fontWeight: '700', color: '#111827' }}>Reports & Analytics</h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '1.05rem' }}>Comprehensive financial insights and expense tracking</p>
      </div>

      {message && (
        <div style={{ background: message.includes('✅') ? '#ecfdf5' : '#fff1f2', border: `1px solid ${message.includes('✅') ? '#a7f3d0' : '#fecdd3'}`, borderRadius: '8px', padding: '12px', marginBottom: '20px', color: message.includes('✅') ? '#065f46' : '#991b1b' }}>{message}</div>
      )}

      {/* Filters */}
      <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px', color: '#374151' }}>Start Date</label>
            <input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px', color: '#374151' }}>End Date</label>
            <input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px', color: '#374151' }}>Fund Type</label>
            <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', boxSizing: 'border-box' }}>
              {FUND_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <button onClick={() => setShowModal(true)} style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
            Set Opening Balance
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb', borderLeft: '4px solid #6366f1' }}>
          <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px' }}>Opening Balance</div>
          <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#4f46e5' }}>{formatCurrency(report.kpis.opening_balance)}</div>
          <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px' }}>Manual: {formatCurrency(report.kpis.manual_opening_balance)} + Prior Activity</div>
        </div>
        <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb', borderLeft: '4px solid #22c55e' }}>
          <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px' }}>Total Received</div>
          <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#059669' }}>{formatCurrency(report.kpis.total_received)}</div>
          <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px' }}>Collections in selected period</div>
        </div>
        <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb', borderLeft: '4px solid #ef4444' }}>
          <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px' }}>Total Expenses</div>
          <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#e11d48' }}>{formatCurrency(report.kpis.total_expenses)}</div>
          <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px' }}>Spending in selected period</div>
        </div>
        <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb', borderLeft: '4px solid #a855f7' }}>
          <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px' }}>Closing Balance</div>
          <div style={{ fontSize: '1.8rem', fontWeight: '700', color: report.kpis.closing_balance >= 0 ? '#7c3aed' : '#e11d48' }}>
            {formatCurrency(report.kpis.closing_balance)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px' }}>Opening + Received - Expenses</div>
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        {/* Expense Breakdown */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.25rem', fontWeight: '600', color: '#111827' }}>Expense Breakdown</h3>
          {report.expense_breakdown.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>No expenses in selected period</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {report.expense_breakdown.map((item, idx) => (
                <div key={idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#111827' }}>{item.name}</span>
                    <span style={{ fontSize: '0.9rem', color: '#6b7280' }}>{formatCurrency(item.total)} ({item.count})</span>
                  </div>
                  <div style={{ height: '8px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${(item.total / maxBreakdown) * 100}%`, height: '100%', background: COLORS[idx % COLORS.length], borderRadius: '4px' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Daily Trend */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.25rem', fontWeight: '600', color: '#111827' }}>Daily Expense Trend</h3>
          {report.daily_trend.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>No daily data available</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '250px', paddingTop: '20px' }}>
              {report.daily_trend.map((day, idx) => {
                const maxTrend = Math.max(...report.daily_trend.map(d => d.total), 1);
                const heightPct = (day.total / maxTrend) * 100;
                return (
                  <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <div style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: '4px' }}>₦{(day.total/1000).toFixed(0)}k</div>
                    <div style={{ width: '100%', maxWidth: '40px', height: `${Math.max(heightPct, 2)}%`, background: '#ef4444', borderRadius: '4px 4px 0 0', transition: 'height 0.3s' }} title={formatCurrency(day.total)} />
                    <div style={{ fontSize: '0.7rem', color: '#9ca3af', transform: 'rotate(-45deg)', transformOrigin: 'top left', marginTop: '8px' }}>{day.label}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Opening Balance Modal */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowModal(false)}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', width: '90%', maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 24px 0', fontSize: '1.5rem', fontWeight: '700', color: '#111827' }}>Set Opening Balance</h2>
            <div style={{ display: 'grid', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '600', color: '#374151' }}>Fund Type</label>
                <select value={balanceForm.type} onChange={(e) => setBalanceForm({ ...balanceForm, type: e.target.value })} style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', boxSizing: 'border-box' }}>
                  {FUND_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '600', color: '#374151' }}>Effective Date (Last day of previous period)</label>
                <input type="date" value={balanceForm.effective_date} onChange={(e) => setBalanceForm({ ...balanceForm, effective_date: e.target.value })} style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '600', color: '#374151' }}>Opening Balance (₦)</label>
                <input type="number" value={balanceForm.amount} onChange={(e) => setBalanceForm({ ...balanceForm, amount: e.target.value })} placeholder="e.g., -1219000" style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '600', color: '#374151' }}>Note (Optional)</label>
                <textarea value={balanceForm.notes} onChange={(e) => setBalanceForm({ ...balanceForm, notes: e.target.value })} placeholder="e.g., Balance carried forward from 2025" style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', minHeight: '60px', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '10px 20px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSetBalance} style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Save Opening Balance</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}