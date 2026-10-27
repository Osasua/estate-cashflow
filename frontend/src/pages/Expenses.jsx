import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { naira, fmtDate } from '../format';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { KPICard, ChartPanel, CustomTooltip, COLORS as DASH_COLORS } from '../components/dashboard/shared';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Contribution funds an expense can be charged to (mirrors dashboard tabs)
const FUND_TYPES = [
  { key: 'monthly', label: 'Monthly' },
  { key: 'float', label: 'Float' },
  { key: 'projects', label: 'Projects' },
  { key: 'end-of-year', label: 'End of Year' },
  { key: 'welfare', label: 'Welfare' },
];
const FUND_LABEL = FUND_TYPES.reduce((m, t) => ({ ...m, [t.key]: t.label }), {});
const FUND_GRADIENTS = {
  monthly: ['#6366f1', '#8b5cf6'],
  float: ['#06b6d4', '#3b82f6'],
  projects: ['#a855f7', '#6366f1'],
  'end-of-year': ['#f59e0b', '#fbbf24'],
  welfare: ['#10b981', '#22c55e'],
};
const FUND_COLORS = {
  monthly: { bg: '#eef2ff', text: '#4f46e5' },
  float: { bg: '#ecfeff', text: '#0891b2' },
  projects: { bg: '#f5f3ff', text: '#7c3aed' },
  'end-of-year': { bg: '#fffbeb', text: '#d97706' },
  welfare: { bg: '#ecfdf5', text: '#059669' },
};

