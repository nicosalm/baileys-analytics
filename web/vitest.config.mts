import path from 'node:path'
import { defineConfig } from 'vitest/config'

// unit tests cover pure modules only, so the app's vite plugins are not loaded
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
