import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },

  optimizeDeps: {
    exclude: ['pdfjs-dist'] as string[],
  },

  build: {
    target: 'es2015',
    sourcemap: false,
    rollupOptions: {
      external: ['canvas'],
      output: {
        manualChunks(id: string) {
          if (id.includes('pdfjs-dist'))          return 'pdfjs'
          if (id.includes('react-router-dom'))    return 'react-vendor'
          if (id.includes('react-dom') ||
              id.includes('node_modules/react/')) return 'react-vendor'
          if (id.includes('@supabase'))           return 'supabase'
          if (id.includes('@tanstack'))           return 'query'
        },
      },
    },
    chunkSizeWarningLimit: 2500,
  },

  server: {
    port: 5173,
    strictPort: true,
  },
})
