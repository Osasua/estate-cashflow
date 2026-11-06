import { useEffect, useState } from 'react';
import { api } from '../api';
import { fmtDate } from '../format';
import Skeleton from '../components/Skeleton';

const CATEGORIES = [
  { id: 'all', label: ' All activity' },
  { id: 'signins', label: '🔐 Sign-ins' },
  { id: 'financial', label: '💰 Financial changes' },
];

const isSignin = (log) => log.action === 'LOGIN' || log.action === 'LOGIN_FAILED';

function badgeClass(log) {
  if (log.action === 'LOGIN') return 'paid';
  if (log.action === 'LOGIN_FAILED') return 'pending';
  return log.action === 'DELETE' ? 'pending' : 'paid';
}

export default function AuditLog() {
  const [logs, setLogs] = useState(null);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('all');

  useEffect(() => {
    setLogs(null);
    setError('');
    api(`/audit?category=${category}&limit=200`)
      .then((res) => setLogs(res.logs))
      .catch((e) => {
        setError(e.message);
        console.error(e);
      });
  }, [category]);

  if (error) return <div className="error">Error: {error}. (Make sure you are logged in as Admin)</div>;
  if (!logs) return (
    <div>
      <Skeleton height="30px" width="200px" />
      <Skeleton height="400px" width="100%" />
    </div>
  );

  return (
    <div>
      <h1>System Audit Log</h1>
      <p className="muted" style={{ marginBottom: '20px' }}>
        A secure, read-only record of sign-ins (who logged in, when, and from which IP —
        including failed attempts) and of all financial changes made within the system.
      </p>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: category === c.id ? '700' : '500',
              border: category === c.id ? '1px solid #4f46e5' : '1px solid #d1d5db',
              background: category === c.id ? '#eef2ff' : '#fff',
              color: category === c.id ? '#4338ca' : '#374151',
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="card">
        {logs.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', padding: '20px' }}>
            {category === 'signins'
              ? 'No sign-in events recorded yet. (Successful and failed logins appear here.)'
              : 'No audit logs found. (Actions will appear here as Admins and Treasurers edit data).'}
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
                <th style={{ padding: '12px' }}>Time</th>
                <th style={{ padding: '12px' }}>User</th>
                <th style={{ padding: '12px' }}>Action</th>
                <th style={{ padding: '12px' }}>Table</th>
                <th style={{ padding: '12px' }}>Record ID</th>
                <th style={{ padding: '12px' }}>Changes</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px', fontSize: '0.9rem', color: '#666' }}>
                    {fmtDate(log.created_at)}
                  </td>
                  <td style={{ padding: '12px', fontWeight: 'bold' }}>
                    {log.user_name
                      || (isSignin(log) && log.action === 'LOGIN_FAILED'
                        ? (log.new_value && log.new_value.email) || 'Unknown email'
                        : 'System')}
                    {log.action === 'LOGIN_FAILED' && (
                      <span className="muted" style={{ fontWeight: 'normal', fontSize: '0.8rem' }}> (failed attempt)</span>
                    )}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span className={`badge ${badgeClass(log)}`} style={{ textTransform: 'uppercase', fontSize: '0.75rem' }}>
                      {log.action === 'LOGIN' ? 'SIGN-IN' : log.action === 'LOGIN_FAILED' ? 'FAILED SIGN-IN' : log.action}
                    </span>
                  </td>
                  <td style={{ padding: '12px', textTransform: 'capitalize' }}>
                    {isSignin(log) ? 'auth / users' : log.table_name}
                  </td>
                  <td style={{ padding: '12px', fontFamily: 'monospace' }}>
                    {log.record_id === null || log.record_id === undefined ? '—' : `#${log.record_id}`}
                  </td>
                  <td style={{ padding: '12px', fontSize: '0.85rem' }}>
                    {isSignin(log) && log.new_value && (
                      <div className="muted" style={{ marginBottom: '4px' }}>
                         {log.new_value.ip || 'unknown IP'}
                        {log.new_value.user_agent ? ` · 🖥 ${String(log.new_value.user_agent).slice(0, 60)}` : ''}
                      </div>
                    )}
                    {log.new_value ? (
                      <details>
                        <summary style={{ cursor: 'pointer', color: '#4f46e5' }}>View Details</summary>
                        <pre style={{ background: '#f9fafb', padding: '10px', borderRadius: '4px', marginTop: '5px', fontSize: '0.75rem', overflowX: 'auto' }}>
                          {JSON.stringify(log.new_value, null, 2)}
                        </pre>
                      </details>
                    ) : (
                      <span className="muted">No details</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
