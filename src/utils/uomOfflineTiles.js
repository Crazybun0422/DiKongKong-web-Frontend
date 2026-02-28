import { buildWmsTilesForGcjPolygon, WMS_MAX_ZOOM, WMS_MIN_ZOOM } from './airspaceWms'

const DEFAULT_MAX_TILES = Number.POSITIVE_INFINITY
const DEFAULT_CONCURRENCY = 6

const toNumber = (value, fallback = 0) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

const normalizeGcjPoint = (point) => {
  const latitude = toNumber(point?.latitude ?? point?.lat, NaN)
  const longitude = toNumber(point?.longitude ?? point?.lng, NaN)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  return { latitude, longitude }
}

const sanitizeToken = (value) => String(value || '').replace(/[^a-zA-Z0-9._-]/g, '_')

const formatCoord = (value) => {
  const num = Number(value)
  return Number.isFinite(num) ? num.toFixed(4) : 'na'
}

const formatTime = (date = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

const polygonBounds = (polygon) => {
  const latitudes = polygon.map((point) => point.latitude)
  const longitudes = polygon.map((point) => point.longitude)
  return {
    minLat: Math.min(...latitudes),
    maxLat: Math.max(...latitudes),
    minLng: Math.min(...longitudes),
    maxLng: Math.max(...longitudes),
  }
}

const triggerBrowserDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

const mapConcurrent = async (items, concurrency, worker) => {
  const safeConcurrency = Math.max(1, Math.floor(concurrency))
  const results = new Array(items.length)
  let cursor = 0

  const runWorker = async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      try {
        results[index] = await worker(items[index], index)
      } catch (error) {
        results[index] = { ok: false, error }
      }
    }
  }

  const workers = Array.from({ length: Math.min(safeConcurrency, items.length) }, () => runWorker())
  await Promise.all(workers)
  return results
}

const buildFilename = (zoom, bounds, count) => {
  const token = [
    `z${zoom}`,
    `lng${formatCoord(bounds.minLng)}-${formatCoord(bounds.maxLng)}`,
    `lat${formatCoord(bounds.minLat)}-${formatCoord(bounds.maxLat)}`,
    `n${count}`,
    formatTime(),
  ]
    .map(sanitizeToken)
    .join('_')
  return `ll-planet_${token}.zip`
}

const buildRangeFilename = (startZoom, endZoom, bounds, count) => {
  const token = [
    `z${startZoom}-${endZoom}`,
    `lng${formatCoord(bounds.minLng)}-${formatCoord(bounds.maxLng)}`,
    `lat${formatCoord(bounds.minLat)}-${formatCoord(bounds.maxLat)}`,
    `n${count}`,
    formatTime(),
  ]
    .map(sanitizeToken)
    .join('_')
  return `ll-planet_${token}.zip`
}

const toProgressPercent = (completed, total) => {
  if (!Number.isFinite(total) || total <= 0) return 0
  const value = Math.round((Math.max(0, completed) / total) * 100)
  return Math.max(0, Math.min(100, value))
}

