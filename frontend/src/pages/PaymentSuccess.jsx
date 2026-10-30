import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { naira } from '../format';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const reference = searchParams.get('reference');
  
  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const verifyPayment = async () => {
      if (!reference) {
        setError('No payment reference found.');
        setLoading(false);
        return;
      }

      try {
        const res = await api('/payments/verify', {
          method: 'POST',
          body: { reference }
        });
        
        if (res.success) {
          setReceipt(res.receipt);
        } else {
          setError('Payment verification failed.');
        }
      } catch (err) {
        setError(err.message || 'Failed to verify payment.');
      } finally {
        setLoading(false);
      }
    };

    verifyPayment();
  }, [reference]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f9fafb' }}>
        <div style={{ fontSize: '1.2rem', color: '#6b7280' }}>Verifying payment...</div>
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f9fafb' }}>
        <div style={{ background: 'white', padding: '40px', borderRadius: '16px', textAlign: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚠️</div>
          <h2 style={{ color: '#ef4444', marginBottom: '8px' }}>Verification Failed</h2>
          <p style={{ color: '#6b7280', marginBottom: '24px' }}>{error}</p>
          <button onClick={() => navigate('/my-account')} style={{ padding: '10px 24px', background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            Return to My Account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '40px', maxWidth: '500px', width: '100%', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
        {/* Success Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '64px', height: '64px', background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', color: '#111827' }}>Payment Successful!</h1>
          <p style={{ margin: 0, color: '#6b7280' }}>Your payment has been received and recorded.</p>
        </div>

        {/* Receipt Details */}
        <div style={{ background: '#f9fafb', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px dashed #d1d5db' }}>
            <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Amount Paid</span>
            <span style={{ fontWeight: '700', fontSize: '1.25rem', color: '#059669' }}>{naira(receipt.amount)}</span>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '0.875rem' }}>
            <div>
              <div style={{ color: '#9ca3af', marginBottom: '4px' }}>Reference</div>
              <div style={{ fontWeight: '600', color: '#111827', wordBreak: 'break-all' }}>{receipt.reference}</div>
            </div>
            <div>
              <div style={{ color: '#9ca3af', marginBottom: '4px' }}>Date</div>
              <div style={{ fontWeight: '600', color: '#111827' }}>{new Date(receipt.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
            </div>
            <div>
              <div style={{ color: '#9ca3af', marginBottom: '4px' }}>Period</div>
              <div style={{ fontWeight: '600', color: '#111827' }}>{receipt.period}</div>
            </div>
            <div>
              <div style={{ color: '#9ca3af', marginBottom: '4px' }}>Type</div>
              <div style={{ fontWeight: '600', color: '#111827', textTransform: 'capitalize' }}>{receipt.type}</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px' }} className="no-print">
          <button onClick={handlePrint} style={{ flex: 1, padding: '12px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
            🖨️ Print Receipt
          </button>
          <button onClick={() => navigate('/my-account')} style={{ flex: 1, padding: '12px', background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
            Back to Account
          </button>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body { background: white; }
          .no-print { display: none !important; }
          div[style*="box-shadow"] { box-shadow: none !important; border: 1px solid #e5e7eb; }
        }
      `}</style>
    </div>
  );
}