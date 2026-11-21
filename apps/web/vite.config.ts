import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { execSync } from 'child_process'
import { visualizer } from 'rollup-plugin-visualizer'

// CI sets GITHUB_SHA; local builds read it from git
const commitSha = (() => {
  try {
    return process.env.GITHUB_SHA || execSync('git rev-parse HEAD').toString().trim()
  } catch {
    return ''
  }
})()

export default defineConfig({
  define: {
    __COMMIT_SHA__: JSON.stringify(commitSha),
  },
  plugins: [
    react(),
    tailwindcss(),
    // ANALYZE=1 pnpm build writes the report outside dist so it is never deployed
    process.env.ANALYZE ? visualizer({ filename: 'bundle-stats.html', gzipSize: true, brotliSize: true }) : null,
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'chart-vendor': ['recharts'],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
    allowedHosts: ['localhost', '127.0.0.1', '.ngrok-free.app'],
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})
