import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import Skeleton from '../components/Skeleton';

const CATEGORY_COLORS = [
  { bg: '#eef2ff', text: '#4f46e5', border: '#6366f1', gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' },
  { bg: '#ecfdf5', text: '#059669', border: '#22c55e', gradient: 'linear-gradient(135deg, #22c55e 0%, #10b981 100%)' },
  { bg: '#fffbeb', text: '#d97706', border: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)' },
  { bg: '#fff1f2', text: '#e11d48', border: '#ef4444', gradient: 'linear-gradient(135deg, #ef4444 0%, #f43f5e 100%)' },
  { bg: '#ecfeff', text: '#0891b2', border: '#06b6d4', gradient: 'linear-gradient(135deg, #06b6d4 0%, #22d3ee 100%)' },
  { bg: '#f5f3ff', text: '#7c3aed', border: '#a855f7', gradient: 'linear-gradient(135deg, #a855f7 0%, #d946ef 100%)' },
  { bg: '#f8fafc', text: '#475569', border: '#64748b', gradient: 'linear-gradient(135deg, #64748b 0%, #94a3b8 100%)' },
  { bg: '#f0fdf4', text: '#16a34a', border: '#84cc16', gradient: 'linear-gradient(135deg, #84cc16 0%, #a3e635 100%)' },
  { bg: '#fdf4ff', text: '#c026d3', border: '#ec4899', gradient: 'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)' },
  { bg: '#f0fdfa', text: '#0d9488', border: '#14b8a6', gradient: 'linear-gradient(135deg, #14b8a6 0%, #2dd4bf 100%)' },
];

const CATEGORY_ICONS = {
  'Cleaning Service': '',
  'Electricity Payment': '',
  'Facility Management': '',
  'Fuel & Oil Purchase': '⛽',
  'Miscallenous': '📦',
  'Repairs and Maintenance': '🔧',
  'Security Service': '🛡️',
  'Waste Disposal': '🗑️',
};

export default function Categories() {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const res = await api('/categories');
      setCategories(res.categories || []);
    } catch (err) {
      console.error('Failed to load categories:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await api('/categories', { method: 'POST', body: { name: newName.trim() } });
      setNewName('');
      setMessage('✅ Category added successfully!');
      setTimeout(() => setMessage(''), 3000);
      await loadCategories();
    } catch (err) {
      setMessage('❌ ' + err.message);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleEdit = async (id) => {
    if (!editingName.trim()) return;
    try {
      await api(`/categories/${id}`, { method: 'PUT', body: { name: editingName.trim() } });
      setEditingId(null);
      setEditingName('');
      setMessage('✅ Category updated successfully!');
      setTimeout(() => setMessage(''), 3000);
      await loadCategories();
    } catch (err) {
      setMessage('❌ ' + err.message);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleToggle = async (id, currentStatus) => {
    try {
      await api(`/categories/${id}`, { method: 'PUT', body: { is_active: !currentStatus } });
      setMessage(`✅ Category ${!currentStatus ? 'activated' : 'hidden'}!`);
      setTimeout(() => setMessage(''), 3000);
      await loadCategories();
    } catch (err) {
      setMessage('❌ ' + err.message);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this category?')) return;
    try {
      await api(`/categories/${id}`, { method: 'DELETE' });
      setMessage('🗑️ Category deleted!');
      setTimeout(() => setMessage(''), 3000);
      await loadCategories();
    } catch (err) {
      setMessage('❌ ' + err.message);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const getCategoryStyle = (index) => CATEGORY_COLORS[index % CATEGORY_COLORS.length];
  const getCategoryIcon = (name) => CATEGORY_ICONS[name] || '';

  if (loading) return <div style={{ padding: '40px' }}><Skeleton height="40px" width="300px" /><div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginTop: '24px' }}>{[1,2,3,4,5,6].map(i => <Skeleton key={i} height="120px" width="100%" />)}</div></div>;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '2rem', fontWeight: '700', color: '#111827', letterSpacing: '-0.02em' }}>
          Manage Categories
        </h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '1.05rem' }}>
          Organize expenses with custom categories
        </p>
      </div>

      {/* Message Banner */}
      {message && (
        <div style={{
          background: message.includes('✅') || message.includes('️') ? '#ecfdf5' : '#fff1f2',
          border: `1px solid ${message.includes('✅') || message.includes('🗑️') ? '#a7f3d0' : '#fecdd3'}`,
          borderLeft: `4px solid ${message.includes('✅') || message.includes('🗑️') ? '#22c55e' : '#ef4444'}`,
          borderRadius: '12px',
          padding: '16px 24px',
          marginBottom: '24px',
          fontSize: '0.95rem',
          fontWeight: '500',
          color: '#111827'
        }}>
          {message}
        </div>
      )}

      {/* Add Category Form */}
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        border: '1px solid #e5e7eb',
        borderLeft: '4px solid #6366f1',
        borderTop: '4px solid #6366f1',
        padding: '28px',
        marginBottom: '32px',
        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.08)'
      }}>
        <h3 style={{ margin: '0 0 20px 0', fontSize: '1.25rem', fontWeight: '600', color: '#111827' }}>
          ➕ Add New Category
        </h3>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: '#374151' }}>Category Name</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g., Salaries, Insurance, Landscaping"
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #e5e7eb',
                borderRadius: '10px',
                fontSize: '1rem',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#6366f1'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>
          <button
            type="submit"
            style={{
              padding: '12px 28px',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontWeight: '600',
              fontSize: '1rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            Add Category
          </button>
        </form>
      </div>

      {/* Categories Grid */}
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        border: '1px solid #e5e7eb',
        borderLeft: '4px solid #22c55e',
        padding: '28px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600', color: '#111827' }}>
            📂 Existing Categories
          </h3>
          <span style={{
            background: '#eef2ff',
            color: '#4f46e5',
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '0.85rem',
            fontWeight: '600'
          }}>
            {categories.length} total
          </span>
        </div>

        {categories.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
            <div style={{ fontSize: '4rem', marginBottom: '16px' }}>📁</div>
            <p style={{ fontSize: '1.1rem', fontWeight: '600', color: '#6b7280' }}>No categories yet</p>
            <p style={{ fontSize: '0.95rem' }}>Add your first category above to get started</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {categories.map((cat, idx) => {
              const style = getCategoryStyle(idx);
              const icon = getCategoryIcon(cat.name);
              const isEditing = editingId === cat.id;

              return (
                <div
                  key={cat.id}
                  style={{
                    background: '#fff',
                    borderRadius: '14px',
                    border: '1px solid #e5e7eb',
                    borderLeft: `4px solid ${style.border}`,
                    padding: '20px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = `0 8px 20px ${style.border}20`;
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: style.gradient,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.5rem',
                        boxShadow: `0 4px 8px ${style.border}30`
                      }}>
                        {icon}
                      </div>
                      <div>
                        {isEditing ? (
                          <input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            style={{
                              padding: '6px 10px',
                              border: `2px solid ${style.border}`,
                              borderRadius: '6px',
                              fontSize: '1rem',
                              fontWeight: '600',
                              width: '180px'
                            }}
                            autoFocus
                          />
                        ) : (
                          <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: '#111827' }}>
                            {cat.name}
                          </h4>
                        )}
                        <div style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          background: cat.is_active ? '#dcfce7' : '#fef3c7',
                          color: cat.is_active ? '#166534' : '#92400e',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          marginTop: '6px'
                        }}>
                          {cat.is_active ? '✓ Active' : '⏸ Hidden'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => handleEdit(cat.id)}
                          style={{
                            padding: '8px 16px',
                            background: style.gradient,
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: '600',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            boxShadow: `0 2px 6px ${style.border}30`
                          }}
                        >
                          ✓ Save
                        </button>
                        <button
                          onClick={() => { setEditingId(null); setEditingName(''); }}
                          style={{
                            padding: '8px 16px',
                            background: '#f3f4f6',
                            color: '#374151',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: '600',
                            fontSize: '0.85rem',
                            cursor: 'pointer'
                          }}
                        >
                          ✕ Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => { setEditingId(cat.id); setEditingName(cat.name); }}
                          style={{
                            padding: '8px 16px',
                            background: '#fff',
                            color: style.text,
                            border: `2px solid ${style.border}`,
                            borderRadius: '8px',
                            fontWeight: '600',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = style.bg;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#fff';
                          }}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleToggle(cat.id, cat.is_active)}
                          style={{
                            padding: '8px 16px',
                            background: cat.is_active ? '#fff' : '#dcfce7',
                            color: cat.is_active ? '#dc2626' : '#166534',
                            border: `2px solid ${cat.is_active ? '#fecaca' : '#86efac'}`,
                            borderRadius: '8px',
                            fontWeight: '600',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = cat.is_active ? '#fef2f2' : '#dcfce7';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = cat.is_active ? '#fff' : '#dcfce7';
                          }}
                        >
                          {cat.is_active ? '🙈 Hide' : '️ Show'}
                        </button>
                        <button
                          onClick={() => handleDelete(cat.id)}
                          style={{
                            padding: '8px 16px',
                            background: '#fff',
                            color: '#dc2626',
                            border: '2px solid #fecaca',
                            borderRadius: '8px',
                            fontWeight: '600',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#fef2f2';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#fff';
                          }}
                        >
                          🗑️ Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}