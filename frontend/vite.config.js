import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react({
    // Enable Fast Refresh (default is true, but being explicit)
    fastRefresh: true,
  })],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    strictPort: true, // Fail if port 5173 is not available instead of trying other ports
    host: true, // Allow external connections
    hmr: {
      overlay: true, // Show HMR errors in overlay
      port: 24678, // Use a different port for HMR WebSocket
    }
  },
  preview: {
    port: 4173,
    strictPort: true
  },
  build: {
    // Ensure case-sensitive imports are enforced
    rollupOptions: {
      external: [],
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['framer-motion', 'react-icons'],
          'vendor-qrcode': ['qrcode']
        }
      }
    }
  },
  // Optimize dependencies for better HMR
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom']
  }
})
