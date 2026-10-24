// Add this state at the top with other useState hooks
const [editModalOpen, setEditModalOpen] = useState(false);
const [editForm, setEditForm] = useState({ amount: '', reference: '' });

// Replace handleEdit with this
const handleEdit = (contribution) => {
  setEditForm({
    amount: contribution.amount_due || '',
    reference: contribution.references || ''
  });
  setSelectedContribution(contribution);
  setEditModalOpen(true);
};

// Add this function
const handleEditSave = () => {
  if (!editForm.amount || parseFloat(editForm.amount) <= 0) {
    setMessage('❌ Amount must be greater than 0');
    setTimeout(() => setMessage(''), 3000);
    return;
  }

  api(`/contributions/${selectedContribution.id}`, {
    method: 'PUT',
    body: { 
      amount_due: parseFloat(editForm.amount),
      note: editForm.reference.trim() === '' ? null : editForm.reference
    }
  }).then(() => {
    setMessage('✅ Contribution updated successfully');
    setTimeout(() => setMessage(''), 3000);
    setEditModalOpen(false);
    loadContributions();
  }).catch(err => {
    setMessage('❌ Failed to update: ' + err.message);
    setTimeout(() => setMessage(''), 5000);
  });
};

// Add this modal component (inside the main return, before closing </div>)
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
        ✏️ Edit Contribution
      </h3>
      
      <div style={{ marginBottom: '20px', padding: '16px', background: '#f9fafb', borderRadius: '12px' }}>
        <div style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '4px' }}>Household</div>
        <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#111827' }}>
          {selectedContribution.household_name}
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
          style={{
            width: '100%',
            padding: '12px',
            border: '2px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: '1rem',
            boxSizing: 'border-box'
          }}
          placeholder="Enter amount"
          autoFocus
        />
      </div>

      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: '600', color: '#374151' }}>
          Reference / Note
        </label>
        <input
          type="text"
          value={editForm.reference}
          onChange={(e) => setEditForm({...editForm, reference: e.target.value})}
          style={{
            width: '100%',
            padding: '12px',
            border: '2px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: '1rem',
            boxSizing: 'border-box'
          }}
          placeholder="e.g., Sept - Dec-2, Sept - Dec-3"
        />
      </div>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
        <button
          onClick={() => setEditModalOpen(false)}
          style={{
            padding: '12px 24px',
            background: '#f3f4f6',
            color: '#374151',
            border: 'none',
            borderRadius: '8px',
            fontWeight: '600',
            cursor: 'pointer',
            fontSize: '0.95rem'
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleEditSave}
          style={{
            padding: '12px 24px',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontWeight: '600',
            cursor: 'pointer',
            fontSize: '0.95rem',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
          }}
        >
           Save Changes
        </button>
      </div>
    </div>
  </div>
)}