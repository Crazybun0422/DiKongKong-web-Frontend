import { tileXYToBBOX3857, mercatorToLonLat, wgs84ToGcj02, lonLatToMercator, gcj02ToWgs84 } from './coords'

const WMS_MIN_ZOOM = 5
const WMS_MAX_ZOOM = 18
const CAAC_TOKEN = '1e4b78fc-06bd-45be-8af7-cabd802ea9a8'
const CAAC_BASE = 'https://uom.caac.gov.cn/map/airspace/wms'

const lonLatToTile = (lng, lat, zoom) => {
  const scale = Math.pow(2, zoom)
  const x = Math.floor(((lng + 180) / 360) * scale)
  const sinLat = Math.sin((lat * Math.PI) / 180)
  const y = Math.floor((0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale)
  return { x, y }
}

const toQuery = (params) =>
  Object.keys(params)
    .map((key) => `${key}=${encodeURIComponent(params[key])}`)
    .join('&')

const buildProvinceLayers = () => {
  const PROVINCE_CODES = [
    '12', '13', '14', '15', '21', '22', '23', '31', '32', '33', '34', '35', '36', '37', '41', '42', '43', '44', '45',
    '46', '50', '51', '52', '53', '54', '61', '62', '63', '64', '65',
  ]
  const layers = PROVINCE_CODES.map((c) => `QGSFKYFW:sf${c}0000`).join(',')
  const styles = PROVINCE_CODES.map(() => 'QGSFKYFW:shifeikongyu').join(',')
  return { layers, styles }
}

export const createWmsMapType = (qqGlobal) => {
  if (!qqGlobal?.maps?.ImageMapType || !qqGlobal?.maps?.Size) return null
  const { layers, styles } = buildProvinceLayers()
  return new qqGlobal.maps.ImageMapType({
    name: 'UOM',
    tileSize: new qqGlobal.maps.Size(256, 256),
    isPng: true,
    getTileUrl: (tileCoord, zoom) => {
      const { x, y } = tileCoord
      if (zoom < WMS_MIN_ZOOM || zoom > WMS_MAX_ZOOM) return ''
      const bbox = tileXYToBBOX3857(x, y, zoom)
      const center = [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2]
      const centerLL = mercatorToLonLat(center[0], center[1])
      const gcjLL = wgs84ToGcj02(centerLL.lng, centerLL.lat)

      let dx = 0
      let dy = 0
      if (gcjLL) {
        const mWgs = lonLatToMercator(centerLL.lng, centerLL.lat)
        const mGcj = lonLatToMercator(gcjLL.lng, gcjLL.lat)
        dx = mGcj.x - mWgs.x
        dy = mGcj.y - mWgs.y
      }

      const reqBBox = [bbox[0] - dx, bbox[1] - dy, bbox[2] - dx, bbox[3] - dy]
      const params = new URLSearchParams({
        token: CAAC_TOKEN,
        service: 'WMS',
        request: 'GetMap',
        layers,
        styles,
        format: 'image/png8',
        transparent: 'true',
        version: '1.1.0',
        srs: 'EPSG:3857',
        width: '256',
        height: '256',
        bbox: reqBBox.join(','),
      })
      const directUrl = `${CAAC_BASE}?${params.toString()}`
      return directUrl;
    },
  })
}

export const buildWmsOverlay = (center, zoom, region) => {
  if (!center || zoom < WMS_MIN_ZOOM || zoom > WMS_MAX_ZOOM) return []

  const { layers, styles } = buildProvinceLayers()
  const tiles = []

  let xMin
  let xMax
  let yMin
  let yMax

  if (region?.northeast && region?.southwest) {
    const { northeast: ne, southwest: sw } = region
    const wgsNE = gcj02ToWgs84(ne.longitude, ne.latitude)
    const wgsSW = gcj02ToWgs84(sw.longitude, sw.latitude)
    const tNE = lonLatToTile(wgsNE.lng, wgsNE.lat, zoom)
    const tSW = lonLatToTile(wgsSW.lng, wgsSW.lat, zoom)
    xMin = Math.min(tNE.x, tSW.x)
    xMax = Math.max(tNE.x, tSW.x)
    yMin = Math.min(tNE.y, tSW.y)
    yMax = Math.max(tNE.y, tSW.y)
    if (xMax - xMin > 6) xMax = xMin + 6
    if (yMax - yMin > 6) yMax = yMin + 6
  } else {
    const wgsCenter = gcj02ToWgs84(center.longitude, center.latitude)
    const t = lonLatToTile(wgsCenter.lng, wgsCenter.lat, zoom)
    xMin = t.x - 1
    xMax = t.x + 1
    yMin = t.y - 1
    yMax = t.y + 1
  }

  for (let x = xMin; x <= xMax; x += 1) {
    for (let y = yMin; y <= yMax; y += 1) {
      const bbox = tileXYToBBOX3857(x, y, zoom)
      const cx = (bbox[0] + bbox[2]) / 2
      const cy = (bbox[1] + bbox[3]) / 2
      const cWgs = mercatorToLonLat(cx, cy)
      const cGcj = wgs84ToGcj02(cWgs.lng, cWgs.lat)
      const mWgs = lonLatToMercator(cWgs.lng, cWgs.lat)
      const mGcj = lonLatToMercator(cGcj.lng, cGcj.lat)
      const dx = mGcj.x - mWgs.x
      const dy = mGcj.y - mWgs.y
      const reqBBox = [bbox[0] - dx, bbox[1] - dy, bbox[2] - dx, bbox[3] - dy]

      const q = toQuery({
        token: CAAC_TOKEN,
        service: 'WMS',
        request: 'GetMap',
        layers,
        styles,
        format: 'image/png8',
        transparent: 'true',
        version: '1.1.0',
        srs: 'EPSG:3857',
        width: '256',
        height: '256',
        bbox: reqBBox.join(','),
      })

      const wgsSW = mercatorToLonLat(reqBBox[0], reqBBox[1])
      const wgsNE = mercatorToLonLat(reqBBox[2], reqBBox[3])
      const gcjSW = wgs84ToGcj02(wgsSW.lng, wgsSW.lat)
      const gcjNE = wgs84ToGcj02(wgsNE.lng, wgsNE.lat)

      const directUrl = `${CAAC_BASE}?${q}`

      tiles.push({
        id: `${zoom}-${x}-${y}`,
        src: directUrl,
        bounds: {
          southwest: { longitude: gcjSW.lng, latitude: gcjSW.lat },
          northeast: { longitude: gcjNE.lng, latitude: gcjNE.lat },
        },
        alpha: 0.65,
        opacity: 0.65,
        zIndex: 1,
      })
    }
  }

  return tiles
}

export { WMS_MIN_ZOOM, WMS_MAX_ZOOM }

export default {
  buildWmsOverlay,
  createWmsMapType,
  WMS_MIN_ZOOM,
  WMS_MAX_ZOOM,
}
