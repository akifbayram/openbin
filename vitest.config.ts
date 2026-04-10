import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  define: {
    __EE__: JSON.stringify(false),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
