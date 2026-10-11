import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// API server port (5000 is taken by AirPlay Receiver on macOS)
const apiPort = process.env.API_PORT || '5001'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': { target: `http://localhost:${apiPort}`, changeOrigin: true },
    },
  },
})
