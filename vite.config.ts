import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development Vite serves the app on :5173 and forwards API + realtime
// traffic to the Node server on :3001. In production the Node server serves
// the built files itself, so everything lives on one port.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/socket.io': { target: 'http://localhost:3001', ws: true },
    },
  },
  build: {
    chunkSizeWarningLimit: 1500,
  },
});
