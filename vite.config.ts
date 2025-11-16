import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: '/Scorched-Earth-Game-Phase/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
    allowedHosts: [
      'localhost',
      '.ngrok-free.app',
      '.ngrok.io',
      '.ru.tuna.am', // Tuna tunnel service
    ],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },
});