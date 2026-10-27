import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  Legend, PieChart, Pie, Cell,
} from 'recharts';
import { api } from '../../api';
import { naira } from '../../format';
import {
  formatMonthName, contributionStatus, StatusPill,
  KPICard, ChartPanel, CustomTooltip, kFormatter,
} from './shared';

const STATUS_COLORS = { paid: '#22c55e', partial: '#f59e0b', pending: '#ef4444' };

// Tooltip for counts (households), not money
function CountTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{
      background: 'white', padding: '14px 18px', border: '1px solid #e5e7eb',
      borderRadius: '10px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
      fontSize: '0.875rem', minWidth: '160px',
    }}>
      <p style={{ margin: '0 0 10px 0', fontWeight: '600', color: '#111827', fontSize: '0.9rem' }}>{label}</p>
      {payload.map((entry, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', margin: '6px 0' }}>
          <span style={{ color: '#6b7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: entry.color || entry.payload?.fill, display: 'inline-block' }}></span>
            {entry.name}
          </span>
          <span style={{ fontWeight: '600', color: '#111827' }}>{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

const th = (align) => ({
  padding: '16px 28px', textAlign: align, fontSize: '0.75rem', fontWeight: '600',
  color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em',
  borderBottom: '1px solid #e5e7eb',
});
const td = (align) => ({
  padding: '16px 28px', textAlign: align, fontSize: '0.95rem', fontWeight: '600',
  borderBottom: '1px solid #f3f4f6', fontVariantNumeric: 'tabular-nums',
});

/**
 * Analytics view for OCCASIONAL contribution types (Float / Projects /
 * End of Year). These funds activate 1-3 times a year, so a fixed monthly
 * window would be mostly zeros. Everything here is organised per
 * ACTIVATION (occasion) instead: KPIs, expected-vs-collected bars per
 * drive, household-status donut for the selected drive, and an activations
 * table with per-household drill-down.
 */
export default function OccasionDashboard({ typeKey, typeLabel }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [rows, setRows] = useState(null);
  const [loadingRows, setLoadingRows] = useState(false);

  useEffect(() => {
    let alive = true;
    setData(null); setError(''); setSelected(null); setExpanded(null); setRows(null);
    api(`/dashboard/occasions?type=${encodeURIComponent(typeKey)}`)
      .then((d) => {
        if (!alive) return;
        if (d?.scope?.type !== typeKey) {
          setError('Scoped data for this tab is not available yet. The backend needs the "/dashboard/occasions" update (see docs/BACKEND_CONTRACT.md).');
          return;
        }
        setData(d);
        setSelected(d?.totals?.latest || null);
      })
      .catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [typeKey]);

  const loadHouseholds = async (period) => {
    if (expanded === period) { setExpanded(null); setRows(null); return; }
    setExpanded(period);
    setLoadingRows(true);
    setRows(null);
    try {
      const [year, month] = period.split('-');
      const res = await api(`/contributions?month=${parseInt(month, 10)}&year=${year}&type=${encodeURIComponent(typeKey)}`);
      setRows(res.contributions || []);
    } catch (e) {
      console.error('Failed to load households', e);
      setRows({ error: e.message });
    } finally {
      setLoadingRows(false);
    }
  };

  if (error) {
    return (
      <div style={{ padding: '40px', color: '#ef4444', textAlign: 'center' }}>
        <h2>Error Loading {typeLabel} Analytics</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!data) {
    return <div style={{ padding: '40px', color: '#6b7280', textAlign: 'center' }}>Loading {typeLabel} analytics…</div>;
  }

  const { totals, occasions } = data;

  if (!occasions || occasions.length === 0) {
    return (
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', padding: '80px 20px', textAlign: 'center', color: '#9ca3af' }}>
        <div style={{ fontSize: '4rem', marginBottom: '16px' }}>📅</div>
        <p style={{ fontSize: '1.1rem', fontWeight: '600', color: '#6b7280' }}>No {typeLabel} activations yet</p>
        <p style={{ fontSize: '0.9rem' }}>
          {typeLabel} contributions are occasional — activate one from the Contributions page when the need arises, and this page will track each drive separately.
        </p>
      </div>
    );
  }

  const latest = occasions[occasions.length - 1];
  const sel = occasions.find((o) => o.period === selected) || latest;
  const donut = [
    { name: 'Paid', value: sel.households.paid, color: STATUS_COLORS.paid },
    { name: 'Partial', value: sel.households.partial, color: STATUS_COLORS.partial },
    { name: 'Pending', value: sel.households.pending, color: STATUS_COLORS.pending },
  ].filter((d) => d.value > 0);

  const tableRows = [...occasions].reverse(); // newest first

  return (
    <>
      {/* KPI Cards — activation-centric */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <KPICard
          title={`Total Raised — ${typeLabel}`}
          value={naira(totals.all_time_collected)}
          subtitle={`${totals.occasions} activation${totals.occasions === 1 ? '' : 's'} · all-time`}
          color="indigo"
          icon="💰"
        />
        <KPICard
          title="Latest Activation"
          value={latest.label}
          subtitle={`${naira(latest.collected)} of ${naira(latest.expected)} collected`}
          color="emerald"
          icon="📅"
        />
        <KPICard
          title="Latest Collection Rate"
          value={latest.rate === null ? '—' : `${latest.rate}%`}
          subtitle={`${latest.households.paid}/${latest.households.total} households fully paid`}
          color="rose"
          icon="📈"
        />
        <KPICard
          title="Average Collection Rate"
          value={totals.avg_collection_rate === null ? '—' : `${totals.avg_collection_rate}%`}
          subtitle="Across all activations"
          color="amber"
          icon="🎯"
        />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        <ChartPanel
          title="Collections per Activation"
          subtitle="Expected vs collected per drive — click a bar to inspect it"
        >
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={occasions} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis
                dataKey="short"
                tick={{ fontSize: 12, fill: '#6b7280', fontWeight: '600' }}
                axisLine={false}
                tickLine={false}
                interval={0}
              />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={kFormatter} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.08)' }} />
              <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '13px', fontWeight: '500' }} />
              <Bar
                dataKey="expected"
                name="Expected"
                fill="#6366f1"
                fillOpacity={0.35}
                radius={[10, 10, 4, 4]}
                maxBarSize={60}
                onClick={(entry) => entry && entry.payload && setSelected(entry.payload.period)}
                cursor="pointer"
              />
              <Bar
                dataKey="collected"
                name="Collected"
                fill="#22c55e"
                radius={[10, 10, 4, 4]}
                maxBarSize={60}
                onClick={(entry) => entry && entry.payload && setSelected(entry.payload.period)}
                cursor="pointer"
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel
          title={`Household Status — ${sel.label}`}
          subtitle="Click bars in the chart beside to switch activation"
        >
          {donut.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={donut}
                  dataKey="value"
                  nameKey="name"
                  cx="45%"
                  cy="50%"
                  innerRadius={75}
                  outerRadius={110}
                  paddingAngle={3}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {donut.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip content={<CountTooltip />} />
                <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 12, fontWeight: '500' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: '1rem' }}>
              No households billed for {sel.label}
            </div>
          )}
        </ChartPanel>
      </div>

      {/* Activations table */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ padding: '24px 28px', borderBottom: '1px solid #e5e7eb', background: 'linear-gradient(to right, #f9fafb, #ffffff)' }}>
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: '#111827' }}>
            {typeLabel} Activations
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
            One row per activation — click any row to view household payment status
          </p>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={th('left')}>Activation</th>
                <th style={th('right')}>Expected</th>
                <th style={th('right')}>Collected</th>
                <th style={th('right')}>Outstanding</th>
                <th style={th('right')}>Collection %</th>
                <th style={th('right')}>Households</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((o) => {
                const isSelected = expanded === o.period;
                const rateColor = o.rate === null ? '#9ca3af' : o.rate >= 100 ? '#059669' : o.rate >= 50 ? '#d97706' : '#e11d48';
                const rateBg = o.rate === null ? '#f3f4f6' : o.rate >= 100 ? '#ecfdf5' : o.rate >= 50 ? '#fffbeb' : '#fff1f2';
                return (
                  <React.Fragment key={o.period}>
                    <tr
                      onClick={() => loadHouseholds(o.period)}
                      style={{
                        cursor: 'pointer',
                        background: isSelected ? '#f0fdf4' : 'transparent',
                        transition: 'background 0.2s ease',
                      }}
                      onMouseEnter={(e) => !isSelected && (e.currentTarget.style.background = '#f9fafb')}
                      onMouseLeave={(e) => !isSelected && (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ ...td('left'), color: '#111827', fontWeight: isSelected ? '700' : '600' }}>{o.label}</td>
                      <td style={{ ...td('right'), color: '#111827' }}>{naira(o.expected)}</td>
                      <td style={{ ...td('right'), color: '#059669' }}>{naira(o.collected)}</td>
                      <td style={{ ...td('right'), color: o.outstanding > 0 ? '#e11d48' : '#9ca3af' }}>{naira(o.outstanding)}</td>
                      <td style={{ ...td('right'), textAlign: 'right' }}>
                        <span style={{
                          display: 'inline-block', padding: '6px 14px', background: rateBg,
                          color: rateColor, borderRadius: '8px', fontSize: '0.9rem', fontWeight: '700',
                          fontVariantNumeric: 'tabular-nums',
                        }}>
                          {o.rate === null ? '—' : `${o.rate}%`}
                        </span>
                      </td>
                      <td style={{ ...td('right'), color: '#6b7280' }}>
                        {o.households.paid}/{o.households.total} paid
                        {o.households.partial > 0 ? ` · ${o.households.partial} partial` : ''}
                        {o.households.pending > 0 ? ` · ${o.households.pending} pending` : ''}
                      </td>
                    </tr>

                    {isSelected && (
                      <tr>
                        <td colSpan="6" style={{ padding: 0, background: '#f0fdf4' }}>
                          <div style={{ padding: '24px' }}>
                            {loadingRows ? (
                              <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>Loading households…</div>
                            ) : rows?.error ? (
                              <div style={{ textAlign: 'center', padding: '20px', color: '#ef4444' }}>Error loading households: {rows.error}</div>
                            ) : rows && rows.length > 0 ? (
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
                            ) : (
                              <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af' }}>
                                <p style={{ fontSize: '0.95rem', fontWeight: '500' }}>No households billed for {o.label}</p>
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
      </div>
    </>
  );
}
