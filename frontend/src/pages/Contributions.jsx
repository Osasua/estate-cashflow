import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { naira } from '../format';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const CONTRIBUTION_TYPES = [
  { id: 'monthly', label: 'Monthly' },
  { id: 'float', label: 'Float' },
  { id: 'projects', label: 'Projects' },
  { id: 'end-of-year', label: 'End of Year' },
  { id: 'welfare', label: 'Welfare' },
];

// ✅ Unified KPI Card Style
const kpiStyle = (color) => ({
  background: '#fff',
  padding: '20px 24px',
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
  borderLeft: `4px solid ${color}`,
  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
});

export default function Contributions() {
  const { user } = useAuth();
  const staff = ['admin', 'treasurer'].includes(user?.role);
  const now = new Date();

  const [type, setType] = useState('monthly');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [rows, setRows] = useState([]);
  const [onlyDefaulters, setOnlyDefaulters] = useState(false);
  const [paying, setPaying] = useState(null);
  const [form, setForm] = useState({ amount: '', method: 'cash', reference: '' });
  const [message, setMessage] = useState('');
  const [billAmount, setBillAmount] = useState('');

  const load = () =>
    api(`/contributions?month=${month}&year=${year}&type=${type}`)
      .then((d) => setRows(d.contributions))
      .catch((e) => setMessage(e.message));

  useEffect(() => { load(); }, [month, year, type]);

  const generate = async (amount) => {
    const res = await api('/contributions/generate', { method: 'POST', body: { month, year, type, amount } });
    setMessage(`${res.generated} bill(s) generated for ${MONTHS[month - 1]} ${year}.`);
    load();
  };

  const recordPayment = async (e) => {
    e.preventDefault();
    const res = await api('/contributions/payments', {
      method: 'POST',
      body: {
        member_id: paying.member_id, month, year, type,
        amount: Number(form.amount), method: form.method,
        reference: form.reference || undefined,
      },
    });
    setMessage(res.queued ? 'Saved offline — will sync when you are back online.' : 'Payment recorded.');
    setPaying(null);
    setForm({ amount: '', method: 'cash', reference: '' });
    load();
  };

  const filtered = onlyDefaulters ? rows.filter((r) => r.status !== 'paid') : rows;
  const collected = rows.reduce((s, r) => s + Number(r.amount_paid), 0);
  const expected = rows.reduce((s, r) => s + Number(r.amount_due), 0);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px 0' }}>
      <h1 style={{ margin: '0 0 24px 0', fontSize: '1.5rem', fontWeight: '600', color: '#1f2937' }}>
        {type === 'end-of-year' ? 'End of Year' : type.charAt(0).toUpperCase() + type.slice(1)} Contributions
      </h1>
      
      {/* Clean Tab Navigation */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', borderBottom: '2px solid #e5e7eb' }}>
        {CONTRIBUTION_TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => setType(t.id)}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontWeight: type === t.id ? '600' : '400',
              borderBottom: type === t.id ? '3px solid #4f46e5' : '3px solid transparent',
              color: type === t.id ? '#4f46e5' : '#6b7280',
              transition: 'all 0.2s'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ background: '#fff', padding: '16px 20px', borderRadius: '8px', border: '1px solid #e5e7eb', marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Month</label>
          <select value={month} onChange={(e) => setMonth(+e.target.value)} style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', minWidth: '120px' }}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Year</label>
          <input type="number" value={year} onChange={(e) => setYear(+e.target.value)} style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', width: '90px' }} />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Custom Amount (Optional)</label>
          <input 
            type="number" 
            placeholder="Leave blank for default" 
            value={billAmount} 
            onChange={(e) => setBillAmount(e.target.value)} 
            style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', width: '180px' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', height: '38px', marginBottom: '2px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem', color: '#374151', userSelect: 'none' }}>
            <input type="checkbox" checked={onlyDefaulters} onChange={(e) => setOnlyDefaulters(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#4f46e5' }} />
            Defaulters only
          </label>
        </div>
        {staff && (
          <button 
            onClick={() => generate(billAmount)} 
            style={{ padding: '8px 20px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', fontSize: '0.875rem', height: '38px' }}
          >
            Generate Bills
          </button>
        )}
      </div>

      {/* ✅ Unified KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={kpiStyle('#4f46e5')}>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px', fontWeight: '500' }}>Expected</div>
          <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#111827' }}>{naira(expected)}</div>
        </div>
        <div style={kpiStyle('#10b981')}>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px', fontWeight: '500' }}>Collected</div>
          <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#111827' }}>{naira(collected)}</div>
        </div>
        <div style={kpiStyle('#ef4444')}>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px', fontWeight: '500' }}>Outstanding</div>
          <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#111827' }}>{naira(expected - collected)}</div>
        </div>
      </div>

      {/* Payment Recording Form */}
      {paying && (
        <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '20px', marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: '600', color: '#1f2937' }}>
            Record Payment: {paying.house_number} — {paying.household_name}
          </h3>
          <form onSubmit={recordPayment} style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Amount</label>
              <input 
                placeholder="Amount ₦" 
                type="number" 
                min="1" 
                value={form.amount} 
                required 
                autoFocus
                onChange={(e) => setForm({ ...form, amount: e.target.value })} 
                style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', width: '150px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Method</label>
              <select 
                value={form.method} 
                onChange={(e) => setForm({ ...form, method: e.target.value })}
                style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', width: '150px' }}
              >
                <option value="cash">Cash</option>
                <option value="transfer">Bank Transfer</option>
                <option value="paystack">Paystack</option>
                <option value="flutterwave">Flutterwave</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Reference (Optional)</label>
              <input 
                placeholder="Reference" 
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })} 
                style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', width: '200px' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" style={{ padding: '8px 20px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', fontSize: '0.875rem', height: '38px' }}>
                Save Payment
              </button>
              <button type="button" onClick={() => setPaying(null)} style={{ padding: '8px 20px', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', fontSize: '0.875rem', height: '38px' }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {message && (
        <div style={{ 
          padding: '12px 16px', 
          background: message.includes('generated') || message.includes('recorded') ? '#f0fdf4' : '#fef2f2', 
          color: message.includes('generated') || message.includes('recorded') ? '#166534' : '#991b1b', 
          borderRadius: '6px', 
          marginBottom: '24px', 
          fontSize: '0.875rem',
          border: `1px solid ${message.includes('generated') || message.includes('recorded') ? '#bbf7d0' : '#fecaca'}`
        }}>
          {message}
        </div>
      )}

      {/* Clean Table */}
      <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#f9fafb' }}>
              <tr>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>House</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Household</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Due</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Paid</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Status</th>
                {staff && <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, idx) => (
                <tr key={r.id} style={{ borderBottom: idx !== filtered.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                  <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#374151' }}>{r.house_number}</td>
                  <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#1f2937', fontWeight: '500' }}>{r.household_name}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.875rem', color: '#1f2937' }}>{naira(r.amount_due)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.875rem', color: '#1f2937' }}>{naira(r.amount_paid)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span style={{ 
                      padding: '4px 12px', 
                      borderRadius: '12px', 
                      fontSize: '0.75rem', 
                      fontWeight: '600', 
                      background: r.status === 'paid' ? '#dcfce7' : '#fee2e2', 
                      color: r.status === 'paid' ? '#166534' : '#991b1b' 
                    }}>
                      {r.status}
                    </span>
                  </td>
                  {staff && (
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {r.status !== 'paid' && (
                        <button 
                          className="btn-ghost" 
                          onClick={() => setPaying(r)} 
                          style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', color: '#374151' }}
                        >
                          Record Payment
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={staff ? 6 : 5} style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
                    No bills found for this period — click "Generate Bills" to create them.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}