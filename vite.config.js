import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', 'react-router-dom']
  },
  server: {
    host: true,
    proxy: {
      '/bulksmsbd-proxy': {
        target: 'http://bulksmsbd.net',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/bulksmsbd-proxy/, '')
      }
    }
  }
})
