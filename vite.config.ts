import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // уже было для REST:
      '/api': { target: 'https://ipotec-cex-nibellom.amvera.io', changeOrigin: true },
      // НОВОЕ: прокси для WebSocket Socket.IO
      '/socket.io': {
        target: 'https://ipotec-cex-nibellom.amvera.io',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
