import { defineConfig } from 'vite';

// Project-site base. Keep in sync with public/manifest.webmanifest.
// https://virtue-ed.github.io/fomo-desk-app/
export default defineConfig({
  base: '/fomo-desk-app/',
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  },
});
