import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

const r = (p: string) => path.resolve(process.cwd(), 'node_modules', p)

// The FastAPI backend runs inside WSL; WSL2 forwards listening sockets to
// Windows localhost, so a plain localhost proxy works from the Windows host.
//
// base: for GitHub Pages project sites the app is served from /<repo>/, so the
// build needs base='/<repo>/'. The Actions workflow passes it via BASE_PATH
// (auto-derived from the repo name). Dev and user/org root sites keep '/'.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],

  // react-three-fiber, framer-motion and recharts each resolve react on their
  // own. Without a hard alias Vite's dep optimizer can emit a second React copy
  // into a pre-bundled chunk and every hook call throws "Invalid hook call".
  // dedupe alone was not enough here -- the absolute alias is.
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
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        // SSE must not be buffered
        configure: (proxy) => {
          proxy.on('proxyRes', (res) => {
            res.headers['cache-control'] = 'no-cache'
          })
        },
      },
    },
  },
})
