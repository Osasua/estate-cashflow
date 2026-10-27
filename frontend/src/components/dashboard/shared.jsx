import React, { useLayoutEffect, useRef, useState } from 'react';
import { naira } from '../../format';

export const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#64748b', '#84cc16', '#ec4899', '#14b8a6'];

// Contribution funds (mirrors backend contribution_type enum)
export const FUND_TYPES = [
  { key: 'monthly', label: 'Monthly' },
  { key: 'float', label: 'Float' },
  { key: 'projects', label: 'Projects' },
  { key: 'end-of-year', label: 'End of Year' },
  { key: 'welfare', label: 'Welfare' },
];
export const FUND_LABEL = FUND_TYPES.reduce((m, t) => ({ ...m, [t.key]: t.label }), {});

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// '2026-05' -> 'May 2026'
export const formatMonthName = (dateStr) => {
  if (!dateStr) return '';
  const [year, month] = dateStr.split('-');
  return `${MONTH_NAMES[parseInt(month, 10) - 1]} ${year}`;
};

// Same status logic used by the Contributions page, shared for dashboard rows
export const contributionStatus = (c) => {
  const paid = parseFloat(c.amount_paid) || 0;
  const due = parseFloat(c.amount_due) || 0;
  if (due > 0 && paid >= due) return 'paid';
  if (paid > 0) return 'partial';
  return 'pending';
};

export function StatusPill({ status }) {
  const map = {
    paid: { bg: '#dcfce7', color: '#166534', label: '✓ Paid' },
    partial: { bg: '#fef3c7', color: '#92400e', label: '⚠ Partial' },
    pending: { bg: '#fee2e2', color: '#991b1b', label: '⏳ Pending' },
  };
  const s = map[status] || map.pending;
  return (
    <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '600', background: s.bg, color: s.label ? s.color : s.color, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
}

// Small neutral tag marking figures that are NOT scoped to the active tab
export function EstateChip() {
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 10px',
      background: '#f3f4f6',
      color: '#6b7280',
      borderRadius: '6px',
      fontSize: '0.75rem',
      fontWeight: '600',
      whiteSpace: 'nowrap',
    }}>
      Estate-wide
    </span>
  );
}

// KPI value that measures itself and shrinks until it fits the card width.
// No character-count guessing: works for any amount, any viewport, any tab.
function FitValue({ value }) {
  const ref = useRef(null);
  const [size, setSize] = useState(36); // 2.25rem starting point

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const fit = () => {
      let s = 36;
      el.style.fontSize = s + 'px';
      while (s > 16 && el.scrollWidth > el.clientWidth) {
        s -= 2;
        el.style.fontSize = s + 'px';
      }
      setSize(s);
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(fit);
    ro.observe(el.parentElement || el);
    return () => ro.disconnect();
  }, [value]);

  return (
    <div
      ref={ref}
      style={{
        fontSize: size + 'px',
        fontWeight: '700',
        color: '#111827',
        lineHeight: 1.1,
        marginBottom: '8px',
        whiteSpace: 'nowrap',
      }}
    >
      {value}
    </div>
  );
}

export function KPICard({ title, value, subtitle, trend, color, icon }) {
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
      <FitValue value={value} />
      {subtitle && (
        <div style={{ fontSize: '0.85rem', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '6px' }}>
          {trend && <span style={{ color: trend > 0 ? '#059669' : '#e11d48', fontWeight: '600' }}>{trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%</span>}
          {subtitle}
        </div>
      )}
    </div>
  );
}

// Chart Panel (identical to the one previously inlined in Dashboard)
export function ChartPanel({ title, subtitle, children, action }) {
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

// Shared recharts tooltip (identical to the one previously inlined in Dashboard)
export function CustomTooltip({ active, payload, label }) {
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
}

export const kFormatter = (v) => v >= 1000 ? `₦${(v / 1000).toFixed(0)}k` : `₦${v}`;
