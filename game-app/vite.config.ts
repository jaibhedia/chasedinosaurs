import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    rollupOptions: {
      output: {
        // Phaser is most of the bundle and changes rarely; its own chunk means a
        // menu-only update doesn't make returning players re-download it.
        manualChunks: { phaser: ['phaser'] },
      },
    },
    chunkSizeWarningLimit: 1600,
  },
});
