/**
 * @deprecated Use `npm run dev` (Python static server on port 3000).
 * See CANONICAL_SOURCE.md — do not use port 3039.
 */
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  server: {
    port: 3000,
    strictPort: true,
    host: '127.0.0.1',
    open: '/',
  },
  preview: {
    port: 3000,
    strictPort: true,
  },
});
