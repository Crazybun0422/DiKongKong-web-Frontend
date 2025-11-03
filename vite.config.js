import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const devApiTarget = process.env.VITE_DEV_API_PROXY_TARGET || 'http://localhost:7010'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      // 你的后端
      '/api': {
        target: devApiTarget,
        changeOrigin: true,
        secure: false,
      },
      // 腾讯地图 WebService 统一从 /tmap 走
      '/tmap': {
        target: 'https://apis.map.qq.com',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/tmap/, ''),
        // 一般不需要手动加 CORS 头，因为请求是同源打到 :5173，再由代理转发
        // 如果你确实有特殊 header 需求可以在这里加 configure 钩子
      },
    },
  },
})