export const exportUomTilesZip = async ({
  polygon,
  zoom,
  maxTiles = DEFAULT_MAX_TILES,
  concurrency = DEFAULT_CONCURRENCY,
} = {}) => {
  const normalizedPolygon = Array.isArray(polygon) ? polygon.map(normalizeGcjPoint).filter(Boolean) : []
  if (normalizedPolygon.length < 3) {
    const error = new Error('anchor polygon is empty')
    error.code = 'ANCHOR_POLYGON_EMPTY'
    throw error
  }

  const zoomValue = Math.round(toNumber(zoom, NaN))
  if (!Number.isFinite(zoomValue) || zoomValue < WMS_MIN_ZOOM || zoomValue > WMS_MAX_ZOOM) {
    const error = new Error('zoom out of range')
    error.code = 'ZOOM_OUT_OF_RANGE'
    throw error
  }

  const { tiles, truncated } = buildWmsTilesForGcjPolygon(normalizedPolygon, zoomValue, { maxTiles })
  if (!tiles.length) {
    const error = new Error('no intersecting tiles')
    error.code = 'NO_TILES'
    throw error
  }

  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const bounds = polygonBounds(normalizedPolygon)
  const rootDir = sanitizeToken(
    `ll-planet_z${zoomValue}_lng${formatCoord(bounds.minLng)}_${formatCoord(bounds.maxLng)}_lat${formatCoord(bounds.minLat)}_${formatCoord(bounds.maxLat)}`,
  )

  const results = await mapConcurrent(tiles, concurrency, async (tile) => {
    const response = await fetch(tile.src, { mode: 'cors' })
    if (!response.ok) {
      throw new Error(`tile fetch failed: ${tile.id} ${response.status}`)
    }
    const blob = await response.blob()
    const relativePath = `z${zoomValue}/x${tile.x}/y${tile.y}.png`
    zip.file(`${rootDir}/${relativePath}`, blob)
    return { ok: true, tile, relativePath, bytes: blob.size || 0 }
  })

  const okResults = results.filter((entry) => entry?.ok)
  const failedResults = results.filter((entry) => !entry?.ok)
  if (!okResults.length) {
    const error = new Error('tile download failed')
    error.code = 'ALL_TILE_DOWNLOAD_FAILED'
    throw error
  }

  const metadata = {
    type: 'll-planet-offline-tiles',
    generatedAt: new Date().toISOString(),
    zoom: zoomValue,
    rootDir,
    filePattern: `${rootDir}/z{z}/x{x}/y{y}.png`,
    polygon: normalizedPolygon,
    bounds,
    tileSummary: {
      attempted: tiles.length,
      downloaded: okResults.length,
      failed: failedResults.length,
      truncated,
    },
    tiles: okResults.map((entry) => ({
      id: entry.tile.id,
      x: entry.tile.x,
      y: entry.tile.y,
      z: entry.tile.zoom,
      bounds: entry.tile.bounds,
      path: `${rootDir}/${entry.relativePath}`,
      size: entry.bytes,
    })),
    failedTiles: failedResults.slice(0, 100).map((entry, index) => ({
      index,
      error: String(entry?.error?.message || entry?.error || 'unknown'),
    })),
  }
  zip.file(`${rootDir}/metadata.json`, JSON.stringify(metadata, null, 2))

  const blob = await zip.generateAsync({ type: 'blob' })
  const filename = buildFilename(zoomValue, bounds, okResults.length)

  return {
    blob,
    filename,
    summary: {
      attempted: tiles.length,
      downloaded: okResults.length,
      failed: failedResults.length,
      truncated,
      zoom: zoomValue,
      bounds,
    },
  }
}

