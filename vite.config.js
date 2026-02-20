import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: '.',
  publicDir: 'Sunnyside_World_Assets',
  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
        changeOrigin: true,
        rewriteWsOrigin: true
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  resolve: {
    alias: {
      '@engine': path.resolve(__dirname, 'engine'),
      '@assets': path.resolve(__dirname, 'Sunnyside_World_Assets')
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
});
