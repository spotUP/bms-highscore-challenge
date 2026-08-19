import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    // Threads pool hangs on exit when a suite leaves handles open (jsdom timers).
    pool: 'forks',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.ts'],
    // Dates are asserted in the app's own timezone; keep runs reproducible.
    // No realtime socket in tests; jsdom's WebSocket blows up on connect.
    env: { TZ: 'Europe/Stockholm', VITE_WS_URL: '' },
  },
});
