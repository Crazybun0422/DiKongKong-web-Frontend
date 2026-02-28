(function (global) {
  'use strict'

  var TENCENT_MAP_KEY = 'YJTBZ-5EBCT-SBAXN-VRUYM-SUXR7-O6FX4'
  var PI = Math.PI
  var A = 6378245.0
  var EE = 0.00669342162296594323
  var DEFAULT_ALPHA_THRESHOLD = 16

  function outOfChina(lat, lng) {
    return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271
  }

  function transformLat(x, y) {
    var ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
    ret += ((20.0 * Math.sin(6.0 * x * PI)) + (20.0 * Math.sin(2.0 * x * PI))) * 2.0 / 3.0
    ret += ((20.0 * Math.sin(y * PI)) + (40.0 * Math.sin(y / 3.0 * PI))) * 2.0 / 3.0
    ret += ((160.0 * Math.sin(y / 12.0 * PI)) + (320 * Math.sin(y * PI / 30.0))) * 2.0 / 3.0
    return ret
  }

  function transformLng(x, y) {
    var ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
    ret += ((20.0 * Math.sin(6.0 * x * PI)) + (20.0 * Math.sin(2.0 * x * PI))) * 2.0 / 3.0
    ret += ((20.0 * Math.sin(x * PI)) + (40.0 * Math.sin(x / 3.0 * PI))) * 2.0 / 3.0
    ret += ((150.0 * Math.sin(x / 12.0 * PI)) + (300.0 * Math.sin(x / 30.0 * PI))) * 2.0 / 3.0
    return ret
  }

  function wgs84ToGcj02(lng, lat) {
    var longitude = Number(lng)
    var latitude = Number(lat)
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
      throw new Error('Invalid coordinates')
    }
    if (outOfChina(latitude, longitude)) {
      return { lng: longitude, lat: latitude }
    }

    var dLat = transformLat(longitude - 105.0, latitude - 35.0)
    var dLng = transformLng(longitude - 105.0, latitude - 35.0)
    var radLat = latitude / 180.0 * PI
    var magic = Math.sin(radLat)
    magic = 1 - EE * magic * magic
    var sqrtMagic = Math.sqrt(magic)
    dLat = (dLat * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * PI)
    dLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * PI)
    return { lng: longitude + dLng, lat: latitude + dLat }
  }

  function normalizeCoordToGcj02(input) {
    var useType = String((input && input.coordType) || '').toUpperCase()
    var lng = Number(input && input.lng)
    var lat = Number(input && input.lat)
    if (useType === 'GCJ02') {
      return { lng: lng, lat: lat }
    }
    if (useType === 'WGS84') {
      return wgs84ToGcj02(lng, lat)
    }
    throw new Error('Unsupported coordType: ' + (input && input.coordType))
  }

  function lonLatToTileXY(lng, lat, zoom) {
    var scale = Math.pow(2, zoom)
    var x = Math.floor(((lng + 180) / 360) * scale)
    var sinLat = Math.sin((lat * Math.PI) / 180)
    var y = Math.floor((0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale)
    return { x: x, y: y }
  }

  function tileXYToLonLatBounds(x, y, z) {
    var n = Math.pow(2, z)
    var lngLeft = (x / n) * 360 - 180
    var lngRight = ((x + 1) / n) * 360 - 180
    var latTopRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)))
    var latBottomRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n)))
    return {
      latTop: (latTopRad * 180) / Math.PI,
      latBottom: (latBottomRad * 180) / Math.PI,
      lngLeft: lngLeft,
      lngRight: lngRight,
    }
  }

  function lonLatToPixelInTile(lng, lat, bounds, size) {
    var tileSize = Number(size) || 256
    var u = (lng - bounds.lngLeft) / (bounds.lngRight - bounds.lngLeft)
    var v = (bounds.latTop - lat) / (bounds.latTop - bounds.latBottom)
    var px = Math.min(tileSize - 1, Math.max(0, Math.round(u * (tileSize - 1))))
    var py = Math.min(tileSize - 1, Math.max(0, Math.round(v * (tileSize - 1))))
    return { px: px, py: py }
  }

  function getPixel(imageData, x, y) {
    var idx = (y * imageData.width + x) * 4
    var data = imageData.data
    return { r: data[idx], g: data[idx + 1], b: data[idx + 2], a: data[idx + 3] }
  }

  async function decodeBlobToImageData(blob) {
    var bitmap = await createImageBitmap(blob)
    var canvas = document.createElement('canvas')
    canvas.width = bitmap.width || 256
    canvas.height = bitmap.height || 256
    var ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return ctx.getImageData(0, 0, canvas.width, canvas.height)
  }

  function parseTilePath(path) {
    if (typeof path !== 'string') return null
    var match = path.match(/\/z(\d+)\/x(\d+)\/y(\d+)\.(png|webp)$/i)
    if (!match) return null
    return {
      z: Number(match[1]),
      x: Number(match[2]),
      y: Number(match[3]),
      key: match[2] + '/' + match[3],
      ext: String(match[4] || 'png').toLowerCase(),
    }
  }

  function ensureZoomMap(container, zoom) {
    if (!container.has(zoom)) {
      container.set(zoom, new Map())
    }
    return container.get(zoom)
  }

  function eachMapEntry(map, visitor) {
    map.forEach(function (value, key) {
      visitor(value, key)
    })
  }

  function makeGridKey(x, y) {
    return String(x) + ',' + String(y)
  }

  function parseGridKey(key) {
    var text = String(key)
    var idx = text.indexOf(',')
    if (idx < 0) {
      return { x: 0, y: 0 }
    }
    return {
      x: Number(text.slice(0, idx)),
      y: Number(text.slice(idx + 1)),
    }
  }

  function isSelectedByAlpha(alpha, threshold, mode) {
    if (mode === 'transparent') {
      return alpha <= threshold
    }
    return alpha > threshold
  }

  function createSparseOccupancy() {
    var rows = new Map()
    var cellCount = 0

    return {
      add: function (x, y) {
        var px = Number(x)
        var py = Number(y)
        if (!Number.isFinite(px) || !Number.isFinite(py)) {
          return
        }
        var row = rows.get(py)
        if (!row) {
          row = new Set()
          rows.set(py, row)
        }
        if (!row.has(px)) {
          row.add(px)
          cellCount += 1
        }
      },
      has: function (x, y) {
        var px = Number(x)
        var py = Number(y)
        if (!Number.isFinite(px) || !Number.isFinite(py)) {
          return false
        }
        var row = rows.get(py)
        return Boolean(row && row.has(px))
      },
      forEachCell: function (visitor) {
        rows.forEach(function (row, y) {
          row.forEach(function (x) {
            visitor(x, y)
          })
        })
      },
      getCount: function () {
        return cellCount
      },
    }
  }

  function buildBoundaryLoopsFromOccupiedCells(occupiedGrid) {
    var outgoing = new Map()
    var segmentCount = 0

    function addSegment(x1, y1, x2, y2) {
      var startKey = makeGridKey(x1, y1)
      var endKey = makeGridKey(x2, y2)
      if (!outgoing.has(startKey)) {
        outgoing.set(startKey, [])
      }
      outgoing.get(startKey).push(endKey)
      segmentCount += 1
    }

    occupiedGrid.forEachCell(function (x, y) {
      if (!occupiedGrid.has(x, y - 1)) addSegment(x, y, x + 1, y)
      if (!occupiedGrid.has(x + 1, y)) addSegment(x + 1, y, x + 1, y + 1)
      if (!occupiedGrid.has(x, y + 1)) addSegment(x + 1, y + 1, x, y + 1)
      if (!occupiedGrid.has(x - 1, y)) addSegment(x, y + 1, x, y)
    })

    function popOutgoing(startKey) {
      var list = outgoing.get(startKey)
      if (!list || !list.length) {
        return null
      }
      var nextKey = list.pop()
      if (!list.length) {
        outgoing.delete(startKey)
      }
      segmentCount -= 1
      return nextKey
    }

    var loops = []
    var guard = 0
    var guardMax = Math.max(100000, occupiedGrid.getCount() * 10)

    while (segmentCount > 0 && guard < guardMax) {
      var firstStart = outgoing.keys().next().value
      if (!firstStart) {
        break
      }

      var ring = [parseGridKey(firstStart)]
      var currentKey = firstStart
      var closed = false

      while (guard < guardMax) {
        guard += 1
        var nextKey = popOutgoing(currentKey)
        if (!nextKey) {
          break
        }
        ring.push(parseGridKey(nextKey))
        currentKey = nextKey
        if (nextKey === firstStart) {
          closed = true
          break
        }
      }

      if (ring.length > 3) {
        if (!closed) {
          var first = ring[0]
          var last = ring[ring.length - 1]
          if (first.x !== last.x || first.y !== last.y) {
            ring.push({ x: first.x, y: first.y })
          }
        }
        loops.push(ring)
      }
    }

    return loops
  }

  function worldPixelToLonLat(worldX, worldY, zoom, tileSize) {
    var worldScale = Math.pow(2, zoom) * tileSize
    var lng = (worldX / worldScale) * 360 - 180
    var latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * worldY) / worldScale)))
    return {
      lng: lng,
      lat: (latRad * 180) / Math.PI,
    }
  }

  function haversineDistanceMeters(a, b) {
    var rad = Math.PI / 180
    var dLat = (b.lat - a.lat) * rad
    var dLng = (b.lng - a.lng) * rad
    var lat1 = a.lat * rad
    var lat2 = b.lat * rad
    var sinDLat = Math.sin(dLat / 2)
    var sinDLng = Math.sin(dLng / 2)
    var h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng
    var c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
    return 6378137 * c
  }

  function roundBy(value, decimals) {
    var d = Number(decimals)
    if (!Number.isFinite(d) || d < 0) {
      return value
    }
    var factor = Math.pow(10, d)
    return Math.round(value * factor) / factor
  }

  function ensureRingClosed(ring) {
    if (!ring || ring.length < 2) {
      return ring
    }
    var first = ring[0]
    var last = ring[ring.length - 1]
    if (first[0] !== last[0] || first[1] !== last[1]) {
      ring.push([first[0], first[1]])
    }
    return ring
  }

  function OfflineTilePackage(config) {
    this.zip = config.zip
    this.metadata = config.metadata
    this.imageDataCache = new Map()
    this.rootDir = (config.metadata && config.metadata.rootDir) || ''
    this.tileNameIndex = new Map()
    this.tileObjectUrlIndex = new Map()
    this.zoomPrepared = new Set()
    this._buildTileNameIndex()
  }

  OfflineTilePackage.fromFile = async function (file) {
    if (!global.JSZip) {
      throw new Error('JSZip not loaded')
    }
    var zip = await global.JSZip.loadAsync(file)
    var files = Object.values(zip.files)
    var metadataEntry = files.find(function (entry) {
      return /metadata\.json$/i.test(entry.name)
    })

    if (!metadataEntry) {
      throw new Error('metadata.json not found in zip')
    }

    var metadata = JSON.parse(await metadataEntry.async('string'))
    return new OfflineTilePackage({ zip: zip, metadata: metadata })
  }

  OfflineTilePackage.prototype._buildTileNameIndex = function () {
    var _this = this
    var paths = []

    if (Array.isArray(_this.metadata && _this.metadata.tiles) && (_this.metadata && _this.metadata.tiles).length) {
      ;(_this.metadata.tiles).forEach(function (tile) {
        if (tile && typeof tile.path === 'string') {
          paths.push(tile.path)
        }
      })
    } else {
      Object.values(_this.zip.files).forEach(function (entry) {
        if (!entry || entry.dir) return
        if (/\/z\d+\/x\d+\/y\d+\.(png|webp)$/i.test(entry.name)) {
          paths.push(entry.name)
        }
      })
    }

    paths.forEach(function (path) {
      var parsed = parseTilePath(path)
      if (!parsed) return
      var zoomMap = ensureZoomMap(_this.tileNameIndex, parsed.z)
      zoomMap.set(parsed.key, path)
    })
  }

  OfflineTilePackage.prototype.getAvailableZooms = function () {
    return Array.from(this.tileNameIndex.keys()).sort(function (a, b) { return a - b })
  }

  OfflineTilePackage.prototype.hasZoom = function (zoom) {
    return this.tileNameIndex.has(Number(zoom))
  }

  OfflineTilePackage.prototype.getZoomTileCount = function (zoom) {
    var z = Number(zoom)
    if (!this.tileNameIndex.has(z)) return 0
    return this.tileNameIndex.get(z).size
  }

  OfflineTilePackage.prototype.isZoomPrepared = function (zoom) {
    return this.zoomPrepared.has(Number(zoom))
  }

  OfflineTilePackage.prototype.prepareZoomTileUrls = async function (zoom, options) {
    var z = Number(zoom)
    var opts = options || {}
    var onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null
    var force = Boolean(opts.force)

    if (!this.tileNameIndex.has(z)) {
      return { zoom: z, total: 0, prepared: 0, loadedNow: 0 }
    }

    if (this.zoomPrepared.has(z) && !force) {
      return {
        zoom: z,
        total: this.getZoomTileCount(z),
        prepared: this.getZoomTileCount(z),
        loadedNow: 0,
      }
    }

    if (force) {
      this.releaseZoomTileUrls(z)
    }

    var nameMap = this.tileNameIndex.get(z)
    var urlMap = ensureZoomMap(this.tileObjectUrlIndex, z)
    var entries = Array.from(nameMap.entries())
    var total = entries.length
    var done = 0
    var loadedNow = 0

    for (var i = 0; i < entries.length; i += 1) {
      var key = entries[i][0]
      var path = entries[i][1]

      if (urlMap.has(key)) {
        done += 1
        if (onProgress) onProgress({ zoom: z, done: done, total: total })
        continue
      }

      var zipEntry = this.zip.file(path)
      if (!zipEntry) {
        done += 1
        if (onProgress) onProgress({ zoom: z, done: done, total: total })
        continue
      }

      var blob = await zipEntry.async('blob')
      var objectUrl = URL.createObjectURL(blob)
      urlMap.set(key, objectUrl)
      loadedNow += 1
      done += 1

      if (onProgress) {
        onProgress({ zoom: z, done: done, total: total })
      }
    }

    this.zoomPrepared.add(z)
    return { zoom: z, total: total, prepared: urlMap.size, loadedNow: loadedNow }
  }

  OfflineTilePackage.prototype.getTileObjectUrlSync = function (z, x, y) {
    var zoom = Number(z)
    var key = String(Number(x)) + '/' + String(Number(y))
    if (!this.tileObjectUrlIndex.has(zoom)) return null
    return this.tileObjectUrlIndex.get(zoom).get(key) || null
  }

  OfflineTilePackage.prototype.releaseZoomTileUrls = function (zoom) {
    var z = Number(zoom)
    if (!this.tileObjectUrlIndex.has(z)) {
      this.zoomPrepared.delete(z)
      return
    }

    var urlMap = this.tileObjectUrlIndex.get(z)
    eachMapEntry(urlMap, function (url) {
      try {
        URL.revokeObjectURL(url)
      } catch (error) {
        // ignore
      }
    })
    this.tileObjectUrlIndex.delete(z)
    this.zoomPrepared.delete(z)
  }

  OfflineTilePackage.prototype.dispose = function () {
    var _this = this
    Array.from(_this.tileObjectUrlIndex.keys()).forEach(function (z) {
      _this.releaseZoomTileUrls(z)
    })
    _this.tileObjectUrlIndex.clear()
    _this.zoomPrepared.clear()
    _this.imageDataCache.clear()
  }

  OfflineTilePackage.prototype.getLoadedSummary = function () {
    var m = this.metadata || {}
    var summary = m.tileSummary || {}
    var zoomText = Number.isFinite(m.zoom)
      ? 'Z' + m.zoom
      : 'Z' + ((m.zoomRange && m.zoomRange.start) || '?') + '-' + ((m.zoomRange && m.zoomRange.end) || '?')

    return {
      rootDir: m.rootDir || '',
      zoomText: zoomText,
      attempted: summary.attempted || 0,
      downloaded: summary.downloaded || 0,
      failed: summary.failed || 0,
      truncated: Boolean(summary.truncated),
      availableZooms: this.getAvailableZooms(),
    }
  }

  OfflineTilePackage.prototype.buildTilePath = function (z, x, y) {
    var pattern = this.metadata && this.metadata.filePattern
    if (typeof pattern === 'string' && pattern.indexOf('{z}') > -1 && pattern.indexOf('{x}') > -1 && pattern.indexOf('{y}') > -1) {
      return pattern
        .replace('{z}', String(z))
        .replace('{x}', String(x))
        .replace('{y}', String(y))
    }
    if (!this.rootDir) {
      return null
    }
    return this.rootDir + '/z' + z + '/x' + x + '/y' + y + '.png'
  }

  OfflineTilePackage.prototype.resolveTilePath = function (z, x, y) {
    var zoom = Number(z)
    var key = String(Number(x)) + '/' + String(Number(y))
    if (this.tileNameIndex.has(zoom)) {
      var path = this.tileNameIndex.get(zoom).get(key)
      if (path) return path
    }
    return this.buildTilePath(z, x, y)
  }

  OfflineTilePackage.prototype.getTileImageData = async function (z, x, y) {
    var key = z + '/' + x + '/' + y
    if (this.imageDataCache.has(key)) {
      return this.imageDataCache.get(key)
    }

    var path = this.resolveTilePath(z, x, y)
    if (!path) {
      return null
    }

    var entry = this.zip.file(path)
    if (!entry) {
      return null
    }

    var blob = await entry.async('blob')
    var imageData = await decodeBlobToImageData(blob)
    this.imageDataCache.set(key, imageData)
    return imageData
  }

  OfflineTilePackage.prototype.getTileEntriesForZoom = function (zoom) {
    var z = Number(zoom)
    if (!this.tileNameIndex.has(z)) {
      return []
    }

    var entries = []
    eachMapEntry(this.tileNameIndex.get(z), function (path, key) {
      var text = String(key)
      var split = text.split('/')
      if (split.length !== 2) {
        return
      }
      var x = Number(split[0])
      var y = Number(split[1])
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return
      }
      entries.push({
        z: z,
        x: x,
        y: y,
        key: text,
        path: path,
      })
    })

    entries.sort(function (a, b) {
      if (a.y === b.y) return a.x - b.x
      return a.y - b.y
    })
    return entries
  }

  OfflineTilePackage.prototype.exportZoomRegionLatLng = async function (input) {
    var opts = input || {}
    var z = Math.round(Number(opts.zoom))
    if (!Number.isFinite(z)) {
      throw new Error('Invalid zoom')
    }

    var alphaThreshold = Number.isFinite(Number(opts.alphaThreshold))
      ? Number(opts.alphaThreshold)
      : DEFAULT_ALPHA_THRESHOLD
    var selectMode = String(opts.selectMode || 'colored').toLowerCase()
    var maxSegmentMeters = Number.isFinite(Number(opts.maxSegmentMeters))
      ? Math.max(0, Number(opts.maxSegmentMeters))
      : 0.5
    var decimalPlaces = Number.isFinite(Number(opts.decimalPlaces))
      ? Math.max(0, Math.floor(Number(opts.decimalPlaces)))
      : 7
    var onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null

    var entries = this.getTileEntriesForZoom(z)
    var totalTiles = entries.length
    if (!totalTiles) {
      return {
        type: 'UomLatLngExport',
        version: 1,
        coordType: 'GCJ02',
        zoom: z,
        generatedAt: new Date().toISOString(),
        precision: { maxSegmentMeters: maxSegmentMeters, decimalPlaces: decimalPlaces },
        selectRule: { mode: selectMode, alphaThreshold: alphaThreshold },
        bounds: null,
        rings: [],
        stats: {
          tiles: 0,
          selectedPixels: 0,
          rings: 0,
          points: 0,
        },
      }
    }

    var occupiedCells = createSparseOccupancy()
    var selectedPixelCount = 0
    var tileSize = 256
    var tileDone = 0

    for (var i = 0; i < entries.length; i += 1) {
      var entry = entries[i]
      var imageData = await this.getTileImageData(z, entry.x, entry.y)
      if (imageData && imageData.data) {
        var width = Number(imageData.width) || 256
        var height = Number(imageData.height) || 256
        tileSize = width
        var data = imageData.data
        for (var py = 0; py < height; py += 1) {
          var rowOffset = py * width * 4
          for (var px = 0; px < width; px += 1) {
            var alpha = data[rowOffset + px * 4 + 3]
            if (!isSelectedByAlpha(alpha, alphaThreshold, selectMode)) {
              continue
            }
            selectedPixelCount += 1
            var worldX = entry.x * width + px
            var worldY = entry.y * height + py
            occupiedCells.add(worldX, worldY)
          }
        }
      }

      tileDone += 1
      if (onProgress) {
        onProgress({
          tileDone: tileDone,
          tileTotal: totalTiles,
          selectedPixels: selectedPixelCount,
        })
      }
    }

    if (!occupiedCells.getCount()) {
      return {
        type: 'UomLatLngExport',
        version: 1,
        coordType: 'GCJ02',
        zoom: z,
        generatedAt: new Date().toISOString(),
        precision: { maxSegmentMeters: maxSegmentMeters, decimalPlaces: decimalPlaces },
        selectRule: { mode: selectMode, alphaThreshold: alphaThreshold },
        bounds: null,
        rings: [],
        stats: {
          tiles: totalTiles,
          selectedPixels: selectedPixelCount,
          rings: 0,
          points: 0,
        },
      }
    }

    var loops = buildBoundaryLoopsFromOccupiedCells(occupiedCells)
    var rings = []
    var pointCount = 0
    var minLng = Infinity
    var minLat = Infinity
    var maxLng = -Infinity
    var maxLat = -Infinity

    function pushPoint(target, lng, lat) {
      var p = [roundBy(lng, decimalPlaces), roundBy(lat, decimalPlaces)]
      var last = target.length ? target[target.length - 1] : null
      if (last && last[0] === p[0] && last[1] === p[1]) {
        return
      }
      target.push(p)
      pointCount += 1
      if (p[0] < minLng) minLng = p[0]
      if (p[0] > maxLng) maxLng = p[0]
      if (p[1] < minLat) minLat = p[1]
      if (p[1] > maxLat) maxLat = p[1]
    }

    for (var ringIndex = 0; ringIndex < loops.length; ringIndex += 1) {
      var loop = loops[ringIndex]
      if (!loop || loop.length < 4) {
        continue
      }

      var ring = []
      for (var j = 0; j < loop.length - 1; j += 1) {
        var start = loop[j]
        var end = loop[j + 1]
        var startLonLat = worldPixelToLonLat(start.x, start.y, z, tileSize)
        var endLonLat = worldPixelToLonLat(end.x, end.y, z, tileSize)

        if (!ring.length) {
          pushPoint(ring, startLonLat.lng, startLonLat.lat)
        }

        var segmentDistance = haversineDistanceMeters(startLonLat, endLonLat)
        var splitCount = 1
        if (maxSegmentMeters > 0 && Number.isFinite(segmentDistance) && segmentDistance > maxSegmentMeters) {
          splitCount = Math.ceil(segmentDistance / maxSegmentMeters)
        }

        for (var s = 1; s <= splitCount; s += 1) {
          var t = s / splitCount
          var worldXInterp = start.x + (end.x - start.x) * t
          var worldYInterp = start.y + (end.y - start.y) * t
          var pLonLat = worldPixelToLonLat(worldXInterp, worldYInterp, z, tileSize)
          pushPoint(ring, pLonLat.lng, pLonLat.lat)
        }
      }

      var beforeCloseLength = ring.length
      ensureRingClosed(ring)
      if (ring.length > beforeCloseLength) {
        pointCount += 1
      }
      if (ring.length > 3) {
        rings.push(ring)
      }
    }

    return {
      type: 'UomLatLngExport',
      version: 1,
      coordType: 'GCJ02',
      zoom: z,
      generatedAt: new Date().toISOString(),
      precision: {
        maxSegmentMeters: maxSegmentMeters,
        decimalPlaces: decimalPlaces,
      },
      selectRule: {
        mode: selectMode,
        alphaThreshold: alphaThreshold,
      },
      bounds: Number.isFinite(minLng) && Number.isFinite(minLat) && Number.isFinite(maxLng) && Number.isFinite(maxLat)
        ? {
          minLng: minLng,
          minLat: minLat,
          maxLng: maxLng,
          maxLat: maxLat,
        }
        : null,
      rings: rings,
      stats: {
        tiles: totalTiles,
        selectedPixels: selectedPixelCount,
        rings: rings.length,
        points: pointCount,
      },
      note: '坐标来自瓦片像素边界，细分间距可到 0.5m，但实际精度受原始瓦片分辨率限制',
    }
  }

  OfflineTilePackage.prototype.classifyPoint = async function (input) {
    var zoomInt = Math.round(Number(input.zoom))
    if (!Number.isFinite(zoomInt)) {
      throw new Error('Invalid zoom')
    }

    var normalized = normalizeCoordToGcj02({
      lng: input.lng,
      lat: input.lat,
      coordType: input.coordType || 'GCJ02',
    })

    var tile = lonLatToTileXY(normalized.lng, normalized.lat, zoomInt)
    var imageData = await this.getTileImageData(zoomInt, tile.x, tile.y)
    if (!imageData) {
      return {
        loaded: false,
        zone: '未加载',
        reason: '瓦片不存在或尚未加载',
        z: zoomInt,
        x: tile.x,
        y: tile.y,
      }
    }

    var bounds = tileXYToLonLatBounds(tile.x, tile.y, zoomInt)
    var pixel = lonLatToPixelInTile(normalized.lng, normalized.lat, bounds, imageData.width || 256)
    var rgba = getPixel(imageData, pixel.px, pixel.py)
    var threshold = Number.isFinite(Number(input.alphaThreshold))
      ? Number(input.alphaThreshold)
      : DEFAULT_ALPHA_THRESHOLD
    var isTransparent = rgba.a <= threshold

    return {
      loaded: true,
      zone: isTransparent ? '管制区' : '适飞区（120M）',
      detail: isTransparent
        ? '无像素（透明），判定为管制区'
        : '有像素（非透明），判定为适飞区（120M）',
      z: zoomInt,
      x: tile.x,
      y: tile.y,
      px: pixel.px,
      py: pixel.py,
      rgba: rgba,
      alphaThreshold: threshold,
    }
  }

  global.OfflineTileApi = {
    TENCENT_MAP_KEY: TENCENT_MAP_KEY,
    wgs84ToGcj02: wgs84ToGcj02,
    normalizeCoordToGcj02: normalizeCoordToGcj02,
    lonLatToTileXY: lonLatToTileXY,
    tileXYToLonLatBounds: tileXYToLonLatBounds,
    lonLatToPixelInTile: lonLatToPixelInTile,
    OfflineTilePackage: OfflineTilePackage,
  }
})(window)
