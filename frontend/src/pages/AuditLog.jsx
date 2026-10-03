import { useEffect, useState } from 'react';
import { api } from '../api';
import { fmtDate } from '../format';
import Skeleton from '../components/Skeleton';

export default function AuditLog() {
  const [logs, setLogs] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/audit')
      .then((res) => setLogs(res.logs))
      .catch((e) => {
        setError(e.message);
        console.error(e);
      });
  }, []);

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
        A secure, read-only record of all financial changes made within the system.
      </p>

      <div className="card">
        {logs.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', padding: '20px' }}>
            No audit logs found. (Actions will appear here as Admins and Treasurers edit data).
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
                    {log.user_name || 'System'}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span className={`badge ${log.action === 'DELETE' ? 'pending' : 'paid'}`} style={{ textTransform: 'uppercase', fontSize: '0.75rem' }}>
                      {log.action}
                    </span>
                  </td>
                  <td style={{ padding: '12px', textTransform: 'capitalize' }}>
                    {log.table_name}
                  </td>
                  <td style={{ padding: '12px', fontFamily: 'monospace' }}>
                    #{log.record_id}
                  </td>
                  <td style={{ padding: '12px', fontSize: '0.85rem' }}>
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