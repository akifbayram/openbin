import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/db/__tests__/pg-*.integration.test.{ts,tsx}'],
    fileParallelism: false,
  },
});
