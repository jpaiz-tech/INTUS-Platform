import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// INTUS Platform dev server: port 5174 (the frozen "research project" uses 5173)
// Backend dev server: port 3002 (the frozen one uses 3001)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:3002',
      '/dashboard-outputs': 'http://localhost:3002',
      '/assets': 'http://localhost:3002',
    },
  },
});
