import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom'; // ✅ Added for reliable printing
import { api } from '../api';
import { useAuth } from '../auth';
import Skeleton from '../components/Skeleton';
import Tabs from '../components/Tabs';

const ROW_COLORS = [
  { border: '#6366f1', bg: '#eef2ff', text: '#4f46e5' },
  { border: '#22c55e', bg: '#ecfdf5', text: '#059669' },
  { border: '#f59e0b', bg: '#fffbeb', text: '#d97706' },
  { border: '#ef4444', bg: '#fff1f2', text: '#e11d48' },
  { border: '#06b6d4', bg: '#ecfeff', text: '#0891b2' },
  { border: '#a855f7', bg: '#f5f3ff', text: '#7c3aed' },
];

const TAB_TO_TYPE = {
  'Monthly': 'monthly',
  'Float': 'float',
  'Projects': 'projects',
  'End of Year': 'end-of-year',
  'Welfare': 'welfare'
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function Contributions() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('Monthly');
  const [contributions, setContributions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  
  // Payment Modal State
  const [payingContribution, setPayingContribution] = useState(null);
  const [paymentReceipt, setPaymentReceipt] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [formData, setFormData] = useState({
    amount: '',
    method: 'cash',
    reference: '',
    note: ''
  });
  
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedContribution, setSelectedContribution] = useState(null);
  const [editForm, setEditForm] = useState({ amount: '', paid: '', reference: '' });
  
  const [form, setForm] = useState({
    month: (new Date().getMonth() + 1).toString(),
    year: new Date().getFullYear().toString(),
    customAmount: ''
  });

  const isMonthly = activeTab === 'Monthly';
  const currentType = TAB_TO_TYPE[activeTab];
  const isActivated = contributions.length > 0;

  useEffect(() => {
    loadContributions();
  }, [activeTab, form.month, form.year]);

  useEffect(() => {
    if (!isMonthly) {
      loadActivationPeriod();
    }
  }, [activeTab]);

  const loadActivationPeriod = async () => {
    try {
      const res = await api(`/contributions/activation-period?type=${currentType}`);
      if (res) {
        setForm(prev => ({
          ...prev,
          month: res.period_month.toString(),
          year: res.period_year.toString()
        }));
      }
    } catch (err) {
      console.error('Failed to load activation period:', err);
    }
  };

  const loadContributions = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        month: form.month,
        year: form.year,
        type: currentType
      });

      const res = await api(`/contributions?${queryParams}`);
      const data = res.contributions || [];
      setContributions(data);
    } catch (err) {
      console.error('Load error:', err);
      setMessage('❌ Failed to load: ' + err.message);
      setTimeout(() => setMessage(''), 5000);
      setContributions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateBills = async () => {
    if (isActivated && !isMonthly) {
      setMessage('⚠️ Already activated for this period. Use Edit to modify individual contributions.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    
    try {
      await api('/contributions/generate', {
        method: 'POST',
        body: {
          month: parseInt(form.month),
          year: parseInt(form.year),
          type: currentType,
          amount: form.customAmount ? parseFloat(form.customAmount) : undefined
        }
      });
      setMessage(isMonthly ? '✅ Monthly bills generated' : `✅ ${activeTab} activated for ${form.month}/${form.year}`);
      setTimeout(() => setMessage(''), 3000);
      await loadContributions();
    } catch (err) {
      setMessage('❌ ' + err.message);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleEdit = (contribution) => {
    setEditForm({
      amount: contribution.amount_due || '',
      paid: contribution.amount_paid || '',
      reference: contribution.references || ''
    });
    setSelectedContribution(contribution);
    setEditModalOpen(true);
  };

  const handleEditSave = () => {
    const dueAmount = parseFloat(editForm.amount);
    const paidAmount = parseFloat(editForm.paid) || 0;

    if (isNaN(dueAmount) || dueAmount < 0) {
      setMessage('❌ Amount due cannot be negative');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (paidAmount < 0) {
      setMessage('❌ Amount paid cannot be negative');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    api(`/contributions/${selectedContribution.id}`, {
      method: 'PUT',
      body: { 
        amount_due: dueAmount,
        amount_paid: paidAmount,
        note: editForm.reference.trim() === '' ? null : editForm.reference
      }
    }).then(() => {
      setMessage('✅ Contribution updated');
      setTimeout(() => setMessage(''), 3000);
      setEditModalOpen(false);
      loadContributions();
    }).catch(err => {
      setMessage('❌ Failed to update: ' + err.message);
      setTimeout(() => setMessage(''), 5000);
    });
  };

  const handleRecordPayment = (contribution) => {
    setPayingContribution(contribution);
    setPaymentReceipt(null);
    setPaymentError('');
    setFormData({
      amount: '',
      method: 'cash',
      reference: '',
      note: ''
    });
  };

  const submitPayment = async () => {
    if (!payingContribution || !formData.amount || parseFloat(formData.amount) <= 0) {
      setPaymentError('Please enter a valid amount');
      return;
    }

    setPaymentLoading(true);
    setPaymentError('');

    try {
      const res = await api('/contributions/payments', {
        method: 'POST',
        body: {
          member_id: payingContribution.member_id,
          month: parseInt(form.month),
          year: parseInt(form.year),
          type: currentType,
          amount: parseFloat(formData.amount),
          method: formData.method,
          reference: formData.reference || undefined,
          note: formData.note || undefined
        }
      });
      
      setPaymentReceipt(res);
      loadContributions();
    } catch (err) {
      setPaymentError(err.message || 'Failed to record payment');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handlePrint = () => window.print();

  const expected = contributions.reduce((sum, c) => sum + (parseFloat(c.amount_due) || 0), 0);
  const collected = contributions.reduce((sum, c) => sum + (parseFloat(c.amount_paid) || 0), 0);
  const outstanding = expected - collected;

  const getStatus = (c) => {
    const paid = parseFloat(c.amount_paid) || 0;
    const due = parseFloat(c.amount_due) || 0;
    if (due > 0 && paid >= due) return 'paid';
    if (paid > 0) return 'partial';
    return 'pending';
  };

  if (loading) return <div style={{ padding: '40px' }}><Skeleton height="40px" width="300px" /></div>;

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '2rem', fontWeight: '700', color: '#111827' }}>Contributions</h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '1.05rem' }}>
          {isMonthly ? 'Manage monthly estate contributions' : `Manage ${activeTab} contributions (occasional event)`}
        </p>
      </div>

      <Tabs tabs={Object.keys(TAB_TO_TYPE)} active={activeTab} onChange={setActiveTab} />

      {!isMonthly && (
        <div style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderLeft: '4px solid #3b82f6',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.5rem' }}>ℹ️</span>
            <div>
              <div style={{ fontWeight: '600', color: '#1e40af', marginBottom: '4px' }}>
                Occasional Contribution Type
              </div>
              <div style={{ fontSize: '0.9rem', color: '#3b82f6' }}>
                {activeTab} contributions are activated only when needed (typically 1-2 times per year).
                <br />
                <strong>Note:</strong> Contributions are generated for currently active members. For historical accuracy, activate during the actual period.
              </div>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div style={{ background: message.includes('✅') ? '#ecfdf5' : message.includes('⚠️') ? '#fffbeb' : '#fff1f2', border: `1px solid ${message.includes('✅') ? '#a7f3d0' : message.includes('⚠️') ? '#fde68a' : '#fecdd3'}`, borderRadius: '8px', padding: '12px', marginBottom: '20px', color: message.includes('✅') ? '#065f46' : message.includes('⚠️') ? '#92400e' : '#991b1b' }}>{message}</div>
      )}

      <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>
              Month
            </label>
            <select value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
              {monthNames.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>
              Year
            </label>
            <input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', width: '80px' }} />
          </div>
          {!isMonthly && (
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>Custom Amount (Optional)</label>
              <input type="number" value={form.customAmount} onChange={(e) => setForm({ ...form, customAmount: e.target.value })} placeholder="Leave blank for default" style={{ padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
            </div>
          )}
          <button 
            onClick={handleGenerateBills} 
            disabled={isActivated && !isMonthly}
            style={{ 
              padding: '10px 20px', 
              background: isActivated && !isMonthly ? '#9ca3af' : (isMonthly ? '#6366f1' : 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)'), 
              color: 'white', 
              border: 'none', 
              borderRadius: '6px', 
              fontWeight: '600', 
              cursor: isActivated && !isMonthly ? 'not-allowed' : 'pointer',
              boxShadow: isActivated && !isMonthly ? 'none' : '0 2px 8px rgba(245, 158, 11, 0.3)',
              opacity: isActivated && !isMonthly ? 0.6 : 1
            }}
          >
            {isActivated && !isMonthly ? `✓ ${activeTab} Activated` : (isMonthly ? 'Generate Monthly Bills' : `Activate ${activeTab}`)}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb', borderLeft: '4px solid #6366f1' }}>
          <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Expected</div>
          <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#4f46e5' }}>{expected.toLocaleString()}</div>
        </div>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb', borderLeft: '4px solid #22c55e' }}>
          <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Collected</div>
          <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#059669' }}>{collected.toLocaleString()}</div>
        </div>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb', borderLeft: '4px solid #ef4444' }}>
          <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Outstanding</div>
          <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#e11d48' }}>{outstanding.toLocaleString()}</div>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        {contributions.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>{isMonthly ? '💰' : '📅'}</div>
            <p style={{ fontSize: '1.1rem', fontWeight: '600', color: '#6b7280' }}>
              {isMonthly 
                ? `No monthly contributions for ${monthNames[parseInt(form.month) - 1]} ${form.year}`
                : `No ${activeTab} contribution activated for ${form.month}/${form.year}`
              }
            </p>
            <p style={{ fontSize: '0.9rem' }}>
              {isMonthly 
                ? 'Click "Generate Monthly Bills" to create contributions'
                : `Click "Activate ${activeTab}" to create this occasional contribution`
              }
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', color: '#6b7280' }}>HOUSE</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', color: '#6b7280' }}>HOUSEHOLD</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.75rem', color: '#6b7280' }}>DUE</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.75rem', color: '#6b7280' }}>PAID</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.75rem', color: '#6b7280' }}>STATUS</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', color: '#6b7280' }}>REFERENCE</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.75rem', color: '#6b7280' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {contributions.map((c, idx) => {
                const color = ROW_COLORS[idx % ROW_COLORS.length];
                const status = getStatus(c);
                const isPaid = status === 'paid';
                
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px 16px', fontWeight: '600' }}>{c.house_number}</td>
                    <td style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: color.border, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700' }}>
                        {c.household_name.charAt(0)}
                      </div>
                      {c.household_name}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600' }}>₦{(parseFloat(c.amount_due) || 0).toLocaleString()}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: isPaid ? '#059669' : '#9ca3af' }}>{(parseFloat(c.amount_paid) || 0).toLocaleString()}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '600', background: isPaid ? '#dcfce7' : status === 'partial' ? '#fef3c7' : '#fee2e2', color: isPaid ? '#166534' : status === 'partial' ? '#92400e' : '#991b1b' }}>
                        {isPaid ? '✓ Paid' : status === 'partial' ? '⚠ Partial' : '⏳ Pending'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.9rem', color: '#4b5563' }}>
                      {c.references || <span style={{ color: '#d1d5db' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button onClick={() => handleEdit(c)} style={{ padding: '6px 12px', border: `1px solid ${color.border}`, color: color.text, background: 'white', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>Edit</button>
                        <button onClick={() => handleRecordPayment(c)} style={{ padding: '6px 12px', border: '1px solid #22c55e', color: '#22c55e', background: isPaid ? '#f0fdf4' : 'white', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>
                          {isPaid ? 'Add Payment' : 'Record Payment'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Modal */}
      {editModalOpen && selectedContribution && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }} onClick={() => setEditModalOpen(false)}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '32px',
            width: '90%',
            maxWidth: '500px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 24px 0', fontSize: '1.5rem', fontWeight: '700', color: '#111827' }}>
              Edit Contribution
            </h3>
            
            <div style={{ marginBottom: '20px', padding: '16px', background: '#f9fafb', borderRadius: '12px' }}>
              <div style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '4px' }}>Household</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#111827' }}>
                {selectedContribution.household_name}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginTop: '8px' }}>
                Type: {activeTab} • {monthNames[parseInt(form.month) - 1]} {form.year}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: '600', color: '#374151' }}>
                Amount Due (₦)
              </label>
              <input
                type="number"
                value={editForm.amount}
                onChange={(e) => setEditForm({...editForm, amount: e.target.value})}
                style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box' }}
                placeholder="Enter amount due"
                autoFocus
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: '600', color: '#374151' }}>
                Amount Paid (₦)
              </label>
              <input
                type="number"
                value={editForm.paid}
                onChange={(e) => setEditForm({...editForm, paid: e.target.value})}
                style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box' }}
                placeholder="Enter amount paid"
              />
              <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '6px' }}>
                Use this to correct overpayments or underpayments
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: '600', color: '#374151' }}>
                Reference / Note
              </label>
              <input
                type="text"
                value={editForm.reference}
                onChange={(e) => setEditForm({...editForm, reference: e.target.value})}
                style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box' }}
                placeholder="e.g., Sept - Dec-2, Sept - Dec-3"
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setEditModalOpen(false)} style={{ padding: '12px 24px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '0.95rem' }}>Cancel</button>
              <button onClick={handleEditSave} style={{ padding: '12px 24px', background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '0.95rem', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)' }}>✓ Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ MANUAL PAYMENT MODAL (Screen View Only) */}
      {payingContribution && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }} onClick={() => setPayingContribution(null)}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '32px',
            width: '90%',
            maxWidth: '500px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }} onClick={e => e.stopPropagation()}>
            
            {/* SUCCESS / RECEIPT VIEW (Screen) */}
            {paymentReceipt ? (
              <>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <div style={{ width: '64px', height: '64px', background: '#dcfce7', color: '#166534', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 'bold', margin: '0 auto' }}>✓</div>
                  <h2 style={{ margin: '16px 0 8px', color: '#111827' }}>Payment Recorded!</h2>
                  <p style={{ color: '#6b7280', margin: 0 }}>{paymentReceipt.message}</p>
                </div>

                <div style={{ background: '#f9fafb', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px dashed #d1d5db', fontSize: '0.875rem' }}>
                    <span>Reference</span>
                    <strong>{paymentReceipt.reference}</strong>
                  </div>
                  
                  <div style={{ marginTop: '16px' }}>
                    <h4 style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '8px', textTransform: 'uppercase' }}>Allocation Breakdown</h4>
                    <table style={{ width: '100%', fontSize: '0.9rem', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                          <th style={{ textAlign: 'left', padding: '8px 0', color: '#374151' }}>Period</th>
                          <th style={{ textAlign: 'right', padding: '8px 0', color: '#374151' }}>Amount Applied</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentReceipt.allocations.map((alloc, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '8px 0', color: '#111827' }}>
                              {MONTHS[alloc.month - 1]} {alloc.year} 
                              <span style={{ color: '#6b7280', fontSize: '0.75rem', marginLeft: '6px' }}>({alloc.type})</span>
                            </td>
                            <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: '600', color: '#059669' }}>
                              ₦{Number(alloc.amount).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {paymentReceipt.credit_balance > 0 && (
                    <div style={{ marginTop: '16px', padding: '12px', background: '#fef3c7', borderRadius: '8px', color: '#92400e', fontSize: '0.875rem' }}>
                      ⚠️ Unallocated Credit: ₦{Number(paymentReceipt.credit_balance).toLocaleString()}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }} className="no-print">
                  <button onClick={handlePrint} style={{ flex: 1, padding: '12px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>🖨️ Print Receipt</button>
                  <button onClick={() => setPayingContribution(null)} style={{ flex: 1, padding: '12px', background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Done</button>
                </div>
              </>
            ) : (
              /* INPUT FORM VIEW */
              <>
                <h2 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', color: '#111827' }}>Record Manual Payment</h2>
                <p style={{ color: '#6b7280', marginBottom: '24px', fontSize: '0.9rem' }}>
                  For: <strong>{payingContribution.household_name}</strong> ({payingContribution.house_number})
                </p>

                {paymentError && <div style={{ padding: '12px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', fontSize: '0.875rem', marginBottom: '16px' }}>{paymentError}</div>}

                <div style={{ display: 'grid', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Amount (₦) *</label>
                    <input
                      type="number" required min="1" step="0.01"
                      value={formData.amount}
                      onChange={e => setFormData({ ...formData, amount: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem', boxSizing: 'border-box' }}
                      placeholder="50000"
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Month *</label>
                      <select value={form.month} disabled style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', background: '#f9fafb' }}>
                        {monthNames.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Year *</label>
                      <input type="number" value={form.year} disabled style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', background: '#f9fafb', boxSizing: 'border-box' }} />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Method *</label>
                    <select value={formData.method} onChange={e => setFormData({ ...formData, method: e.target.value })} style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' }}>
                      <option value="cash">Cash</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="cheque">Cheque</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Reference <span style={{ color: '#9ca3af', fontWeight: 'normal' }}>(Auto-generated if blank)</span></label>
                    <input type="text" value={formData.reference} onChange={e => setFormData({ ...formData, reference: e.target.value })} style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', boxSizing: 'border-box' }} placeholder="e.g., TRF-998877" />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>Note (Optional)</label>
                    <textarea
                      value={formData.note}
                      onChange={e => setFormData({ ...formData, note: e.target.value })}
                      style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', minHeight: '60px', resize: 'vertical', boxSizing: 'border-box' }}
                      placeholder="e.g., Paid by wife"
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                    <button type="button" onClick={() => setPayingContribution(null)} style={{ flex: 1, padding: '12px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                    <button type="button" onClick={submitPayment} disabled={paymentLoading} style={{ flex: 1, padding: '12px', background: paymentLoading ? '#9ca3af' : '#22c55e', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: paymentLoading ? 'not-allowed' : 'pointer' }}>
                      {paymentLoading ? 'Processing...' : 'Record Payment'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ✅ PRINT PORTAL: Renders receipt directly to body for printing */}
      {paymentReceipt && createPortal(
        <div id="print-receipt-portal" className="print-only-receipt">
          <div style={{ padding: '40px', fontFamily: 'Arial, sans-serif', maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
              <h1 style={{ margin: '0 0 10px 0', color: '#166534' }}>PAYMENT RECEIPT</h1>
              <p style={{ margin: 0, color: '#6b7280' }}>Ferrano Court Portal</p>
            </div>

            <div style={{ background: '#f9fafb', padding: '20px', borderRadius: '8px', border: '1px solid #e5e7eb', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ color: '#6b7280' }}>Reference:</span>
                <strong>{paymentReceipt.reference}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ color: '#6b7280' }}>Date:</span>
                <strong>{new Date().toLocaleDateString()}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ color: '#6b7280' }}>Household:</span>
                <strong>{payingContribution?.household_name || 'N/A'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7280' }}>Total Amount:</span>
                <strong style={{ fontSize: '1.2rem', color: '#059669' }}>₦{Number(paymentReceipt.allocations.reduce((sum, a) => sum + a.amount, 0)).toLocaleString()}</strong>
              </div>
            </div>

            <h3 style={{ fontSize: '1rem', color: '#374151', marginBottom: '10px' }}>Allocation Breakdown</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '8px', color: '#6b7280' }}>Period</th>
                  <th style={{ textAlign: 'right', padding: '8px', color: '#6b7280' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {paymentReceipt.allocations.map((alloc, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px', color: '#111827' }}>
                      {MONTHS[alloc.month - 1]} {alloc.year} ({alloc.type})
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: '600', color: '#059669' }}>
                      ₦{Number(alloc.amount).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {paymentReceipt.credit_balance > 0 && (
              <div style={{ padding: '10px', background: '#fef3c7', borderRadius: '4px', color: '#92400e', fontSize: '0.9rem' }}>
                ⚠️ Unallocated Credit: ₦{Number(paymentReceipt.credit_balance).toLocaleString()}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* ✅ CLEAN PRINT CSS */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #print-receipt-portal, #print-receipt-portal * { 
            visibility: visible !important; 
            position: static !important;
            display: block !important;
          }
          #print-receipt-portal {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
        }
      `}</style>
    </div>
  );
}