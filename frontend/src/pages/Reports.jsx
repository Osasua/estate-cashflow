import Skeleton from '../components/Skeleton';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { naira, fmtDate } from '../format';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#64748b', '#84cc16'];
const ITEMS_PER_PAGE = 10;

export default function Reports() {
  const now = new Date();
  const [data, setData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [timeframe, setTimeframe] = useState('monthly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const getDateRange = () => {
    const end = new Date();
    const start = new Date();
    if (timeframe === 'monthly') {
      start.setDate(1);
    } else if (timeframe === 'quarterly') {
      start.setMonth(Math.floor(now.getMonth() / 3) * 3, 1);
    } else if (timeframe === 'biannual') {
      start.setMonth(now.getMonth() < 6 ? 0 : 6, 1);
    } else if (timeframe === 'annual') {
      start.setMonth(0, 1);
    }
    return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
  };

  const loadData = async () => {
    setLoading(true);
    setError('');
    setCurrentPage(1);
    try {
      const { start, end } = getDateRange();
      const queryParams = new URLSearchParams({ startDate: start, endDate: end });
      if (selectedCategories.length > 0) {
        queryParams.append('category_ids', selectedCategories.join(','));
      }
      const res = await api(`/reports/summary?${queryParams.toString()}`);
      setData(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api('/expenses/categories/active').then((d) => setCategories(d.categories));
  }, []);

  useEffect(() => {
    loadData();
  }, [timeframe, selectedCategories]);

  const toggleCategory = (id) => {
    setSelectedCategories(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const expenses = data?.expenses || [];
  const totalPages = Math.ceil(expenses.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedExpenses = expenses.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const exportCSV = () => {
    if (!expenses.length) return;
    const headers = ['Date', 'Category', 'Description', 'Vendor', 'Amount'];
    const rows = expenses.map(e => [e.day, e.category, e.description, e.vendor || '', e.amount]);
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `expense_report_${timeframe}.csv`;
    link.click();
  };

  const exportPDF = () => {
    if (!expenses.length) return;
    const doc = new jsPDF();
    doc.text(`Ferrano Estate - Expense Report (${timeframe})`, 14, 15);
    
    autoTable(doc, {
      head: [['Date', 'Category', 'Description', 'Vendor', 'Amount']],
      body: expenses.map(e => [e.day, e.category, e.description, e.vendor || '', naira(e.amount)]),
      startY: 20,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [79, 70, 229] }
    });
    
    doc.save(`expense_report_${timeframe}.pdf`);
  };

  if (error) return <p className="error">{error}</p>;

  return (
    <div>
      <h1>Reports & Analytics</h1>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button 
          onClick={exportCSV} 
          disabled={!expenses.length}
          style={{ padding: '8px 16px', background: '#22c55e', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', opacity: !expenses.length ? 0.5 : 1 }}
        >
          Export CSV
        </button>
        <button 
          onClick={exportPDF} 
          disabled={!expenses.length}
          style={{ padding: '8px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', opacity: !expenses.length ? 0.5 : 1 }}
        >
          Export PDF
        </button>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label className="muted" style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Timeframe</label>
            <select 
              value={timeframe} 
              onChange={(e) => setTimeframe(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="biannual">Bi-Annual</option>
              <option value="annual">Annual</option>
            </select>
          </div>

          <div style={{ flex: 2 }}>
            <label className="muted" style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Filter by Category (Leave empty for all)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', padding: '10px', background: '#f9fafb', borderRadius: '6px', border: '1px solid #ddd' }}>
              {categories.map(cat => (
                <label key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input 
                    type="checkbox" 
                    checked={selectedCategories.includes(cat.id)} 
                    onChange={() => toggleCategory(cat.id)} 
                  />
                  {cat.name}
                </label>
              ))}
              {categories.length === 0 && <span className="muted">No categories found.</span>}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div>
          <Skeleton height="30px" width="250px" />
          <Skeleton height="150px" width="100%" style={{ marginBottom: '20px' }} />
          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
            <Skeleton height="100px" width="25%" />
            <Skeleton height="100px" width="25%" />
            <Skeleton height="100px" width="25%" />
            <Skeleton height="100px" width="25%" />
          </div>
          <div style={{ display: 'flex', gap: '20px' }}>
            <Skeleton height="300px" width="50%" />
            <Skeleton height="300px" width="50%" />
          </div>
        </div>
      ) : data ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
  <div style={{ background: '#fff', padding: '20px 24px', borderRadius: '8px', border: '1px solid #e5e7eb', borderLeft: '4px solid #4f46e5', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
    <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px', fontWeight: '500' }}>Opening Balance</div>
    <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#111827' }}>{naira(data.opening_balance)}</div>
  </div>
  <div style={{ background: '#fff', padding: '20px 24px', borderRadius: '8px', border: '1px solid #e5e7eb', borderLeft: '4px solid #10b981', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
    <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px', fontWeight: '500' }}>Total Received</div>
    <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#111827' }}>{naira(data.received)}</div>
  </div>
  <div style={{ background: '#fff', padding: '20px 24px', borderRadius: '8px', border: '1px solid #e5e7eb', borderLeft: '4px solid #ef4444', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
    <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px', fontWeight: '500' }}>Total Expenses</div>
    <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#111827' }}>{naira(data.total_expenses)}</div>
  </div>
  <div style={{ background: '#fff', padding: '20px 24px', borderRadius: '8px', border: '1px solid #e5e7eb', borderLeft: '4px solid #4f46e5', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
    <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px', fontWeight: '500' }}>Closing Balance</div>
    <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#111827' }}>{naira(data.closing_balance)}</div>
  </div>
</div>

          <div className="grid-2">
            <div className="card">
              <h3>Expense Breakdown</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={data.expense_breakdown} dataKey="total" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2}>
                    {data.expense_breakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => naira(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h3>Category Details</h3>
              {/* MOBILE RESPONSIVE TABLE 1 */}
              <table className="mobile-cards" style={{ width: '100%' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid #eee' }}>
                    <th style={{ padding: '10px' }}>Category</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Amount</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.expense_breakdown.map((item, i) => {
                    const pct = data.total_expenses > 0 ? ((item.total / data.total_expenses) * 100).toFixed(1) : 0;
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                        <td data-label="Category" style={{ padding: '10px' }}>{item.name}</td>
                        <td data-label="Amount" style={{ padding: '10px', textAlign: 'right' }}>{naira(item.total)}</td>
                        <td data-label="% of Total" style={{ padding: '10px', textAlign: 'right', color: '#666' }}>{pct}%</td>
                      </tr>
                    );
                  })}
                  {data.expense_breakdown.length === 0 && (
                    <tr><td colSpan="3" className="muted" style={{ padding: '10px', textAlign: 'center' }}>No expenses found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0 }}>Individual Expense Transactions</h3>
              <span className="muted" style={{ fontSize: '0.9rem' }}>
                Showing {startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, expenses.length)} of {expenses.length} records
              </span>
            </div>
            
            {/* MOBILE RESPONSIVE TABLE 2 */}
            <table className="mobile-cards" style={{ width: '100%' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee', background: '#f9fafb' }}>
                  <th style={{ padding: '12px 10px' }}>Date</th>
                  <th style={{ padding: '12px 10px' }}>Category</th>
                  <th style={{ padding: '12px 10px' }}>Description</th>
                  <th style={{ padding: '12px 10px' }}>Vendor</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {paginatedExpenses.map((exp, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                    <td data-label="Date" style={{ padding: '10px' }}>{fmtDate(exp.day)}</td>
                    <td data-label="Category" style={{ padding: '10px' }}>
                      <span className="badge" style={{ background: '#e0e7ff', color: '#4f46e5' }}>{exp.category}</span>
                    </td>
                    <td data-label="Description" style={{ padding: '10px' }}>{exp.description}</td>
                    <td data-label="Vendor" style={{ padding: '10px' }} className="muted">{exp.vendor || '—'}</td>
                    <td data-label="Amount" style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>{naira(exp.amount)}</td>
                  </tr>
                ))}
                {paginatedExpenses.length === 0 && (
                  <tr><td colSpan="5" className="muted" style={{ padding: '20px', textAlign: 'center' }}>No individual expenses found for this selection.</td></tr>
                )}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #eee' }}>
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ padding: '10px 20px', border: '1px solid #4f46e5', borderRadius: '6px', background: currentPage === 1 ? '#f3f4f6' : '#4f46e5', color: currentPage === 1 ? '#999' : 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}>Previous</button>
                <div style={{ display: 'flex', gap: '5px' }}>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button key={page} onClick={() => setCurrentPage(page)} style={{ padding: '10px 14px', border: '1px solid #ddd', borderRadius: '6px', background: currentPage === page ? '#4f46e5' : 'white', color: currentPage === page ? 'white' : '#333', cursor: 'pointer', fontWeight: currentPage === page ? 'bold' : 'normal', fontSize: '0.9rem' }}>{page}</button>
                  ))}
                </div>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ padding: '10px 20px', border: '1px solid #4f46e5', borderRadius: '6px', background: currentPage === totalPages ? '#f3f4f6' : '#4f46e5', color: currentPage === totalPages ? '#999' : 'white', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}>Next</button>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}