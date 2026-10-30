import React, { useState } from 'react';
import { api } from '../api'; // Adjust path if needed
import { naira } from '../format'; // Adjust path if needed

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function ManualPaymentModal({ member, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [receiptData, setReceiptData] = useState(null);

  const [formData, setFormData] = useState({
    amount: '',
    method: 'cash',
    reference: '',
    note: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await api('/contributions/payments', {
        method: 'POST',
        body: {
          member_id: member.id,
          ...formData,
          amount: Number(formData.amount)
        }
      });
      
      setReceiptData(res);
      if (onSuccess) onSuccess(); // Refresh the main table in background
    } catch (err) {
      setError(err.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => window.print();

  // --- VIEW 2: RECEIPT & ALLOCATION VISUALIZATION ---
  if (receiptData) {
    return (
      <div style={styles.overlay} onClick={onClose}>
        <div style={styles.modal} onClick={e => e.stopPropagation()}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={styles.successIcon}>✓</div>
            <h2 style={{ margin: '16px 0 8px', color: '#111827' }}>Payment Recorded!</h2>
            <p style={{ color: '#6b7280', margin: 0 }}>{receiptData.message}</p>
          </div>

          <div style={styles.receiptBox}>
            <div style={styles.receiptHeader}>
              <span>Reference</span>
              <strong>{receiptData.reference}</strong>
            </div>
            
            {/* ALLOCATION VISUALIZATION */}
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
                  {receiptData.allocations.map((alloc, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px 0', color: '#111827' }}>
                        {MONTHS[alloc.month - 1]} {alloc.year} 
                        <span style={{ color: '#6b7280', fontSize: '0.75rem', marginLeft: '6px' }}>({alloc.type})</span>
                      </td>
                      <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: '600', color: '#059669' }}>
                        {naira(alloc.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {receiptData.credit_balance > 0 && (
              <div style={{ marginTop: '16px', padding: '12px', background: '#fef3c7', borderRadius: '8px', color: '#92400e', fontSize: '0.875rem' }}>
                ⚠️ Unallocated Credit: {naira(receiptData.credit_balance)}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }} className="no-print">
            <button onClick={handlePrint} style={styles.secondaryBtn}>🖨️ Print Receipt</button>
            <button onClick={onClose} style={styles.primaryBtn}>Done</button>
          </div>
        </div>

        {/* Print Styles */}
        <style>{`
          @media print {
            body * { visibility: hidden; }
            .modal-overlay, .modal-overlay * { visibility: visible; }
            .modal-overlay { position: absolute; left: 0; top: 0; width: 100%; background: white; }
            .no-print { display: none !important; }
            .modal-content { box-shadow: none !important; border: 1px solid #e5e7eb; }
          }
        `}</style>
      </div>
    );
  }

  // --- VIEW 1: INPUT FORM ---
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', color: '#111827' }}>Record Manual Payment</h2>
        <p style={{ color: '#6b7280', marginBottom: '24px', fontSize: '0.9rem' }}>
          For: <strong>{member.household_name}</strong> ({member.house_number})
        </p>

        {error && <div style={styles.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '16px' }}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Amount (₦) *</label>
            <input
              type="number" required min="1" step="0.01"
              value={formData.amount}
              onChange={e => setFormData({ ...formData, amount: e.target.value })}
              style={styles.input} placeholder="50000"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Month *</label>
              <select value={formData.month} onChange={e => setFormData({ ...formData, month: Number(e.target.value) })} style={styles.input}>
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Year *</label>
              <input type="number" required value={formData.year} onChange={e => setFormData({ ...formData, year: Number(e.target.value) })} style={styles.input} />
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Method *</label>
            <select value={formData.method} onChange={e => setFormData({ ...formData, method: e.target.value })} style={styles.input}>
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Reference <span style={{ color: '#9ca3af', fontWeight: 'normal' }}>(Auto-generated if blank)</span></label>
            <input type="text" value={formData.reference} onChange={e => setFormData({ ...formData, reference: e.target.value })} style={styles.input} placeholder="e.g., TRF-998877" />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button type="button" onClick={onClose} style={styles.secondaryBtn}>Cancel</button>
            <button type="submit" disabled={loading} style={styles.primaryBtn}>
              {loading ? 'Processing...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' },
  modal: { background: 'white', borderRadius: '16px', padding: '32px', width: '90%', maxWidth: '450px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' },
  successIcon: { width: '64px', height: '64px', background: '#dcfce7', color: '#166534', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 'bold', margin: '0 auto' },
  receiptBox: { background: '#f9fafb', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb' },
  receiptHeader: { display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px dashed #d1d5db', fontSize: '0.875rem' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '0.875rem', fontWeight: '600', color: '#374151' },
  input: { padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem', outline: 'none' },
  errorBox: { padding: '12px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', fontSize: '0.875rem', marginBottom: '16px' },
  primaryBtn: { flex: 1, padding: '12px', background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' },
  secondaryBtn: { flex: 1, padding: '12px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }
};