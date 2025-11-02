import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const devApiTarget = process.env.VITE_DEV_API_PROXY_TARGET || 'http://localhost:7010'

const devApiPreflightHandler = {
  name: 'dev-api-preflight',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.method === 'OPTIONS' && req.url?.startsWith('/api/')) {
        res.statusCode = 204
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
        const requestHeaders = req.headers['access-control-request-headers']
        res.setHeader('Access-Control-Allow-Headers', requestHeaders || 'authorization,content-type')
        res.end()
        return
      }
      next()
    })
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [devApiPreflightHandler, vue()],
  server: {
    proxy: {
      '/api': {
        target: devApiTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
