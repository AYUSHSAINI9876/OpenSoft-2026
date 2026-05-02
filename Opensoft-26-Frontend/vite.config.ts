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
  } catch (e) {
    // fallback to default target
  }

  return {
    plugins: [react(), tailwindcss()],
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
      }
    }
  }
})
