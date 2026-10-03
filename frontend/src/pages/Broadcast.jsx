import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';

export default function Broadcast() {
  const { user } = useAuth();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState(''); 
  const [statusMsg, setStatusMsg] = useState('');

  const handleSend = async (e) => {
    e.preventDefault();
    setStatus('loading');
    setStatusMsg('Preparing broadcast...');
    
    try {
      const res = await api('/admin/broadcast', {
        method: 'POST',
        body: { subject, message }
      });
      setStatus('success');
      setStatusMsg(res.message);
      setSubject('');
      setMessage('');
    } catch (err) {
      setStatus('error');
      setStatusMsg(err.message || 'Failed to send broadcast.');
    }
  };

  const applyTemplate = (type) => {
    if (type === 'payment') {
      setSubject('Important: Monthly Contribution Reminder');
      setMessage('Dear Resident,\n\nThis is a gentle reminder that your monthly contribution is due soon. Please log in to your portal to view your outstanding balance and make a payment.\n\nThank you for your prompt attention to this matter.\n\nBest regards,\nEstate Management');
    } else if (type === 'meeting') {
      setSubject('Notice: Upcoming Residents Meeting');
      setMessage('Dear Resident,\n\nYou are cordially invited to the next general meeting of the estate.\n\nDate: [Insert Date]\nTime: [Insert Time]\nVenue: [Insert Venue]\n\nYour participation is highly valued.\n\nBest regards,\nEstate Management');
    } else if (type === 'update') {
      setSubject('Financial Update for the Month');
      setMessage('Dear Resident,\n\nPlease find below a brief update on the estate\'s financial status for this month.\n\n[Insert Update Details Here]\n\nThank you for your continued cooperation.\n\nBest regards,\nEstate Management');
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px 0' }}>
      
      {/* Clean Page Header */}
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '700', color: '#111827' }}>Broadcast Message</h1>
        <p style={{ margin: '5px 0 0', color: '#6b7280', fontSize: '0.9rem' }}>Compose and send an official announcement to all residents</p>
      </div>

      {/* Status Messages */}
      {statusMsg && (
        <div style={{ 
          padding: '14px 18px', background: status === 'error' ? '#fef2f2' : '#ecfdf5', 
          color: status === 'error' ? '#991b1b' : '#065f46', borderRadius: '8px', marginBottom: '24px', 
          border: `1px solid ${status === 'error' ? '#fecaca' : '#a7f3d0'}`,
          display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '500'
        }}>
          {status === 'success' && <span>✅</span>}
          {status === 'error' && <span>⚠️</span>}
          {statusMsg}
        </div>
      )}

      {/* Main Card with Gradient Header */}
      <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        
        {/* Colorful Header Banner */}
        <div style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', padding: '24px 30px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ background: 'rgba(255,255,255,0.2)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
              📢
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700' }}>Estate Broadcast</h2>
              <p style={{ margin: '4px 0 0', fontSize: '0.9rem', opacity: 0.9 }}>Sending to all registered residents</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
             <span style={{ background: 'rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600' }}>📧 Email</span>
          </div>
        </div>

        {/* Split Layout Body */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0', minHeight: '600px' }}>
          
          {/* LEFT: Editor */}
          <div style={{ padding: '30px', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: '#111827' }}>Quick Templates</h3>
            </div>

            {/* Colorful Template Chips */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => applyTemplate('payment')} style={{ padding: '8px 16px', background: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe', borderRadius: '20px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                💰 Payment Reminder
              </button>
              <button type="button" onClick={() => applyTemplate('meeting')} style={{ padding: '8px 16px', background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', borderRadius: '20px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                🤝 Meeting Notice
              </button>
              <button type="button" onClick={() => applyTemplate('update')} style={{ padding: '8px 16px', background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a', borderRadius: '20px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                📊 Financial Update
              </button>
            </div>

            <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151', fontSize: '0.875rem' }}>Subject Line</label>
                <input
                  type="text" value={subject} onChange={(e) => setSubject(e.target.value)} required
                  placeholder="e.g., Important Financial Update for October"
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', boxSizing: 'border-box', fontSize: '0.95rem', outline: 'none', transition: 'all 0.2s' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#4f46e5'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(79,70,229,0.1)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = 'none'; }}
                />
              </div>
              
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151', fontSize: '0.875rem' }}>Message Body</label>
                <textarea
                  value={message} onChange={(e) => setMessage(e.target.value)} required rows="10"
                  placeholder="Type your official message here..."
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: '0.95rem', resize: 'vertical', outline: 'none', flex: 1, transition: 'all 0.2s' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#4f46e5'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(79,70,229,0.1)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = 'none'; }}
                />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '20px', borderTop: '1px solid #f3f4f6' }}>
                <button
                  type="submit" disabled={status === 'loading'}
                  style={{ 
                    padding: '12px 24px', background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', color: 'white', border: 'none', borderRadius: '8px', 
                    cursor: status === 'loading' ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '1rem', 
                    opacity: status === 'loading' ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '8px',
                    boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)', transition: 'transform 0.1s'
                  }}
                  onMouseEnter={(e) => { if(status !== 'loading') e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
                >
                  {status === 'loading' ? 'Sending...' : (
                    <>
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                      Send Broadcast
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* RIGHT: Live Email Preview */}
          <div style={{ background: '#f3f4f6', padding: '30px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>
              👁️ Resident's View (Live Preview)
            </div>
            
            {/* Mock Email Client */}
            <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
              {/* Email Header */}
              <div style={{ background: '#4f46e5', padding: '16px 20px', color: 'white', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '32px', height: '32px', background: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5', fontWeight: 'bold', fontSize: '0.9rem' }}>
                  FC
                </div>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>Ferrano Court Portal</div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>to All Residents</div>
                </div>
              </div>
              
              {/* Email Meta */}
              <div style={{ padding: '20px', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
                  {subject || <span style={{color: '#9ca3af', fontStyle: 'italic'}}>No subject yet...</span>}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                  Just now • to me
                </div>
              </div>

              {/* Email Body */}
              <div style={{ padding: '24px', flex: 1, fontSize: '0.95rem', lineHeight: '1.6', color: '#374151', whiteSpace: 'pre-wrap' }}>
                {message || <span style={{color: '#9ca3af', fontStyle: 'italic'}}>Start typing to see your message here...</span>}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}