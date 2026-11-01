import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import Skeleton from '../Skeleton';

export default function OccasionDashboard({ typeKey, typeLabel }) {
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [contributions, setContributions] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');

    const loadData = async () => {
      try {
        const now = new Date();
        const startDate = `${now.getFullYear()}-01-01`;
        const endDate = `${now.getFullYear()}-12-31`;
        
        // 1. Fetch report summary for Opening Balance and Expenses (100% synced with Reports & Analytics)
        const reportRes = await api(`/reports/summary?startDate=${startDate}&endDate=${endDate}&type=${typeKey}`);
        
        // 2. Fetch contributions for Total Raised and Latest Activation
        const contribRes = await api(`/contributions?type=${typeKey}&year=${now.getFullYear()}`);

        if (alive) {
          setReportData(reportRes);
          setContributions(contribRes.contributions || []);
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

  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginTop: '24px' }}>
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} height="140px" width="100%" />)}
      </div>
    );
  }

  if (error) {
    return <div style={{ padding: '40px', color: '#ef4444', textAlign: 'center' }}>{error}</div>;
  }

  // Calculate metrics
  const totalRaised = contributions.reduce((sum, c) => sum + (parseFloat(c.amount_paid) || 0), 0);
  
  // Find latest activation (most recent contribution record)
  const latestActivation = contributions.length > 0 
    ? contributions.sort((a, b) => {
        const dateA = new Date(a.period_year, a.period_month - 1);
        const dateB = new Date(b.period_year, b.period_month - 1);
        return dateB - dateA;
      })[0]
    : null;

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const latestActivationLabel = latestActivation 
    ? `${months[latestActivation.period_month - 1]} ${latestActivation.period_year}`
    : 'None';

  // Extract synced data from Reports API
  const openingBalance = reportData?.kpis?.opening_balance || 0;
  const totalExpenses = reportData?.kpis?.total_expenses || 0;
  const expenseCategoriesCount = reportData?.expense_breakdown?.length || 0;
  const closingBalance = openingBalance + totalRaised - totalExpenses;

  return (
    <div style={{ marginTop: '24px' }}>
      {/* 4 KPI Cards as requested */}
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

        {/* 2. Total Raised — Float (Retained) */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb', borderLeft: '4px solid #22c55e' }}>
          <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>📥</span> TOTAL RAISED — {typeLabel.toUpperCase()}
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#059669' }}>
            {formatCurrency(totalRaised)}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '4px' }}>
            {contributions.length} activation{contributions.length !== 1 ? 's' : ''} · all-time
          </div>
        </div>

        {/* 3. Latest Activation (Retained) */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>📅</span> LATEST ACTIVATION
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#111827' }}>
            {latestActivationLabel}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '4px' }}>
            {latestActivation 
              ? `${formatCurrency(latestActivation.amount_paid || 0)} of ${formatCurrency(latestActivation.amount_due || 0)} collected`
              : 'No activations yet'}
          </div>
        </div>

        {/* 4. Float Expenses (New) */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb', borderLeft: '4px solid #ef4444' }}>
          <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>📤</span> {typeLabel.toUpperCase()} EXPENSES
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#e11d48' }}>
            {formatCurrency(totalExpenses)}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '4px' }}>
            {expenseCategoriesCount > 0 ? `${expenseCategoriesCount} categories` : 'No expenses recorded'}
          </div>
        </div>

      </div>

      {/* Financial Health Summary (Ties it all together) */}
      <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
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
    </div>
  );
}