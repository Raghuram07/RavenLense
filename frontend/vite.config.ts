import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/projects': 'http://localhost:8000',
      '/meetings': 'http://localhost:8000',
      '/bot': 'http://localhost:8000',
      '/clients': 'http://localhost:8000',
      '/employees': 'http://localhost:8000',
      '/knowledge': 'http://localhost:8000',
      '/performance': 'http://localhost:8000',
      '/chat': 'http://localhost:8000',
      '/dashboard': 'http://localhost:8000',
    },
  }
})
