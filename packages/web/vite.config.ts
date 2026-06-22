import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Backend dev: por defecto en http://127.0.0.1:8723
const API_TARGET = process.env.VITE_API_TARGET ?? 'http://127.0.0.1:8723';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Remote Terminal',
        short_name: 'Terminal',
        description: 'Maneja tus sesiones de terminal/tmux remotas desde el móvil.',
        theme_color: '#0b0e14',
        background_color: '#0b0e14',
        display: 'standalone',
        orientation: 'any',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api/terminal': { target: API_TARGET, ws: true, changeOrigin: true },
      '/api': { target: API_TARGET, changeOrigin: true },
    },
  },
});
