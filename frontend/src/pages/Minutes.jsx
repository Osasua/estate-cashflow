import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import Skeleton from '../components/Skeleton';

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#64748b', '#84cc16', '#ec4899', '#14b8a6'];

export default function Minutes() {
  const { user } = useAuth();
  const isStaff = ['admin', 'treasurer'].includes(user?.role);
  
  const [minutes, setMinutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedMinute, setSelectedMinute] = useState(null);
  
  const [form, setForm] = useState({ title: '', meeting_date: '', content: '', document_link: '' });

  useEffect(() => {
    api('/minutes')
      .then((res) => setMinutes(res.minutes || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handlePublish = async (e) => {
    e.preventDefault();
    try {
      await api('/minutes', { method: 'POST', body: form });
      setShowForm(false);
      setForm({ title: '', meeting_date: '', content: '', document_link: '' });
      const res = await api('/minutes');
      setMinutes(res.minutes || []);
    } catch (err) {
      alert('Failed to publish: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this minute?')) return;
    try {
      await api(`/minutes/${id}`, { method: 'DELETE' });
      setMinutes(minutes.filter(m => m.id !== id));
      if (selectedMinute?.id === id) setSelectedMinute(null);
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  if (loading) return <div style={{ padding: '40px' }}><Skeleton height="40px" width="300px" /><div style={{ display: 'grid', gap: '20px', marginTop: '24px' }}>{[1,2,3].map(i => <Skeleton key={i} height="120px" width="100%" />)}</div></div>;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: '700', color: '#111827', letterSpacing: '-0.02em' }}>Meeting Minutes</h1>
          <p style={{ margin: '8px 0 0 0', color: '#6b7280', fontSize: '1.05rem' }}>Official records of estate meetings</p>
        </div>
        {isStaff && (
          <button 
            onClick={() => setShowForm(!showForm)}
            style={{ 
              padding: '12px 24px', 
              background: '#4f46e5', 
              color: 'white', 
              border: 'none', 
              borderRadius: '10px', 
              fontWeight: '600', 
              cursor: 'pointer',
              fontSize: '0.95rem',
              boxShadow: '0 4px 6px rgba(79, 70, 229, 0.2)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#4338ca'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#4f46e5'}
          >
            {showForm ? '✕ Cancel' : '+ Publish New'}
          </button>
        )}
      </div>

      {/* Publish Form (Staff Only) */}
      {showForm && isStaff && (
        <div style={{ 
          background: '#fff', 
          padding: '28px', 
          borderRadius: '16px', 
          border: '1px solid #e5e7eb',
          borderLeft: '4px solid #4f46e5',
          marginBottom: '32px', 
          boxShadow: '0 4px 6px rgba(0,0,0,0.05)' 
        }}>
          <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#111827', fontSize: '1.25rem', fontWeight: '600' }}>Publish New Minutes</h3>
          <form onSubmit={handlePublish}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '600', color: '#374151' }}>Meeting Title</label>
                <input 
                  required 
                  value={form.title} 
                  onChange={(e) => setForm({...form, title: e.target.value})} 
                  placeholder="e.g., October General Meeting" 
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', boxSizing: 'border-box', fontSize: '0.95rem' }} 
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '600', color: '#374151' }}>Meeting Date</label>
                <input 
                  required 
                  type="date" 
                  value={form.meeting_date} 
                  onChange={(e) => setForm({...form, meeting_date: e.target.value})} 
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', boxSizing: 'border-box', fontSize: '0.95rem' }} 
                />
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '600', color: '#374151' }}>Minutes Content</label>
              <textarea 
                required 
                value={form.content} 
                onChange={(e) => setForm({...form, content: e.target.value})} 
                rows="8" 
                placeholder="Paste the minutes here..." 
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontFamily: 'inherit', boxSizing: 'border-box', fontSize: '0.95rem', resize: 'vertical' }}
              ></textarea>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '600', color: '#374151' }}>Document Link (Optional)</label>
              <input 
                value={form.document_link} 
                onChange={(e) => setForm({...form, document_link: e.target.value})} 
                placeholder="e.g., Google Drive or Dropbox link to PDF" 
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', boxSizing: 'border-box', fontSize: '0.95rem' }} 
              />
            </div>
            <button 
              type="submit" 
              style={{ 
                padding: '12px 28px', 
                background: '#10b981', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px', 
                fontWeight: '600', 
                cursor: 'pointer',
                fontSize: '0.95rem',
                boxShadow: '0 4px 6px rgba(16, 185, 129, 0.2)'
              }}
            >
              Publish Minutes
            </button>
          </form>
        </div>
      )}

      {/* Minutes List */}
      {minutes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#9ca3af' }}>
          <div style={{ fontSize: '4rem', marginBottom: '16px' }}></div>
          <p style={{ fontSize: '1.2rem', fontWeight: '600', color: '#6b7280' }}>No meeting minutes published yet</p>
          <p style={{ fontSize: '0.95rem', color: '#9ca3af' }}>Official meeting records will appear here</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '20px' }}>
          {minutes.map((m, idx) => (
            <div 
              key={m.id} 
              style={{ 
                background: '#fff', 
                padding: '28px', 
                borderRadius: '16px', 
                border: '1px solid #e5e7eb',
                borderLeft: `4px solid ${COLORS[idx % COLORS.length]}`,
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                transition: 'all 0.2s ease', 
                cursor: 'pointer' 
              }}
              onClick={() => setSelectedMinute(m)}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.08)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <span style={{ 
                      background: COLORS[idx % COLORS.length] + '15', 
                      color: COLORS[idx % COLORS.length], 
                      padding: '6px 14px', 
                      borderRadius: '20px', 
                      fontSize: '0.85rem', 
                      fontWeight: '600' 
                    }}>
                      {formatDate(m.meeting_date)}
                    </span>
                    {m.document_link && (
                      <span style={{ 
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.85rem', 
                        color: '#059669',
                        fontWeight: '500'
                      }}>
                        📎 Attachment
                      </span>
                    )}
                  </div>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '1.35rem', color: '#111827', fontWeight: '700' }}>{m.title}</h3>
                  <p style={{ margin: 0, color: '#6b7280', fontSize: '1rem', lineHeight: '1.6' }}>
                    {m.content.substring(0, 200)}{m.content.length > 200 ? '...' : ''}
                  </p>
                </div>
                <div style={{ marginLeft: '24px', color: '#9ca3af', fontSize: '1.5rem', fontWeight: '300' }}>→</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full View Modal */}
      {selectedMinute && (
        <div style={{ 
          position: 'fixed', 
          top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.5)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 1000, 
          padding: '20px',
          backdropFilter: 'blur(4px)'
        }} onClick={() => setSelectedMinute(null)}>
          <div style={{ 
            background: '#fff', 
            borderRadius: '16px', 
            maxWidth: '750px', 
            width: '100%', 
            maxHeight: '85vh', 
            overflowY: 'auto', 
            padding: '36px',
            borderLeft: '4px solid #4f46e5',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <span style={{ 
                  background: '#eef2ff', 
                  color: '#4f46e5', 
                  padding: '6px 14px', 
                  borderRadius: '20px', 
                  fontSize: '0.85rem', 
                  fontWeight: '600' 
                }}>
                  {formatDate(selectedMinute.meeting_date)}
                </span>
                <h2 style={{ margin: '16px 0 0 0', color: '#111827', fontSize: '1.5rem', fontWeight: '700' }}>{selectedMinute.title}</h2>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                {selectedMinute.document_link && (
                  <a href={selectedMinute.document_link} target="_blank" rel="noopener noreferrer" style={{ 
                    padding: '10px 18px', 
                    background: '#10b981', 
                    color: 'white', 
                    textDecoration: 'none', 
                    borderRadius: '8px', 
                    fontSize: '0.9rem', 
                    fontWeight: '600',
                    boxShadow: '0 4px 6px rgba(16, 185, 129, 0.2)'
                  }}>📄 View PDF</a>
                )}
                {isStaff && (
                  <button onClick={() => handleDelete(selectedMinute.id)} style={{ 
                    padding: '10px 18px', 
                    background: '#ef4444', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '8px', 
                    cursor: 'pointer', 
                    fontWeight: '600',
                    fontSize: '0.9rem'
                  }}>🗑 Delete</button>
                )}
                <button onClick={() => setSelectedMinute(null)} style={{ 
                  padding: '10px 18px', 
                  background: '#f3f4f6', 
                  color: '#374151', 
                  border: 'none', 
                  borderRadius: '8px', 
                  cursor: 'pointer', 
                  fontWeight: '600',
                  fontSize: '0.9rem'
                }}>✕ Close</button>
              </div>
            </div>
            <div style={{ 
              whiteSpace: 'pre-wrap', 
              lineHeight: '1.8', 
              color: '#374151', 
              fontSize: '1.05rem',
              padding: '20px',
              background: '#f9fafb',
              borderRadius: '12px',
              border: '1px solid #e5e7eb'
            }}>
              {selectedMinute.content}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}