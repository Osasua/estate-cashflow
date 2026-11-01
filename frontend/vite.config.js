import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    // The hosted preview proxies this dev server under *.e2b.app hostnames
    allowedHosts: ['.e2b.app'],
    proxy: { '/api': 'http://localhost:4000' },
  },
  plugins: [
    react(),
  ],
});