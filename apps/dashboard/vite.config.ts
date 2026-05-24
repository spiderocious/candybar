import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@app', replacement: path.resolve(__dirname, 'src') },
      { find: '@features', replacement: path.resolve(__dirname, 'src/features') },
      { find: '@shared', replacement: path.resolve(__dirname, 'src/shared') },
      { find: '@ui', replacement: path.resolve(__dirname, 'src/ui') },
      { find: '@icons', replacement: path.resolve(__dirname, 'src/ui/icons/index.ts') },
      {
        find: /^@communique\/core$/,
        replacement: path.resolve(__dirname, '../../packages/core/src/index.ts'),
      },
    ],
  },
  server: { port: 5173 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
