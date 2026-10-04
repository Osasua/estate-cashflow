import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
  <img src="/favicon.png" alt="Logo" style={{ width: '24px', height: '24px' }} />
  <span>Ferrano Court Portal</span>
</div>
        <p className="muted">Sign in to your community account</p>
        <label>Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="error">{error}</p>}
        <button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
           <p style={{ textAlign: 'center', marginTop: '15px' }}>
     <a href="/forgot-password" style={{ color: '#4f46e5', textDecoration: 'none', fontSize: '0.9rem' }}>
       Forgot your password?
     </a>
   </p>
              </form>
    </div>
  );
}
