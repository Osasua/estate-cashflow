import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';

export default function Categories() {
  const { user } = useAuth();
  const staff = ['admin', 'treasurer'].includes(user?.role);
  
  const [categories, setCategories] = useState([]);
  const [newName, setNewName] = useState('');
  const [message, setMessage] = useState('');
  
  // New state for editing
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  const load = () =>
    api('/expenses/categories')
      .then((d) => setCategories(d.categories))
      .catch((e) => setMessage(e.message));

  useEffect(() => { load(); }, []);

  const addCategory = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const res = await api('/expenses/categories', { method: 'POST', body: { name: newName } });
      setNewName('');
      setMessage(res.message || 'Category added successfully!');
      load();
    } catch (err) {
      setMessage(err.message || 'Error adding category.');
    }
  };

  const toggleStatus = async (id) => {
    try {
      await api(`/expenses/categories/${id}`, { method: 'PUT' });
      setMessage('Category status updated.');
      load();
    } catch (err) {
      setMessage('Error updating category.');
    }
  };

  const startEdit = (c) => {
    setEditingId(c.id);
    setEditName(c.name);
  };

  const saveEdit = async (id) => {
    if (!editName.trim()) return;
    try {
      const res = await api(`/expenses/categories/${id}`, { method: 'PATCH', body: { name: editName } });
      setEditingId(null);
      setEditName('');
      setMessage(res.message || 'Category updated successfully!');
      load();
    } catch (err) {
      setMessage(err.message || 'Error updating category.');
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '20px' }}>Manage Categories</h1>
      
      {staff && (
        <form onSubmit={addCategory} style={{ display: 'flex', gap: '10px', marginBottom: '20px', background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <input 
            placeholder="Category Name (e.g., Salaries)" 
            value={newName} 
            required
            onChange={(e) => setNewName(e.target.value)} 
            style={{ flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '4px' }}
          />
          <button type="submit" style={{ padding: '8px 16px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '500' }}>
            Add Category
          </button>
        </form>
      )}

      {message && (
        <p style={{ 
          padding: '10px 14px', 
          background: message.includes('Error') ? '#fef2f2' : '#f0fdf4',
          color: message.includes('Error') ? '#991b1b' : '#166534',
          borderRadius: '6px',
          marginBottom: '16px',
          fontSize: '0.875rem'
        }}>
          {message}
        </p>
      )}

      <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>Existing Categories</h3>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f9fafb' }}>
            <tr>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Name</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Status</th>
              {staff && <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6', opacity: c.is_active ? 1 : 0.5 }}>
                <td style={{ padding: '12px 16px' }}>
                  {editingId === c.id ? (
                    <input 
                      value={editName} 
                      onChange={(e) => setEditName(e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid #4f46e5', borderRadius: '4px' }}
                      autoFocus
                    />
                  ) : (
                    c.name
                  )}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '4px 8px',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    background: c.is_active ? '#dcfce7' : '#fee2e2',
                    color: c.is_active ? '#166534' : '#991b1b'
                  }}>
                    {c.is_active ? 'Active' : 'Hidden'}
                  </span>
                </td>
                {staff && (
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    {editingId === c.id ? (
                      <>
                        <button onClick={() => saveEdit(c.id)} style={{ marginRight: '8px', padding: '4px 8px', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>Save</button>
                        <button onClick={() => { setEditingId(null); setEditName(''); }} style={{ padding: '4px 8px', background: '#9ca3af', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(c)} style={{ marginRight: '8px', padding: '4px 8px', background: 'transparent', color: '#4f46e5', border: '1px solid #4f46e5', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>Edit</button>
                        <button onClick={() => toggleStatus(c.id)} style={{ padding: '4px 8px', background: 'transparent', color: c.is_active ? '#991b1b' : '#166534', border: `1px solid ${c.is_active ? '#991b1b' : '#166534'}`, borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>
                          {c.is_active ? 'Hide' : 'Restore'}
                        </button>
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {categories.length === 0 && <p style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>No categories found.</p>}
      </div>
    </div>
  );
}