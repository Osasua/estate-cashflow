import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import Skeleton from '../components/Skeleton';

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
      // Refresh list
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
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: '700', color: '#111827' }}>Meeting Minutes</h1>
          <p style={{ margin: '8px 0 0 0', color: '#6b7280' }}>Official records of estate meetings</p>
        </div>
        {isStaff && (
          <button 
            onClick={() => setShowForm(!showForm)}
            style={{ padding: '10px 20px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
          >
            {showForm ? 'Cancel' : '+ Publish New'}
          </button>
        )}
      </div>

      {/* Publish Form (Staff Only) */}
      {showForm && isStaff && (
        <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '32px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginTop: 0, color: '#111827' }}>Publish New Minutes</h3>
          <form onSubmit={handlePublish}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '600', color: '#374151' }}>Meeting Title</label>
                <input required value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} placeholder="e.g., October General Meeting" style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '600', color: '#374151' }}>Meeting Date</label>
                <input required type="date" value={form.meeting_date} onChange={(e) => setForm({...form, meeting_date: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '600', color: '#374151' }}>Minutes Content</label>
              <textarea required value={form.content} onChange={(e) => setForm({...form, content: e.target.value})} rows="8" placeholder="Paste the minutes here..." style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box' }}></textarea>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '600', color: '#374151' }}>Document Link (Optional)</label>
              <input value={form.document_link} onChange={(e) => setForm({...form, document_link: e.target.value})} placeholder="e.g., Google Drive or Dropbox link to PDF" style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' }} />
            </div>
            <button type="submit" style={{ padding: '10px 24px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>Publish Minutes</button>
          </form>
        </div>
      )}

      {/* Minutes List */}
      {minutes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📋</div>
          <p style={{ fontSize: '1.1rem', fontWeight: '600' }}>No meeting minutes published yet</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {minutes.map((m) => (
            <div key={m.id} style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb', transition: 'all 0.2s', cursor: 'pointer' }}
              onClick={() => setSelectedMinute(m)}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <span style={{ background: '#eef2ff', color: '#4f46e5', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600' }}>
                      {formatDate(m.meeting_date)}
                    </span>
                    {m.document_link && <span style={{ fontSize: '0.8rem', color: '#059669' }}>📎 Attachment</span>}
                  </div>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: '#111827' }}>{m.title}</h3>
                  <p style={{ margin: 0, color: '#6b7280', fontSize: '0.95rem', lineHeight: '1.5' }}>
                    {m.content.substring(0, 150)}{m.content.length > 150 ? '...' : ''}
                  </p>
                </div>
                <div style={{ marginLeft: '20px', color: '#9ca3af', fontSize: '1.5rem' }}>→</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full View Modal */}
      {selectedMinute && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={() => setSelectedMinute(null)}>
          <div style={{ background: '#fff', borderRadius: '16px', maxWidth: '700px', width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: '32px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <span style={{ background: '#eef2ff', color: '#4f46e5', padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: '600' }}>
                  {formatDate(selectedMinute.meeting_date)}
                </span>
                <h2 style={{ margin: '12px 0 0 0', color: '#111827' }}>{selectedMinute.title}</h2>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {selectedMinute.document_link && (
                  <a href={selectedMinute.document_link} target="_blank" rel="noopener noreferrer" style={{ padding: '8px 16px', background: '#10b981', color: 'white', textDecoration: 'none', borderRadius: '6px', fontSize: '0.9rem', fontWeight: '600' }}>View PDF</a>
                )}
                {isStaff && (
                  <button onClick={() => handleDelete(selectedMinute.id)} style={{ padding: '8px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Delete</button>
                )}
                <button onClick={() => setSelectedMinute(null)} style={{ padding: '8px 16px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Close</button>
              </div>
            </div>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.7', color: '#374151', fontSize: '1rem' }}>
              {selectedMinute.content}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}