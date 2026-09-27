import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api/cameras': 'http://localhost:8001',
      '/api/departments': 'http://localhost:8001',
      '/api/gis': 'http://localhost:8001',
      '/api/ingest': 'http://localhost:8002',
      '/api/relay': 'http://localhost:8002',
      '/api/analytics': 'http://localhost:8003',
      '/api/alerts': 'http://localhost:8004',
      '/stream': 'http://localhost:8555'
    }
  }
});
