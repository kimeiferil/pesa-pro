import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/**/*.types.ts',
        'src/**/*.d.ts'
      ]
    },
    // Test timeout in ms
    timeout: 5000,
    // Retry flaky tests
    retry: 2,
    // Enable test isolation
    isolate: false,
    // Mock date for consistent testing
    mockReset: true,
    // Allow console.error/output in tests (helpful for debugging)
    fakeTimers: {
      toFake: [
        'setTimeout',
        'setInterval',
        'clearTimeout',
        'clearInterval'
      ]
    }
  }
});