export const exportUomTilesRangeZip = async ({
  polygon,
  startZoom = 6,
  endZoom = 18,
  maxTiles = DEFAULT_MAX_TILES,
  concurrency = DEFAULT_CONCURRENCY,
  beforeZoom,
  onProgress,
} = {}) => {
  const normalizedPolygon = Array.isArray(polygon) ? polygon.map(normalizeGcjPoint).filter(Boolean) : []
  if (normalizedPolygon.length < 3) {
    const error = new Error('anchor polygon is empty')
    error.code = 'ANCHOR_POLYGON_EMPTY'
    throw error
  }

  let start = Math.round(toNumber(startZoom, NaN))
  let end = Math.round(toNumber(endZoom, NaN))
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    const error = new Error('zoom out of range')
    error.code = 'ZOOM_OUT_OF_RANGE'
    throw error
  }
  if (start > end) [start, end] = [end, start]
  if (start < WMS_MIN_ZOOM || end > WMS_MAX_ZOOM) {
    const error = new Error('zoom out of range')
    error.code = 'ZOOM_OUT_OF_RANGE'
    throw error
  }

  const bounds = polygonBounds(normalizedPolygon)
  const totalLevels = end - start + 1
  const rootDir = sanitizeToken(
    `ll-planet_z${start}-${end}_lng${formatCoord(bounds.minLng)}_${formatCoord(bounds.maxLng)}_lat${formatCoord(bounds.minLat)}_${formatCoord(bounds.maxLat)}`,
  )
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()

  let totalAttempted = 0
  let totalDownloaded = 0
  let totalFailed = 0
  let anyTruncated = false
  const levels = []
  const failedTiles = []

  if (typeof onProgress === 'function') {
    onProgress({
      status: 'start',
      startZoom: start,
      endZoom: end,
      currentZoom: start,
      completedLevels: 0,
      totalLevels,
      percent: 0,
    })
  }

  for (let zoom = start; zoom <= end; zoom += 1) {
    if (typeof beforeZoom === 'function') {
      await beforeZoom(zoom)
    }

    if (typeof onProgress === 'function') {
      const completedLevels = zoom - start
      onProgress({
        status: 'running',
        startZoom: start,
        endZoom: end,
        currentZoom: zoom,
        completedLevels,
        totalLevels,
        percent: toProgressPercent(completedLevels, totalLevels),
      })
    }

    const { tiles, truncated } = buildWmsTilesForGcjPolygon(normalizedPolygon, zoom, { maxTiles })
    anyTruncated = anyTruncated || Boolean(truncated)

    totalAttempted += tiles.length
    if (!tiles.length) {
      levels.push({
        zoom,
        attempted: 0,
        downloaded: 0,
        failed: 0,
        truncated: Boolean(truncated),
      })
      continue
    }

    const results = await mapConcurrent(tiles, concurrency, async (tile) => {
      const response = await fetch(tile.src, { mode: 'cors' })
      if (!response.ok) {
        throw new Error(`tile fetch failed: ${tile.id} ${response.status}`)
      }
      const blob = await response.blob()
      const relativePath = `z${zoom}/x${tile.x}/y${tile.y}.png`
      zip.file(`${rootDir}/${relativePath}`, blob)
      return { ok: true, tile, relativePath, bytes: blob.size || 0 }
    })

    const okResults = results.filter((entry) => entry?.ok)
    const failedResults = results.filter((entry) => !entry?.ok)
    totalDownloaded += okResults.length
    totalFailed += failedResults.length

    levels.push({
      zoom,
      attempted: tiles.length,
      downloaded: okResults.length,
      failed: failedResults.length,
      truncated: Boolean(truncated),
    })

    failedResults.forEach((entry, index) => {
      if (failedTiles.length >= 300) return
      failedTiles.push({
        zoom,
        index,
        error: String(entry?.error?.message || entry?.error || 'unknown'),
      })
    })

    if (typeof onProgress === 'function') {
      const completedLevels = zoom - start + 1
      onProgress({
        status: 'running',
        startZoom: start,
        endZoom: end,
        currentZoom: zoom,
        completedLevels,
        totalLevels,
        percent: toProgressPercent(completedLevels, totalLevels),
      })
    }
  }

  if (!totalDownloaded) {
    const error = new Error('tile download failed')
    error.code = 'ALL_TILE_DOWNLOAD_FAILED'
    throw error
  }

  const metadata = {
    type: 'll-planet-offline-tiles',
    generatedAt: new Date().toISOString(),
    zoomRange: { start, end },
    rootDir,
    filePattern: `${rootDir}/z{z}/x{x}/y{y}.png`,
    polygon: normalizedPolygon,
    bounds,
    tileSummary: {
      attempted: totalAttempted,
      downloaded: totalDownloaded,
      failed: totalFailed,
      truncated: anyTruncated,
      levels,
    },
    failedTiles,
  }
  zip.file(`${rootDir}/metadata.json`, JSON.stringify(metadata, null, 2))

  const blob = await zip.generateAsync({ type: 'blob' })
  const filename = buildRangeFilename(start, end, bounds, totalDownloaded)

  if (typeof onProgress === 'function') {
    onProgress({
      status: 'done',
      startZoom: start,
      endZoom: end,
      currentZoom: end,
      completedLevels: totalLevels,
      totalLevels,
      percent: 100,
    })
  }

  return {
    blob,
    filename,
    summary: {
      attempted: totalAttempted,
      downloaded: totalDownloaded,
      failed: totalFailed,
      truncated: anyTruncated,
      startZoom: start,
      endZoom: end,
      levels,
      bounds,
    },
  }
}

export const downloadUomTilesZip = async (options = {}) => {
  const result = await exportUomTilesZip(options)
  triggerBrowserDownload(result.blob, result.filename)
  return result
}

export const downloadUomTilesRangeZip = async (options = {}) => {
  const result = await exportUomTilesRangeZip(options)
  triggerBrowserDownload(result.blob, result.filename)
  return result
}

export default {
  exportUomTilesZip,
  exportUomTilesRangeZip,
  downloadUomTilesZip,
  downloadUomTilesRangeZip,
}
