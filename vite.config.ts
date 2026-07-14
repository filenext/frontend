import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import type { IncomingMessage } from 'node:http'

function clientAddress(req: IncomingMessage): string {
  const raw = req.socket.remoteAddress || ''
  return raw.replace(/^::ffff:/, '')
}

function forwardClientIP(proxyReq: { setHeader: (k: string, v: string) => void }, req: IncomingMessage) {
  const remote = clientAddress(req)
  if (!remote) return
  const existing = req.headers['x-forwarded-for']
  const xff = typeof existing === 'string' && existing.trim()
    ? `${existing}, ${remote}`
    : remote
  proxyReq.setHeader('X-Forwarded-For', xff)
  if (!req.headers['x-real-ip']) {
    proxyReq.setHeader('X-Real-IP', remote)
  }
}

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    host: '0.0.0.0',
    port: 8080,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8081',
        changeOrigin: true,
        xfwd: true,
        configure(proxy) {
          proxy.on('proxyReq', (proxyReq, req) => {
            const host = req.headers.host
            if (host) proxyReq.setHeader('X-Forwarded-Host', host)
            proxyReq.setHeader('X-Forwarded-Proto', 'http')
            forwardClientIP(proxyReq, req)
          })
          proxy.on('proxyRes', (proxyRes) => {
            if (proxyRes.headers['content-type']?.includes('text/event-stream')) {
              proxyRes.headers['cache-control'] = 'no-cache'
              proxyRes.headers['x-accel-buffering'] = 'no'
            }
          })
        },
      },
      '/avatars': {
        target: 'http://127.0.0.1:8081',
        changeOrigin: true,
        xfwd: true,
        configure(proxy) {
          proxy.on('proxyReq', (proxyReq, req) => {
            forwardClientIP(proxyReq, req)
          })
        },
      },
    },
  },
})
