import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { naira } from '../format';
import { POWERED_BY } from '../brand';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const FUND_LABEL = { monthly: 'Monthly', float: 'Float', projects: 'Projects', 'end-of-year': 'End of Year', welfare: 'Welfare', arrears: 'Arrears' };

const th = { padding: '10px 14px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid #111827' };
const thr = { ...th, textAlign: 'right' };
const td = { padding: '10px 14px', fontSize: '0.9rem', color: '#111827', borderBottom: '1px solid #e5e7eb' };
const tdr = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };

/**
 * Resident's own statement — the complete payment record for the household.
 * "Download PDF" uses the browser print dialog (Save as PDF); the print CSS
 * in styles.css strips the app chrome so only the statement prints.
 */
export default function Statement() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/my-account/statement')
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return <div style={{ padding: '40px', color: '#ef4444', textAlign: 'center' }}><h2>Statement unavailable</h2><p>{error}</p></div>;
  }
  if (!data) return <div style={{ padding: '40px', color: '#6b7280' }}>Loading statement…</div>;

  const { member, payments, outstanding, next_bill, generated_at } = data;
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const totalOwing = outstanding.reduce((s, o) => s + o.outstanding, 0);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '2rem', fontWeight: '700', color: '#111827' }}>My Statement</h1>
          <p style={{ margin: 0, color: '#6b7280' }}>Your household's complete payment record</p>
        </div>
        <button
          onClick={() => window.print()}
          style={{ padding: '12px 24px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '0.95rem' }}
        >
          ⬇ Download PDF
        </button>
      </div>

      {/* Statement body (this is what prints) */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '32px' }} id="statement-print">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #111827', paddingBottom: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#111827' }}>Ferrano Court Estate</div>
            <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>Resident Payment Statement</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.9rem', color: '#374151' }}>
            <div style={{ fontWeight: '700' }}>{member.household_name}</div>
            <div>House {member.house_number}</div>
            <div style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Generated {new Date(generated_at).toLocaleDateString()}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px', padding: '14px' }}>
            <div style={{ fontSize: '0.75rem', color: '#065f46', fontWeight: '700', textTransform: 'uppercase' }}>Total Paid</div>
            <div style={{ fontSize: '1.3rem', fontWeight: '800', color: '#059669' }}>{naira(totalPaid)}</div>
          </div>
          <div style={{ background: totalOwing > 0 ? '#fee2e2' : '#f3f4f6', border: `1px solid ${totalOwing > 0 ? '#fecaca' : '#e5e7eb'}`, borderRadius: '10px', padding: '14px' }}>
            <div style={{ fontSize: '0.75rem', color: totalOwing > 0 ? '#991b1b' : '#374151', fontWeight: '700', textTransform: 'uppercase' }}>Outstanding</div>
            <div style={{ fontSize: '1.3rem', fontWeight: '800', color: totalOwing > 0 ? '#e11d48' : '#374151' }}>{naira(totalOwing)}</div>
          </div>
          <div style={{ background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: '10px', padding: '14px' }}>
            <div style={{ fontSize: '0.75rem', color: '#3730a3', fontWeight: '700', textTransform: 'uppercase' }}>Next Bill</div>
            <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#4f46e5' }}>
              {MONTHS[new Date(next_bill.date).getMonth()]} {new Date(next_bill.date).getDate()}, {new Date(next_bill.date).getFullYear()}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{naira(next_bill.amount)} · Monthly</div>
          </div>
        </div>

        {outstanding.length > 0 && (
          <>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', fontWeight: '700', color: '#111827' }}>Outstanding Bills</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
              <thead>
                <tr><th style={th}>Period</th><th style={th}>Fund</th><th style={thr}>Due</th><th style={thr}>Paid</th><th style={thr}>Owing</th></tr>
              </thead>
              <tbody>
                {outstanding.map((o) => (
                  <tr key={o.id}>
                    <td style={td}>{MONTHS[o.period_month - 1]} {o.period_year}</td>
                    <td style={td}>{FUND_LABEL[o.fund] || o.fund}</td>
                    <td style={tdr}>{naira(o.amount_due)}</td>
                    <td style={tdr}>{naira(o.amount_paid)}</td>
                    <td style={{ ...tdr, fontWeight: '700', color: '#e11d48' }}>{naira(o.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', fontWeight: '700', color: '#111827' }}>Payment History</h3>
        {payments.length === 0 ? (
          <p style={{ color: '#9ca3af' }}>No payments recorded yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr><th style={th}>Date</th><th style={th}>Period</th><th style={th}>Fund</th><th style={th}>Method</th><th style={th}>Reference</th><th style={thr}>Amount</th></tr>
            </thead>
            <tbody>
              {payments.map((p, i) => (
                <tr key={i}>
                  <td style={td}>{new Date(p.paid_at).toLocaleDateString()}</td>
                  <td style={td}>{MONTHS[p.period_month - 1]} {p.period_year}</td>
                  <td style={td}>{FUND_LABEL[p.fund] || p.fund}</td>
                  <td style={td}>{String(p.method || '').replace('_', ' ')}</td>
                  <td style={{ ...td, color: '#6b7280', fontSize: '0.8rem' }}>{p.reference || '—'}</td>
                  <td style={{ ...tdr, fontWeight: '700', color: '#059669' }}>{naira(p.amount)}</td>
                </tr>
              ))}
              <tr>
                <td colSpan="5" style={{ ...td, textAlign: 'right', fontWeight: '800', borderTop: '2px solid #111827' }}>TOTAL PAID</td>
                <td style={{ ...tdr, fontWeight: '800', borderTop: '2px solid #111827' }}>{naira(totalPaid)}</td>
              </tr>
            </tbody>
          </table>
        )}

        <p style={{ marginTop: '24px', fontSize: '0.75rem', color: '#9ca3af' }}>
          This statement was generated electronically by the Ferrano Court Portal for {member.household_name} (House {member.house_number}).
          Questions? Contact the estate treasurer.
        </p>
        <div className="powered-by">{POWERED_BY}</div>
      </div>
    </div>
  );
}
