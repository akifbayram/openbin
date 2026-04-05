import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['src/**/*.integration.test.{ts,tsx}'],
    setupFiles: ['src/__tests__/setup.ts'],
    fileParallelism: false,
  },
});
