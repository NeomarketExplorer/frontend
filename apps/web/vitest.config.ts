import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./src/test-setup.ts'],
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@app/ui': resolve(__dirname, '../../packages/ui/src'),
      '@app/api': resolve(__dirname, '../../packages/api/src'),
      '@app/trading': resolve(__dirname, '../../packages/trading/src'),
      '@app/config': resolve(__dirname, '../../packages/config/src'),
    },
  },
});
