import { createContext, useContext, useState } from 'react';

const Ctx = createContext(null);

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export function AuthProvider({ children }) {
  // Safely parse user from localStorage
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  });

  const login = async (email, password) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    // 1. Read the response as text first to prevent JSON parse crashes
    const text = await res.text();
    
    let data;
    try {
      // 2. Try to parse it as JSON
      data = JSON.parse(text);
    } catch {
      // 3. If it's not JSON, the backend likely crashed and sent a plain text error
      throw new Error(text || 'Login failed: Server returned an invalid response');
    }

    // 4. Check if the login was actually successful
    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }

    // 5. Save to localStorage and state
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return <Ctx.Provider value={{ user, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);