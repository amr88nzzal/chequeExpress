import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    // Source maps are a debugging aid, not a deployable: the last one measured
    // 3.0 MB against 618 kB of actual JavaScript, and the web image ships
    // whatever this directory contains. Set VITE_SOURCEMAP=1 when you need them.
    sourcemap: process.env['VITE_SOURCEMAP'] === '1',
  },
});
