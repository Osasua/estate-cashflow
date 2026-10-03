import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';

export default function Categories() {
  const { user } = useAuth();
  const staff = ['admin', 'treasurer'].includes(user.role);
  
  const [categories, setCategories] = useState([]);
  const [newName, setNewName] = useState('');
  const [message, setMessage] = useState('');

  const load = () =>
    api('/expenses/categories') // Uses the route we just updated
      .then((d) => setCategories(d.categories))
      .catch((e) => setMessage(e.message));

  useEffect(() => { load(); }, []);

  const addCategory = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await api('/expenses/categories', { method: 'POST', body: { name: newName } });
      setNewName('');
      setMessage('Category added successfully!');
      load();
    } catch (err) {
      setMessage('Error adding category (it might already exist).');
    }
  };

  const toggleStatus = async (id) => {
    try {
      await api(`/expenses/categories/${id}`, { method: 'PUT' });
      load();
    } catch (err) {
      setMessage('Error updating category.');
    }
  };

  return (
    <div>
      <h1>Manage Categories</h1>
      
      {staff && (
        <form className="card form-row" onSubmit={addCategory} style={{ marginBottom: '20px' }}>
          <h3>Add New Category</h3>
          <input 
            placeholder="Category Name (e.g., Gardening)" 
            value={newName} 
            required
            onChange={(e) => setNewName(e.target.value)} 
            style={{ flex: 1 }}
          />
          <button>Create Category</button>
        </form>
      )}

      {message && <p className={message.includes('Error') ? 'error' : 'muted'}>{message}</p>}

      <div className="card">
        <h3>Existing Categories</h3>
        <table style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              {staff && <th style={{ textAlign: 'right' }}>Action</th>}
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} style={{ opacity: c.is_active ? 1 : 0.5 }}>
                <td>{c.name}</td>
                <td>
                  <span className={`badge ${c.is_active ? 'paid' : 'pending'}`}>
                    {c.is_active ? 'Active' : 'Hidden'}
                  </span>
                </td>
                {staff && (
                  <td style={{ textAlign: 'right' }}>
                    <button 
                      className="btn-ghost" 
                      onClick={() => toggleStatus(c.id)}
                    >
                      {c.is_active ? 'Hide (Soft Delete)' : 'Restore'}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {categories.length === 0 && <p className="muted">No categories found.</p>}
      </div>
    </div>
  );
}