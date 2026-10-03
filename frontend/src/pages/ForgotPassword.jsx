import { useState } from 'react';
import { api } from '../api';
import { useNavigate } from 'react-router-dom';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
            const res = await api('/password/forgot', { 
        method: 'POST', 
        body: { email } 
      });
      setMessage(res.message || 'Check your email for the reset link!');
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px' }}>
      <h2 style={{ textAlign: 'center' }}>Forgot Password</h2>
      <p className="muted" style={{ textAlign: 'center', marginBottom: '20px' }}>
        Enter your email address and we'll send you a link to reset your password.
      </p>

      {message && <p style={{ color: 'green', textAlign: 'center', marginBottom: '15px' }}>{message}</p>}
      {error && <p style={{ color: 'red', textAlign: 'center', marginBottom: '15px' }}>{error}</p>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <input 
          type="email" 
          placeholder="Enter your email" 
          value={email} 
          required
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
        />
        <button 
          type="submit" 
          disabled={loading}
          style={{ padding: '10px', borderRadius: '5px', border: 'none', background: '#4f46e5', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: '20px' }}>
        <button className="btn-ghost" onClick={() => navigate('/login')}>← Back to Login</button>
      </p>
    </div>
  );
}