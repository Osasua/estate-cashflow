import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { naira, fmtDate } from '../format';

const CATEGORIES = [
  { id: 'cleaning', name: 'Cleaning', color: '#6b7280' },
  { id: 'electricity', name: 'Electricity', color: '#6b7280' },
  { id: 'fuel', name: 'Fuel & Diesel', color: '#6b7280' },
  { id: 'gardening', name: 'Gardening', color: '#6b7280' },
  { id: 'miscellaneous', name: 'Miscellaneous', color: '#6b7280' },
  { id: 'repairs', name: 'Repairs & Maintenance', color: '#6b7280' },
  { id: 'security', name: 'Security', color: '#6b7280' },
  { id: 'waste', name: 'Waste Management', color: '#6b7280' },
  { id: 'water', name: 'Water', color: '#6b7280' },
];

export default function Expenses() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    vendor: '',
    category_id: '',
    amount: '',
    receipt: null,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    loadExpenses();
    loadCategories();
  }, [dateRange]);

  useEffect(() => {
    setCurrentPage(1);
  }, [dateRange]);

  const loadExpenses = async () => {
    try {
      const data = await api(`/expenses?start=${dateRange.start}&end=${dateRange.end}`);
      setExpenses(data.expenses || []);
    } catch (e) {
      setMessage(e.message);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await api('/categories');
      setCategories(data.categories || CATEGORIES);
    } catch (e) {
      setCategories(CATEGORIES);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const formData = new FormData();
      formData.append('date', form.date);
      formData.append('description', form.description);
      formData.append('vendor', form.vendor);
      formData.append('category_id', form.category_id);
      formData.append('amount', form.amount);
      if (form.receipt) {
        formData.append('receipt', form.receipt);
      }

      await api('/expenses', {
        method: 'POST',
        body: formData,
        headers: {},
      });

      setMessage('Expense recorded successfully');
      setForm({
        date: new Date().toISOString().split('T')[0],
        description: '',
        vendor: '',
        category_id: '',
        amount: '',
        receipt: null,
      });
      loadExpenses();
    } catch (e) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  };

  const totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const thisMonth = expenses
    .filter((e) => {
      const d = new Date(e.spent_on);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const quickDates = [
    { label: 'Today', start: new Date().toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] },
    { label: 'This Week', start: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] },
    { label: 'This Month', start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] },
  ];

  const totalPages = Math.ceil(expenses.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedExpenses = expenses.slice(startIndex, endIndex);

  // ✅ Colored left-border KPI style (matching My Account)
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
      <h1 style={{ margin: '0 0 24px 0', fontSize: '1.5rem', fontWeight: '600', color: '#1f2937' }}>Expenses</h1>

      {/* ✅ Updated: Colored left-border KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={kpiStyle('#ef4444')}>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px', fontWeight: '500' }}>Total Spent (Selected Period)</div>
          <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#111827' }}>{naira(totalSpent)}</div>
        </div>
        <div style={kpiStyle('#4f46e5')}>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px', fontWeight: '500' }}>This Month</div>
          <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#111827' }}>{naira(thisMonth)}</div>
        </div>
        <div style={kpiStyle('#10b981')}>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px', fontWeight: '500' }}>Total Transactions</div>
          <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#111827' }}>{expenses.length}</div>
        </div>
      </div>

      {/* Simple Date Filter */}
      <div style={{ background: '#fff', padding: '16px 20px', borderRadius: '8px', border: '1px solid #e5e7eb', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
          {quickDates.map((qd) => (
            <button
              key={qd.label}
              onClick={() => setDateRange({ start: qd.start, end: qd.end })}
              style={{
                padding: '6px 12px',
                border: '1px solid #e5e7eb',
                background: '#fff',
                color: '#374151',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              {qd.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.875rem' }}
          />
          <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>to</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.875rem' }}
          />
        </div>
      </div>

      {/* Clean Form */}
      <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '24px', marginBottom: '24px' }}>
        <h2 style={{ margin: '0 0 20px 0', fontSize: '1rem', fontWeight: '600', color: '#1f2937' }}>Record New Expense</h2>
        
        {message && (
          <div style={{
            padding: '10px 14px',
            background: message.includes('successfully') ? '#f0fdf4' : '#fef2f2',
            color: message.includes('successfully') ? '#166534' : '#991b1b',
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
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#374151', fontSize: '0.875rem' }}>Date</label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.875rem', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#374151', fontSize: '0.875rem' }}>Category</label>
              <select
                required
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.875rem', boxSizing: 'border-box' }}
              >
                <option value="">Select category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#374151', fontSize: '0.875rem' }}>Amount</label>
              <input
                type="number"
                required
                min="1"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0.00"
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.875rem', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#374151', fontSize: '0.875rem' }}>Description</label>
            <input
              type="text"
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What was this expense for?"
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.875rem', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#374151', fontSize: '0.875rem' }}>Vendor (Optional)</label>
            <input
              type="text"
              value={form.vendor}
              onChange={(e) => setForm({ ...form, vendor: e.target.value })}
              placeholder="Who received the payment?"
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.875rem', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ textAlign: 'right' }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '8px 24px',
                background: '#4f46e5',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: '500',
                fontSize: '0.875rem',
              }}
            >
              {loading ? 'Recording...' : 'Record Expense'}
            </button>
          </div>
        </form>
      </div>

      {/* Clean Table */}
      <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: '#1f2937' }}>Recent Expenses</h2>
        </div>
        
        {expenses.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            No expenses found for this period
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Date</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Description</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Category</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Vendor</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedExpenses.map((expense, idx) => {
                    const category = categories.find(c => c.id === expense.category_id) || CATEGORIES.find(c => c.id === expense.category_id);
                    return (
                      <tr key={expense.id} style={{ borderBottom: idx !== paginatedExpenses.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                        <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#374151' }}>{fmtDate(expense.spent_on)}</td>
                        <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#1f2937' }}>{expense.description}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 10px',
                            background: '#f3f4f6',
                            color: '#374151',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                          }}>
                            {category?.name || expense.category_id}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#6b7280' }}>{expense.vendor || '-'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.875rem', fontWeight: '500', color: '#1f2937' }}>{naira(expense.amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div style={{ 
                padding: '12px 20px', 
                borderTop: '1px solid #e5e7eb', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                background: '#f9fafb'
              }}>
                <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                  {startIndex + 1}-{Math.min(endIndex, expenses.length)} of {expenses.length}
                </div>
                
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    style={{
                      padding: '6px 12px',
                      border: '1px solid #d1d5db',
                      background: currentPage === 1 ? '#f3f4f6' : '#fff',
                      color: currentPage === 1 ? '#9ca3af' : '#374151',
                      borderRadius: '4px',
                      cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem',
                    }}
                  >
                    Previous
                  </button>
                  
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) pageNum = i + 1;
                    else if (currentPage <= 3) pageNum = i + 1;
                    else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = currentPage - 2 + i;
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #d1d5db',
                          background: currentPage === pageNum ? '#4f46e5' : '#fff',
                          color: currentPage === pageNum ? '#fff' : '#374151',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                        }}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    style={{
                      padding: '6px 12px',
                      border: '1px solid #d1d5db',
                      background: currentPage === totalPages ? '#f3f4f6' : '#fff',
                      color: currentPage === totalPages ? '#9ca3af' : '#374151',
                      borderRadius: '4px',
                      cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem',
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}