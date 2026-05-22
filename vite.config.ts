import { defineConfig } from 'vite';

export default defineConfig({
  // Serve the asset/ folder as static files at the root URL
  // e.g. asset/warrok/Walking.glb → /warrok/Walking.glb
  publicDir: 'asset',
  server: {
    port: 3000,
    open: true,
  },
  optimizeDeps: {
    exclude: ['three'],
  },
});
