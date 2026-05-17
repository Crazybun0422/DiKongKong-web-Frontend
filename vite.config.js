import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const devApiTarget = process.env.VITE_DEV_API_PROXY_TARGET || 'http://localhost:7010'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': {
        target: devApiTarget,
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: devApiTarget,
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      '/tmap': {
        target: 'https://apis.map.qq.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/tmap/, ''),
      },
    },
  },
})
