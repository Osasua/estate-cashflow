import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth';
import { POWERED_BY } from '../brand';

const CAPABILITIES = [
  ['💳', 'Pay contributions'],
  ['📄', 'Read your statement'],
  ['🛠️', 'Report maintenance'],
  ['📌', 'Follow the board'],
];

const HERO_VARIANTS = ['v1', 'v2', 'v3', 'v4'];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Hero text-placement variants: ?hero=v1..v4 to preview, ?review=1 shows
  // the floating switcher. Production default stays v1 until a variant is chosen.
  const [params, setParams] = useSearchParams();
  const initialVariant = HERO_VARIANTS.includes(params.get('hero')) ? params.get('hero') : 'v1';
  const [variant, setVariant] = useState(initialVariant);
  const review = params.get('review') === '1';
  const pickVariant = (v) => {
    setVariant(v);
    params.set('hero', v);
    setParams(params, { replace: true });
  };

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
    <div className="login-shell">
      {/* Brand hero — the estate's story before the sign-in */}
      <aside className={`login-hero hero-${variant}`}>
        <div className="login-hero-art" aria-hidden="true" />
        <div className="login-hero-orb orb-a" aria-hidden="true" />
        <div className="login-hero-orb orb-b" aria-hidden="true" />
        <div className="login-hero-content">
          <div className="login-hero-brand anim" style={{ animationDelay: '0.05s' }}>
            <img src="/favicon.png" alt="" style={{ width: '34px', height: '34px', borderRadius: '8px' }} />
            <span>Ferrano Court Portal</span>
          </div>
          <div className="login-hero-mid">
            <h1 className="anim" style={{ animationDelay: '0.15s' }}>
              One ledger.<br />Every household.<br />Full clarity.
            </h1>
            <p className="login-hero-tag anim" style={{ animationDelay: '0.25s' }}>
              Contributions, expenses, statements and maintenance for the
              Ferrano Court community — in one place, always in step.
            </p>
          </div>
          <div className="login-caps">
            {CAPABILITIES.map(([icon, label], i) => (
              <div key={label} className="login-cap anim" style={{ animationDelay: `${0.35 + i * 0.08}s` }}>
                <span className="login-cap-icon" aria-hidden="true">{icon}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Sign-in side */}
      <main className="login-side">
        <form className="login-card anim" style={{ animationDelay: '0.1s' }} onSubmit={submit}>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/favicon.png" alt="Logo" style={{ width: '24px', height: '24px' }} />
            <span>Sign in to your account</span>
          </div>
          <p className="muted">Residents and estate staff welcome</p>
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
        <div className="powered-by">{POWERED_BY}</div>
      </main>

      {review && (
        <div className="hero-switcher" role="group" aria-label="Hero layout variants">
          <span>LAYOUT</span>
          {HERO_VARIANTS.map((v) => (
            <button key={v} className={v === variant ? 'on' : ''} onClick={() => pickVariant(v)}>
              {v.toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
