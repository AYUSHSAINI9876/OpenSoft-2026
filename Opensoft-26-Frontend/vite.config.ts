/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiUrl = env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1'
  let target = 'http://localhost:8080'

  try {
    target = new URL(apiUrl).origin
  } catch {
    // fallback to default target
  }

  return {
    plugins: [react(), tailwindcss()],
    test: {
      environment: 'jsdom',
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      globals: false,
    },
    build: {
      // Chunks are split by cache lifetime: the React runtime and the charting
      // library change far less often than app code, so a deploy that only
      // touches our own components leaves those vendor chunks cached.
      rollupOptions: {
        output: {
          // Rolldown (Vite 8) only accepts the function form of manualChunks.
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return
            if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
              return 'vendor-react'
            }
            if (id.includes('lightweight-charts')) return 'vendor-charts'
            if (id.includes('lucide-react')) return 'vendor-icons'
          },
        },
      },
      // Route chunks are now small; the remaining warning would be noise.
      chunkSizeWarningLimit: 700,
      // Cheap wins for payload size and debuggability in production.
      cssCodeSplit: true,
      sourcemap: false,
      reportCompressedSize: false,
      target: 'es2020',
    },
    server: {
      proxy: {
        '/api/v1': {
          target: target,
          changeOrigin: true,
        },
        '/auth': {
          target: target,
          changeOrigin: true,
        },
        '/ws': {
          target: target.replace(/^http/, 'ws'),
          changeOrigin: true,
          ws: true,
        },
      },
    },
  }
})
