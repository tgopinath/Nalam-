import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const api = process.env.VITE_DEV_API || 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': api, '/static': api, '/uploads': api, '/pay': api },
  },
});
