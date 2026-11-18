import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')).render(<App />);

// PWA: register the service worker in production builds only — in dev it
// would cache stale modules. Browsers only allow this on HTTPS or localhost,
// which matches the hosted deployment.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) =>
      console.warn('Service worker registration failed:', err.message)
    );
  });
}
