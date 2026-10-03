export default function KpiCard({ label, value, color = '#4f46e5', sub }) {
  return (
    <div style={{
      background: 'white',
      borderRadius: '8px',
      border: '1px solid #e5e7eb',
      borderLeft: `4px solid ${color}`,
      padding: '20px 24px',
      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    }}>
      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '8px', fontWeight: '500' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#111827' }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '6px' }}>
          {sub}
        </div>
      )}
    </div>
  );
}