export default function Expenses() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [form, setForm] = useState({
    date: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`,
    description: '',
    vendor: '',
    category_id: '',
    amount: '',
    receipt: null,
    type: 'monthly',
  });
  const [loading, setLoading] = useState(false);
  const [fundFilter, setFundFilter] = useState('all');
  const [range, setRange] = useState([]);
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Reset to page 1 when month/year changes
  useEffect(() => { setCurrentPage(1); }, [month, year, fundFilter]);

  // Update form date to 1st of selected month when month/year changes (only if not editing)
  useEffect(() => {
    if (!editingId) {
      const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
      setForm(prev => ({ ...prev, date: firstDay }));
    }
  }, [month, year]);

  useEffect(() => {
    loadExpenses();
    loadCategories();
  }, [month, year]);

  const loadExpenses = async () => {
    try {
      const pad = (n) => String(n).padStart(2, '0');
      const startD = new Date(year, month - 6, 1);
      const endD = new Date(year, month, 0);
      const from = `${startD.getFullYear()}-${pad(startD.getMonth() + 1)}-${pad(startD.getDate())}`;
      const to = `${endD.getFullYear()}-${pad(endD.getMonth() + 1)}-${pad(endD.getDate())}`;
      const [data, rangeData] = await Promise.all([
        api(`/expenses?month=${month}&year=${year}`),
        api(`/expenses?from=${from}&to=${to}`),
      ]);
      setExpenses(data.expenses || []);
      setRange(rangeData.expenses || []);
    } catch (e) {
      setMessage(e.message);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await api('/expenses/categories');
      setCategories(data.categories || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (editingId) {
        // Update - send as JSON
        await api(`/expenses/${editingId}`, {
          method: 'PUT',
          body: {
            spent_on: form.date,
            description: form.description,
            vendor: form.vendor,
            category_id: form.category_id,
            amount: Number(form.amount),
            type: form.type,
          },
        });
        setMessage('✅ Expense updated successfully');
      } else {
        // Create - send as FormData (supports file upload)
        const formData = new FormData();
        formData.append('date', form.date);
        formData.append('description', form.description);
        formData.append('vendor', form.vendor);
        formData.append('category_id', form.category_id);
        formData.append('type', form.type);
        formData.append('amount', form.amount);
        if (form.receipt) {
          formData.append('receipt', form.receipt);
        }

        await api('/expenses', {
          method: 'POST',
          body: formData,
          headers: {},
        });
        setMessage('✅ Expense recorded successfully');
      }

      // Reset form to 1st of currently selected month
      const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
      setForm({
        date: firstDay,
        description: '',
        vendor: '',
        category_id: '',
        amount: '',
        receipt: null,
        type: 'monthly',
      });
      setEditingId(null);
      loadExpenses();
    } catch (e) {
      setMessage(`❌ ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (expense) => {
  // Normalize date to YYYY-MM-DD format (HTML date input is strict about this)
  const rawDate = expense.spent_on;
  const normalizedDate = rawDate 
    ? new Date(rawDate).toISOString().split('T')[0] 
    : new Date().toISOString().split('T')[0];

  setEditingId(expense.id);
  setForm({
    date: normalizedDate,
    description: expense.description,
    vendor: expense.vendor || '',
    category_id: expense.category_id,
    amount: expense.amount.toString(),
    receipt: null,
    type: expense.type || 'monthly',
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this expense? This cannot be undone.')) return;
    try {
      await api(`/expenses/${id}`, { method: 'DELETE' });
      setMessage('✅ Expense deleted');
      loadExpenses();
    } catch (e) {
      setMessage(`❌ ${e.message}`);
    }
  };

  const filteredExpenses = fundFilter === 'all'
    ? expenses
    : expenses.filter((e) => (e.type || 'monthly') === fundFilter);
  const totalSpent = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  // --- analytics (client-side, honouring the fund filter) ---
  const inFund = (r) => fundFilter === 'all' || (r.type || 'monthly') === fundFilter;
  const trendData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(year, month - 1 - (5 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const total = range
      .filter((r) => (r.spent_on || '').slice(0, 7) === key && inFund(r))
      .reduce((s2, r) => s2 + Number(r.amount), 0);
    return { short: d.toLocaleDateString('en-US', { month: 'short' }), total };
  });
  const prevTotal = trendData.length > 1 ? trendData[trendData.length - 2].total : 0;
  const prevLabel = (() => {
    const d = new Date(year, month - 2, 1);
    return d.toLocaleDateString('en-US', { month: 'short' });
  })();
  const catData = Object.entries(
    filteredExpenses.reduce((m2, e) => {
      const k = e.category || 'Uncategorized';
      m2[k] = (m2[k] || 0) + Number(e.amount);
      return m2;
    }, {})
  ).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
  const topCat = catData[0] || null;
  const avgPerTxn = filteredExpenses.length ? totalSpent / filteredExpenses.length : 0;
  const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedExpenses = filteredExpenses.slice(startIndex, endIndex);

  // The form wears the colour of the fund it will charge
  const accent = FUND_COLORS[form.type] || FUND_COLORS.monthly;
  const accentGrad = FUND_GRADIENTS[form.type] || FUND_GRADIENTS.monthly;
  const fieldBase = {
    width: '100%', padding: '10px 12px', border: '1px solid #d1d5db',
    borderRadius: '8px', fontSize: '0.9rem', boxSizing: 'border-box',
    background: '#fff', transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  };
  const focusOn = (e) => { e.target.style.borderColor = accent.text; e.target.style.boxShadow = `0 0 0 3px ${accent.text}22`; };
  const focusOff = (e) => { e.target.style.borderColor = '#d1d5db'; e.target.style.boxShadow = 'none'; };
  const FieldLabel = ({ icon, children }) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontWeight: '600', color: '#374151', fontSize: '0.85rem' }}>
      <span style={{ fontSize: '0.95rem' }}>{icon}</span>{children}
    </label>
  );

  const kpiStyle = (color) => ({
    background: '#fff',
    padding: '20px 24px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    borderLeft: `4px solid ${color}`,
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  });

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px 0' }}>
      <h1 style={{ margin: '0 0 24px 0', fontSize: '1.5rem', fontWeight: '600', color: '#1f2937' }}>
        Expenses
      </h1>

      {/* Month/Year Selector */}
      <div style={{ background: '#fff', padding: '20px 24px', borderRadius: '16px', border: '1px solid #e5e7eb', borderTop: '4px solid #6366f1', marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>📅 Month</label>
          <select value={month} onChange={(e) => setMonth(+e.target.value)} style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', minWidth: '120px' }}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>🗓️ Year</label>
          <input type="number" value={year} onChange={(e) => setYear(+e.target.value)} style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', width: '90px' }} />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>🏦 Fund</label>
          <select value={fundFilter} onChange={(e) => setFundFilter(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', minWidth: '140px' }}>
            <option value="all">All funds</option>
            {FUND_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <KPICard
          title="Total Spent"
          value={naira(totalSpent)}
          subtitle={`${MONTHS[month - 1]} ${year}${fundFilter !== 'all' ? ` · ${FUND_LABEL[fundFilter]}` : ''} · vs ${naira(prevTotal)} in ${prevLabel}`}
          color="rose"
          icon="💰"
        />
        <KPICard
          title="Transactions"
          value={filteredExpenses.length}
          subtitle={`receipts in ${MONTHS[month - 1]} ${year}`}
          color="emerald"
          icon="🧾"
        />
        <KPICard
          title="Avg per Transaction"
          value={naira(avgPerTxn)}
          subtitle="mean receipt value"
          color="indigo"
          icon="📊"
        />
        <KPICard
          title="Top Category"
          value={topCat ? topCat.name : '—'}
          subtitle={topCat ? `${naira(topCat.total)} · ${(totalSpent > 0 ? ((topCat.total / totalSpent) * 100).toFixed(0) : 0)}% of spend` : 'no expenses this month'}
          color="amber"
          icon="🏷️"
        />
      </div>

      {/* Analytics charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        <ChartPanel
          title="Spending Trend"
          subtitle={`Last 6 months${fundFilter !== 'all' ? ` · ${FUND_LABEL[fundFilter]} fund` : ''}`}
        >
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={trendData} margin={{ top: 20, right: 30, left: 0, bottom: 40 }}>
              <defs>
                <linearGradient id="expTrendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity={1} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.8} />
                </linearGradient>
                <filter id="expTrendShadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#ef4444" floodOpacity="0.3"/>
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis
                dataKey="short"
                tick={{ fontSize: 13, fill: '#6b7280', fontWeight: '700' }}
                axisLine={false}
                tickLine={false}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={50}
              />
              <YAxis tick={{ fontSize: 12, fill: '#9ca3af', fontWeight: '600' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `₦${(v/1000).toFixed(0)}k` : `₦${v}`} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(239, 68, 68, 0.08)', radius: 8 }} />
              <Bar dataKey="total" name="Spent" radius={[16, 16, 8, 8]} maxBarSize={70} animationDuration={1200} animationEasing="ease-out">
                {trendData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill="url(#expTrendGrad)" filter="url(#expTrendShadow)" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel
          title="Spending by Category"
          subtitle={`${MONTHS[month - 1]} ${year}${fundFilter !== 'all' ? ` · ${FUND_LABEL[fundFilter]} fund` : ''}`}
        >
          {catData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={catData}
                  dataKey="total"
                  nameKey="name"
                  cx="45%"
                  cy="50%"
                  innerRadius={75}
                  outerRadius={110}
                  paddingAngle={3}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {catData.map((_, i) => <Cell key={i} fill={DASH_COLORS[i % DASH_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 12, fontWeight: '500' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: '1rem' }}>
              No expenses recorded this month
            </div>
          )}
        </ChartPanel>
      </div>

      {/* Form — accented by the selected fund */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', borderTop: `4px solid ${accent.text}`, padding: '24px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: accent.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>🧾</div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: '#111827' }}>
              {editingId ? 'Edit Expense' : 'Record New Expense'}
            </h2>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: '#6b7280' }}>
              Charged to <strong style={{ color: accent.text }}>{FUND_LABEL[form.type] || form.type}</strong> — the form wears the fund's colour
            </p>
          </div>
        </div>

        {message && (
          <div style={{
            padding: '10px 14px',
            background: message.includes('✅') ? '#f0fdf4' : '#fef2f2',
            color: message.includes('✅') ? '#166534' : '#991b1b',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '0.875rem',
          }}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            <div>
              <FieldLabel icon="📅">Date</FieldLabel>
              <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} onFocus={focusOn} onBlur={focusOff} style={fieldBase} />
            </div>
            <div>
              <FieldLabel icon="🏷️">Category</FieldLabel>
              <select required value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} onFocus={focusOn} onBlur={focusOff} style={fieldBase}>
                <option value="">Select category</option>
                {categories.filter(c => c.is_active !== false).map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel icon="🏦">Funded From</FieldLabel>
              <select required value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} onFocus={focusOn} onBlur={focusOff} style={{ ...fieldBase, borderColor: accent.text, background: accent.bg }}>
                {FUND_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel icon="💵">Amount</FieldLabel>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: accent.text, fontWeight: '700', fontSize: '0.95rem', pointerEvents: 'none' }}>₦</span>
                <input type="number" required min="1" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} onFocus={focusOn} onBlur={focusOff} placeholder="0.00" style={{ ...fieldBase, paddingLeft: '30px', fontWeight: '600' }} />
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <FieldLabel icon="📝">Description</FieldLabel>
            <input type="text" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} onFocus={focusOn} onBlur={focusOff} placeholder="What was this expense for?" style={fieldBase} />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <FieldLabel icon="🤝">Vendor (Optional)</FieldLabel>
            <input type="text" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} onFocus={focusOn} onBlur={focusOff} placeholder="Who received the payment?" style={fieldBase} />
          </div>

          {!editingId && (
            <div style={{ marginBottom: '16px' }}>
              <FieldLabel icon="📎">Receipt (Optional)</FieldLabel>
              <input type="file" accept="image/*,.pdf" onChange={(e) => setForm({ ...form, receipt: e.target.files[0] })} style={{ ...fieldBase, padding: '8px 12px', color: '#6b7280' }} />
            </div>
          )}

          <div style={{ textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            {editingId && (
              <button type="button" onClick={() => {
                setEditingId(null);
                const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
                setForm({ date: firstDay, description: '', vendor: '', category_id: '', amount: '', receipt: null, type: 'monthly' });
              }} style={{ padding: '10px 24px', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer', fontWeight: '500', fontSize: '0.875rem' }}>
                Cancel
              </button>
            )}
            <button type="submit" disabled={loading} style={{ padding: '10px 24px', background: `linear-gradient(135deg, ${accentGrad[0]} 0%, ${accentGrad[1]} 100%)`, color: 'white', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '0.875rem', boxShadow: `0 4px 14px ${accent.text}44`, opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Saving...' : (editingId ? 'Update Expense' : 'Record Expense')}
            </button>
          </div>
        </form>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', borderTop: '4px solid #6366f1', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #e5e7eb', background: 'linear-gradient(to right, #eef2ff, #ffffff)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ffffff', border: '1px solid #e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>🧾</div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '600', color: '#111827' }}>Expenses for {MONTHS[month - 1]} {year}</h2>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#6b7280' }}>
              {filteredExpenses.length} transaction{filteredExpenses.length === 1 ? '' : 's'} · {naira(totalSpent)}{fundFilter !== 'all' ? ` · ${FUND_LABEL[fundFilter]} fund` : ''}
            </p>
          </div>
        </div>

        {expenses.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            No expenses found for {MONTHS[month - 1]} {year}
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#eef2ff' }}>
                  <tr>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', color: '#4f46e5', textTransform: 'uppercase' }}>Date</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', color: '#4f46e5', textTransform: 'uppercase' }}>Description</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', color: '#4f46e5', textTransform: 'uppercase' }}>Category</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', color: '#4f46e5', textTransform: 'uppercase' }}>Fund</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', color: '#4f46e5', textTransform: 'uppercase' }}>Vendor</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '700', color: '#4f46e5', textTransform: 'uppercase' }}>Amount</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '700', color: '#4f46e5', textTransform: 'uppercase' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedExpenses.map((expense, idx) => {
                    const category = categories.find(c => c.id === expense.category_id);
                    return (
                      <tr key={expense.id} style={{ borderBottom: idx !== paginatedExpenses.length - 1 ? '1px solid #f3f4f6' : 'none', background: idx % 2 === 1 ? '#f9fafb' : '#fff', transition: 'background 0.15s ease' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#eef2ff'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = idx % 2 === 1 ? '#f9fafb' : '#fff'; }}>
                        <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#374151' }}>{fmtDate(expense.spent_on)}</td>
                        <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#111827', fontWeight: '600' }}>{expense.description}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ display: 'inline-block', padding: '4px 12px', background: DASH_COLORS[(expense.category_id || 0) % DASH_COLORS.length] + '18', color: DASH_COLORS[(expense.category_id || 0) % DASH_COLORS.length], borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600' }}>
                            {category?.name || expense.category_id}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ display: 'inline-block', padding: '3px 10px', background: (FUND_COLORS[expense.type || 'monthly'] || FUND_COLORS.monthly).bg, color: (FUND_COLORS[expense.type || 'monthly'] || FUND_COLORS.monthly).text, borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600' }}>
                            {FUND_LABEL[expense.type || 'monthly'] || expense.type}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#9ca3af', fontStyle: 'italic' }}>{expense.vendor || '—'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.9rem', fontWeight: '700', color: '#e11d48', fontVariantNumeric: 'tabular-nums' }}>{naira(expense.amount)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button onClick={() => handleEdit(expense)} style={{ padding: '4px 10px', background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', marginRight: '6px' }}>Edit</button>
                          <button onClick={() => handleDelete(expense.id)} style={{ padding: '4px 10px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>Delete</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ padding: '12px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9fafb' }}>
                <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                  {startIndex + 1}-{Math.min(endIndex, filteredExpenses.length)} of {filteredExpenses.length}
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ padding: '6px 12px', border: '1px solid #d1d5db', background: currentPage === 1 ? '#f3f4f6' : '#fff', color: currentPage === 1 ? '#9ca3af' : '#374151', borderRadius: '4px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontSize: '0.875rem' }}>Previous</button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) pageNum = i + 1;
                    else if (currentPage <= 3) pageNum = i + 1;
                    else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = currentPage - 2 + i;
                    return (
                      <button key={pageNum} onClick={() => setCurrentPage(pageNum)} style={{ padding: '6px 12px', border: '1px solid #d1d5db', background: currentPage === pageNum ? '#4f46e5' : '#fff', color: currentPage === pageNum ? '#fff' : '#374151', borderRadius: '4px', cursor: 'pointer', fontSize: '0.875rem' }}>{pageNum}</button>
                    );
                  })}
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ padding: '6px 12px', border: '1px solid #d1d5db', background: currentPage === totalPages ? '#f3f4f6' : '#fff', color: currentPage === totalPages ? '#9ca3af' : '#374151', borderRadius: '4px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontSize: '0.875rem' }}>Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}