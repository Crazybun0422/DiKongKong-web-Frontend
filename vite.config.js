import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const devApiTarget = process.env.VITE_DEV_API_PROXY_TARGET || 'http://localhost:7010'
const LOCAL_UOM_LAYER_DIRS = Object.freeze({
  current: 'D:/低空空/UOM/uom_demo/_layer/20260517/collected_exact_geojson_merged_geojson_tiles_current',
  green: 'D:/低空空/UOM/uom_demo/_layer/20260517/collected_exact_geojson_merged_geojson_tiles_green',
  gold: 'D:/低空空/UOM/uom_demo/_layer/20260517/collected_exact_geojson_merged_geojson_tiles_gold',
  coral: 'D:/低空空/UOM/uom_demo/_layer/20260517/collected_exact_geojson_merged_geojson_tiles_coral',
})

function localUomLayerPlugin() {
  return {
    name: 'local-uom-layer-plugin',
    configureServer(server) {
      server.middlewares.use('/api/local-uom-layer', (req, res) => {
        const pathname = req.url ? req.url.split('?')[0] : ''
        const match = pathname.match(/^\/([^/]+)\/(\d+)\/(\d+)\/(\d+)\.png$/i)
        if (!match) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ message: 'invalid local uom tile path' }))
          return
        }

        const variant = String(match[1] || '').trim().toLowerCase()
        const rootDir = LOCAL_UOM_LAYER_DIRS[variant]
        if (!rootDir) {
          res.statusCode = 404
          res.end()
          return
        }

        const tilePath = path.resolve(rootDir, match[2], match[3], `${match[4]}.png`)
        const normalizedRoot = path.resolve(rootDir)
        if (!tilePath.startsWith(normalizedRoot)) {
          res.statusCode = 403
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ message: 'forbidden' }))
          return
        }

        res.setHeader('Cache-Control', 'no-store')
        res.setHeader('Content-Type', 'image/png')
        if (!fs.existsSync(tilePath)) {
          res.statusCode = 404
          res.end()
          return
        }

        fs.createReadStream(tilePath)
          .on('error', () => {
            res.statusCode = 500
            res.end()
          })
          .pipe(res)
      })
    },
  }
}

export default defineConfig({
  plugins: [vue(), localUomLayerPlugin()],
  server: {
    host: '127.0.0.1',
    port: 5173,
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
