import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // The app calls relative /api paths and this forwards them to Spring Boot, so dev runs
    // same-origin and never hits CORS. Set VITE_API_BASE_URL to call a deployed API instead.
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
