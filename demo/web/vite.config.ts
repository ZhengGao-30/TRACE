import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

const r = (p: string) => path.resolve(process.cwd(), 'node_modules', p)







export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],





  resolve: {
    dedupe: ['react', 'react-dom', 'three'],
    alias: {
      react: r('react'),
      'react-dom': r('react-dom'),
      'react/jsx-runtime': r('react/jsx-runtime.js'),
      'react/jsx-dev-runtime': r('react/jsx-dev-runtime.js'),
      three: r('three'),
    },
  },

  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,

        configure: (proxy) => {
          proxy.on('proxyRes', (res) => {
            res.headers['cache-control'] = 'no-cache'
          })
        },
      },
    },
  },
})
