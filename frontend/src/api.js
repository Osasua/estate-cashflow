// TEMPORARY FIX: Hardcode the URL
const API_BASE = 'https://estate-cashflow.onrender.com/api'; 

export async function api(path, opts = {}) {
  const token = localStorage.getItem('token');
  
  // Check if we are sending a File (FormData)
  const isFormData = opts.body instanceof FormData;

  const headers = {
    Authorization: token ? `Bearer ${token}` : undefined,
    // If it's FormData, DON'T set Content-Type. The browser will set it automatically with the correct boundary.
    // If it's JSON, set it to application/json.
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...opts.headers,
  };

  // If it's not FormData, stringify the body. Otherwise, pass FormData as-is.
  const body = isFormData ? opts.body : (opts.body ? JSON.stringify(opts.body) : undefined);

  try {
    const res = await fetch(API_BASE + path, {
      ...opts,
      headers,
      body,
    });

    if (res.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
      throw new Error('Session expired');
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  } catch (error) {
    // Offline queue logic: if it's a network error (TypeError) on a POST/PUT/DELETE, save it for later
    if (opts.method && opts.method !== 'GET' && error instanceof TypeError) {
      const QUEUE_KEY = 'ec_offline_queue';
      const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
      localStorage.setItem(QUEUE_KEY, JSON.stringify([...q, { path, opts }]));
      return { queued: true };
    }
    throw error;
  }
}

// Flush queue when the browser detects it's back online
window.addEventListener('online', async () => {
  const QUEUE_KEY = 'ec_offline_queue';
  const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  if (!q.length) return;
  
  localStorage.setItem(QUEUE_KEY, '[]'); // clear optimistically
  for (const item of q) {
    try {
      await api(item.path, item.opts);
    } catch {
      // If it fails again, put it back in the queue
      const currentQ = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
      localStorage.setItem(QUEUE_KEY, JSON.stringify([...currentQ, item]));
      break;
    }
  }
});

export const queuedCount = () => {
  const QUEUE_KEY = 'ec_offline_queue';
  return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]').length;
};