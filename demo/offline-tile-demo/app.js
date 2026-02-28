(function () {
  'use strict'

  var DEFAULT_CENTER = { lat: 39.908823, lng: 116.39747 }
  var DEFAULT_ZOOM = 11
  var EMPTY_TILE_DATA_URL = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='

  if (!window.OfflineTileApi) {
    throw new Error('OfflineTileApi not loaded')
  }

  var OfflineTilePackage = window.OfflineTileApi.OfflineTilePackage

  var state = {
    map: null,
    pack: null,
    clickMarker: null,
    importedPolygons: [],
    offlineMapType: null,
    offlineMapTypeIndex: -1,
    zoomPrepareToken: 0,
  }

  var $ = {
    fileInput: document.getElementById('zipFile'),
    loadBtn: document.getElementById('loadBtn'),
    clearBtn: document.getElementById('clearBtn'),
    exportUomBtn: document.getElementById('exportUomBtn'),
    importUomBtn: document.getElementById('importUomBtn'),
    kmlFileInput: document.getElementById('kmlFile'),
    summary: document.getElementById('packSummary'),
    clickResult: document.getElementById('clickResult'),
    zoomInfo: document.getElementById('zoomInfo'),
    coordType: document.getElementById('coordType'),
    segmentMeters: document.getElementById('segmentMeters'),
    coordPayload: document.getElementById('coordPayload'),
  }

  function setSummary(text) {
    $.summary.textContent = text
  }

  function setClickResult(text) {
    $.clickResult.textContent = text
  }

  function getCurrentZoom() {
    if (!state.map || typeof state.map.getZoom !== 'function') {
      return DEFAULT_ZOOM
    }
    return Math.round(state.map.getZoom())
  }

  function setOfflineLayerVisible(visible) {
    if (!state.map || !window.qq || !window.qq.maps) {
      return
    }

    if (!visible || !state.offlineMapType) {
      if (state.offlineMapTypeIndex > -1) {
        state.map.overlayMapTypes.removeAt(state.offlineMapTypeIndex)
        state.offlineMapTypeIndex = -1
      }
      return
    }

    if (state.offlineMapTypeIndex === -1) {
      state.offlineMapTypeIndex = state.map.overlayMapTypes.push(state.offlineMapType) - 1
    }
  }

  function refreshOfflineLayer() {
    if (!state.map || !state.offlineMapType) {
      return
    }
    setOfflineLayerVisible(false)
    setOfflineLayerVisible(true)
  }

  function ensureOfflineMapType() {
    if (state.offlineMapType || !window.qq || !window.qq.maps || !window.qq.maps.ImageMapType || !window.qq.maps.Size) {
      return state.offlineMapType
    }

    state.offlineMapType = new window.qq.maps.ImageMapType({
      name: 'OfflineTiles',
      tileSize: new window.qq.maps.Size(256, 256),
      isPng: true,
      getTileUrl: function (tileCoord, zoom) {
        if (!state.pack) return EMPTY_TILE_DATA_URL
        var z = Number(zoom)
        var x = Number(tileCoord && tileCoord.x)
        var y = Number(tileCoord && tileCoord.y)
        var url = state.pack.getTileObjectUrlSync(z, x, y)
        return url || EMPTY_TILE_DATA_URL
      },
    })

    return state.offlineMapType
  }

  async function prepareZoomTiles(zoom, token, silent) {
    if (!state.pack) {
      return
    }

    var z = Number(zoom)
    if (!Number.isFinite(z)) {
      return
    }

    if (!state.pack.hasZoom(z)) {
      if (!silent) {
        setSummary('当前缩放 Z' + z + ' 无离线瓦片，图层为空白')
      }
      refreshOfflineLayer()
      return
    }

    var availableZooms = state.pack.getAvailableZooms()
    for (var i = 0; i < availableZooms.length; i += 1) {
      var otherZoom = Number(availableZooms[i])
      if (otherZoom !== z && state.pack.isZoomPrepared(otherZoom)) {
        state.pack.releaseZoomTileUrls(otherZoom)
      }
    }

    var stats = await state.pack.prepareZoomTileUrls(z)
    if (token !== state.zoomPrepareToken) {
      return
    }

    if (!silent) {
      setSummary('已加载瓦片包 | Z' + z + ' 已准备 ' + stats.prepared + '/' + stats.total + ' 张瓦片')
    }

    refreshOfflineLayer()
  }

  function initMap() {
    if (!window.qq || !window.qq.maps) {
      throw new Error('qq.maps not loaded')
    }

    state.map = new window.qq.maps.Map(document.getElementById('map'), {
      center: new window.qq.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng),
      zoom: DEFAULT_ZOOM,
      mapTypeControl: false,
    })

    ensureOfflineMapType()

    window.qq.maps.event.addListener(state.map, 'zoom_changed', function () {
      var z = getCurrentZoom()
      $.zoomInfo.textContent = '当前缩放：Z' + z

      if (!state.pack) return
      state.zoomPrepareToken += 1
      var token = state.zoomPrepareToken
      prepareZoomTiles(z, token, true).catch(function (error) {
        if (token !== state.zoomPrepareToken) return
        setSummary('缩放瓦片准备失败：' + ((error && error.message) || error))
      })
    })

    window.qq.maps.event.addListener(state.map, 'click', async function (event) {
      var lat = Number(event && event.latLng && event.latLng.getLat && event.latLng.getLat())
      var lng = Number(event && event.latLng && event.latLng.getLng && event.latLng.getLng())
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return
      }

      renderClickMarker(lat, lng)
      var zoom = getCurrentZoom()

      if (!state.pack) {
        setClickResult('未加载（点击坐标：' + lat.toFixed(6) + ', ' + lng.toFixed(6) + '）')
        return
      }

      try {
        var result = await state.pack.classifyPoint({
          lng: lng,
          lat: lat,
          zoom: zoom,
          coordType: ($.coordType && $.coordType.value) || 'GCJ02',
        })

        if (!result.loaded) {
          setClickResult('未加载：' + result.reason + ' | Z' + result.z + '/' + result.x + '/' + result.y)
          return
        }

        setClickResult(
          result.zone + ' | ' + result.detail + ' | Z' + result.z + '/' + result.x + '/' + result.y +
          ' | RGBA(' + result.rgba.r + ',' + result.rgba.g + ',' + result.rgba.b + ',' + result.rgba.a + ')'
        )
      } catch (error) {
        setClickResult('识别失败：' + ((error && error.message) || error))
      }
    })

    $.zoomInfo.textContent = '当前缩放：Z' + DEFAULT_ZOOM
  }

  function renderClickMarker(lat, lng) {
    if (!state.map || !window.qq || !window.qq.maps) {
      return
    }

    if (state.clickMarker) {
      try {
        state.clickMarker.setMap(null)
      } catch (e) {
        // ignore
      }
      state.clickMarker = null
    }

    state.clickMarker = new window.qq.maps.Marker({
      map: state.map,
      position: new window.qq.maps.LatLng(lat, lng),
    })
  }

  function fitToBounds(bounds) {
    if (!state.map || !window.qq || !window.qq.maps || !bounds) {
      return
    }

    var sw = bounds.southwest || bounds
    var ne = bounds.northeast || bounds
    var swLat = Number((sw && sw.latitude) || bounds.minLat)
    var swLng = Number((sw && sw.longitude) || bounds.minLng)
    var neLat = Number((ne && ne.latitude) || bounds.maxLat)
    var neLng = Number((ne && ne.longitude) || bounds.maxLng)

    if (![swLat, swLng, neLat, neLng].every(Number.isFinite)) {
      return
    }

    try {
      var qqBounds = new window.qq.maps.LatLngBounds(
        new window.qq.maps.LatLng(swLat, swLng),
        new window.qq.maps.LatLng(neLat, neLng)
      )
      state.map.fitBounds(qqBounds)
    } catch (e) {
      // ignore
    }
  }

  function clearImportedPolygons() {
    if (!state.importedPolygons || !state.importedPolygons.length) {
      return
    }
    for (var i = 0; i < state.importedPolygons.length; i += 1) {
      try {
        state.importedPolygons[i].setMap(null)
      } catch (e) {
        // ignore
      }
    }
    state.importedPolygons = []
  }

  function buildExportFileName(zoom) {
    var now = new Date()
    function p2(v) { return String(v).padStart(2, '0') }
    var ts = now.getFullYear() + p2(now.getMonth() + 1) + p2(now.getDate()) + '-' + p2(now.getHours()) + p2(now.getMinutes()) + p2(now.getSeconds())
    return 'uom-z' + zoom + '-' + ts + '.kml'
  }

  function downloadTextFile(filename, content, mimeType) {
    var blob = new Blob([content], { type: mimeType || 'application/vnd.google-earth.kml+xml;charset=utf-8' })
    var url = URL.createObjectURL(blob)
    var a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(function () {
      try {
        URL.revokeObjectURL(url)
      } catch (e) {
        // ignore
      }
    }, 0)
  }

  function xmlEscape(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }

  function normalizeCoordPoint(point) {
    if (!Array.isArray(point) || point.length < 2) {
      return null
    }
    var lng = Number(point[0])
    var lat = Number(point[1])
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return null
    }
    return [lng, lat]
  }

  function normalizeRing(rawRing) {
    if (!Array.isArray(rawRing) || rawRing.length < 3) {
      return null
    }

    var ring = []
    for (var i = 0; i < rawRing.length; i += 1) {
      var point = normalizeCoordPoint(rawRing[i])
      if (!point) {
        continue
      }
      var last = ring.length ? ring[ring.length - 1] : null
      if (!last || last[0] !== point[0] || last[1] !== point[1]) {
        ring.push(point)
      }
    }

    if (ring.length < 3) {
      return null
    }

    var first = ring[0]
    var lastPoint = ring[ring.length - 1]
    if (first[0] !== lastPoint[0] || first[1] !== lastPoint[1]) {
      ring.push([first[0], first[1]])
    }

    return ring.length >= 4 ? ring : null
  }

  function ringToKmlCoordinates(ring) {
    var lines = []
    for (var i = 0; i < ring.length; i += 1) {
      var point = ring[i]
      lines.push(point[0] + ',' + point[1] + ',0')
    }
    return lines.join(' ')
  }

  function buildKmlFromRings(rings, meta) {
    var title = 'UOM_Z' + meta.zoom
    var kml = []
    kml.push('<?xml version="1.0" encoding="UTF-8"?>')
    kml.push('<kml xmlns="http://www.opengis.net/kml/2.2">')
    kml.push('  <Document>')
    kml.push('    <name>' + xmlEscape(title) + '</name>')
    kml.push('    <description>' + xmlEscape('Generated at ' + (meta.generatedAt || '')) + '</description>')
    kml.push('    <Style id="uomStyle">')
    kml.push('      <LineStyle><color>ff2d8f24</color><width>2</width></LineStyle>')
    kml.push('      <PolyStyle><color>661fb64b</color></PolyStyle>')
    kml.push('    </Style>')

    for (var i = 0; i < rings.length; i += 1) {
      var ring = normalizeRing(rings[i])
      if (!ring) {
        continue
      }

      kml.push('    <Placemark>')
      kml.push('      <name>' + xmlEscape('uom_ring_' + (i + 1)) + '</name>')
      kml.push('      <styleUrl>#uomStyle</styleUrl>')
      kml.push('      <Polygon>')
      kml.push('        <outerBoundaryIs>')
      kml.push('          <LinearRing>')
      kml.push('            <coordinates>' + ringToKmlCoordinates(ring) + '</coordinates>')
      kml.push('          </LinearRing>')
      kml.push('        </outerBoundaryIs>')
      kml.push('      </Polygon>')
      kml.push('    </Placemark>')
    }

    kml.push('  </Document>')
    kml.push('</kml>')
    return kml.join('\n')
  }

  function parseCoordinatesText(text) {
    var value = String(text || '').trim()
    if (!value) {
      return []
    }

    var tuples = value.split(/\s+/)
    var ring = []
    for (var i = 0; i < tuples.length; i += 1) {
      var tuple = tuples[i].trim()
      if (!tuple) {
        continue
      }
      var parts = tuple.split(',')
      if (parts.length < 2) {
        continue
      }
      var lng = Number(parts[0])
      var lat = Number(parts[1])
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        continue
      }
      ring.push([lng, lat])
    }

    return normalizeRing(ring) || []
  }

  function findElementsByLocalName(root, name) {
    var target = String(name || '').toLowerCase()
    var found = []
    var all = root.getElementsByTagName('*')
    for (var i = 0; i < all.length; i += 1) {
      var node = all[i]
      if (String(node.localName || '').toLowerCase() === target) {
        found.push(node)
      }
    }
    return found
  }

  function parseRingsFromKml(text) {
    var parser = new DOMParser()
    var xml = parser.parseFromString(String(text || ''), 'application/xml')
    var parseError = xml.getElementsByTagName('parsererror')
    if (parseError && parseError.length) {
      throw new Error('KML 解析失败，请检查 XML 格式')
    }

    var coordinateNodes = findElementsByLocalName(xml, 'coordinates')
    var rings = []
    for (var i = 0; i < coordinateNodes.length; i += 1) {
      var ring = parseCoordinatesText(coordinateNodes[i].textContent)
      if (ring.length >= 4) {
        rings.push(ring)
      }
    }

    return rings
  }

  function renderImportedRings(rings) {
    if (!state.map || !window.qq || !window.qq.maps || !window.qq.maps.Polygon || !window.qq.maps.LatLng) {
      throw new Error('qq.maps polygon not available')
    }

    clearImportedPolygons()

    var minLng = Infinity
    var minLat = Infinity
    var maxLng = -Infinity
    var maxLat = -Infinity

    for (var i = 0; i < rings.length; i += 1) {
      var ring = normalizeRing(rings[i])
      if (!ring) {
        continue
      }

      var path = []
      for (var j = 0; j < ring.length; j += 1) {
        var point = ring[j]
        var lng = Number(point[0])
        var lat = Number(point[1])
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
          continue
        }

        if (lng < minLng) minLng = lng
        if (lng > maxLng) maxLng = lng
        if (lat < minLat) minLat = lat
        if (lat > maxLat) maxLat = lat
        path.push(new window.qq.maps.LatLng(lat, lng))
      }

      if (path.length < 4) {
        continue
      }

      var polygon = new window.qq.maps.Polygon({
        map: state.map,
        path: path,
        fillColor: '#22c55e',
        fillOpacity: 0.26,
        strokeColor: '#15803d',
        strokeWeight: 2,
        strokeOpacity: 0.95,
      })
      state.importedPolygons.push(polygon)
    }

    if (!state.importedPolygons.length) {
      throw new Error('没有可绘制的有效区域')
    }

    fitToBounds({
      minLng: minLng,
      minLat: minLat,
      maxLng: maxLng,
      maxLat: maxLat,
    })
  }

  function getExportSegmentMeters() {
    var value = Number($.segmentMeters && $.segmentMeters.value)
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error('导出精度参数无效，请输入大于 0 的米值')
    }
    return value
  }

  async function onExportCurrentZoom() {
    if (!state.pack) {
      setClickResult('未加载离线包，无法导出')
      return
    }
    if (typeof state.pack.exportZoomRegionLatLng !== 'function') {
      setClickResult('当前离线包 API 不支持导出')
      return
    }

    var z = getCurrentZoom()
    if (!state.pack.hasZoom(z)) {
      setClickResult('当前缩放 Z' + z + ' 无离线瓦片')
      return
    }

    var segmentMeters
    try {
      segmentMeters = getExportSegmentMeters()
    } catch (error) {
      setClickResult((error && error.message) || String(error))
      return
    }

    setSummary('正在导出 Z' + z + ' 的 UOM KML...（精度 ' + segmentMeters + 'm）')
    var lastProgressUpdate = -1

    try {
      var exported = await state.pack.exportZoomRegionLatLng({
        zoom: z,
        alphaThreshold: 16,
        selectMode: 'colored',
        maxSegmentMeters: segmentMeters,
        decimalPlaces: 7,
        onProgress: function (progress) {
          var done = Number(progress && progress.tileDone)
          var total = Number(progress && progress.tileTotal)
          if (!Number.isFinite(done) || !Number.isFinite(total) || !total) {
            return
          }
          if (done === total || done - lastProgressUpdate >= 20) {
            lastProgressUpdate = done
            setSummary('正在导出 Z' + z + ' 的 UOM KML...（精度 ' + segmentMeters + 'm）' + done + '/' + total + ' 张瓦片')
          }
        },
      })

      var kmlText = buildKmlFromRings(exported.rings || [], {
        zoom: z,
        generatedAt: exported.generatedAt,
      })

      if ($.coordPayload) {
        $.coordPayload.value = kmlText
      }
      downloadTextFile(buildExportFileName(z), kmlText, 'application/vnd.google-earth.kml+xml;charset=utf-8')
      setSummary(
        '导出完成 | Z' + z +
        ' | rings=' + exported.stats.rings +
        ' | points=' + exported.stats.points +
        ' | selectedPixels=' + exported.stats.selectedPixels
      )
      setClickResult('导出完成，KML 已填充并下载')
    } catch (error) {
      setSummary('导出失败：' + ((error && error.message) || error))
      setClickResult('导出失败')
    }
  }

  async function readTextFromFile(file) {
    if (!file) {
      return ''
    }
    if (typeof file.text === 'function') {
      return await file.text()
    }

    return new Promise(function (resolve, reject) {
      var reader = new FileReader()
      reader.onerror = function () {
        reject(new Error('读取文件失败'))
      }
      reader.onload = function () {
        resolve(String(reader.result || ''))
      }
      reader.readAsText(file)
    })
  }

  async function onImportUomPayload() {
    var raw = ($.coordPayload && $.coordPayload.value ? $.coordPayload.value : '').trim()

    if (!raw && $.kmlFileInput && $.kmlFileInput.files && $.kmlFileInput.files[0]) {
      raw = String(await readTextFromFile($.kmlFileInput.files[0]) || '').trim()
      if ($.coordPayload && raw) {
        $.coordPayload.value = raw
      }
    }

    if (!raw) {
      setClickResult('请先粘贴 KML 或选择 KML 文件')
      return
    }

    try {
      var rings = parseRingsFromKml(raw)
      if (!rings.length) {
        throw new Error('KML 中未找到可导入的 coordinates')
      }
      renderImportedRings(rings)
      setClickResult('导入完成，已绘制 ' + state.importedPolygons.length + ' 个区域')
    } catch (error) {
      setClickResult('导入失败：' + ((error && error.message) || error))
    }
  }

  async function onLoadPack() {
    var file = $.fileInput && $.fileInput.files && $.fileInput.files[0]
    if (!file) {
      setSummary('请先选择 zip 文件')
      return
    }

    setSummary('正在加载离线瓦片包...')
    setClickResult('未加载')

    try {
      if (state.pack) {
        state.pack.dispose()
      }

      var pack = await OfflineTilePackage.fromFile(file)
      state.pack = pack
      state.zoomPrepareToken += 1
      var token = state.zoomPrepareToken

      var summary = pack.getLoadedSummary()
      var zoomText = summary.availableZooms.length
        ? summary.availableZooms.join(',')
        : '无'

      setSummary('已加载瓦片包 | 可用缩放: [' + zoomText + '] | downloaded=' + summary.downloaded)

      setOfflineLayerVisible(true)
      fitToBounds(pack.metadata && pack.metadata.bounds ? pack.metadata.bounds : null)
      await prepareZoomTiles(getCurrentZoom(), token, false)
      setClickResult('已加载，点击地图识别区域')
    } catch (error) {
      if (state.pack) {
        state.pack.dispose()
      }
      state.pack = null
      setOfflineLayerVisible(false)
      setSummary('加载失败：' + ((error && error.message) || error))
      setClickResult('未加载')
    }
  }

  function onClearPack() {
    if (state.pack) {
      state.pack.dispose()
    }
    state.pack = null
    state.zoomPrepareToken += 1

    clearImportedPolygons()
    setOfflineLayerVisible(false)
    setSummary('未加载')
    setClickResult('未加载')
  }

  function bindEvents() {
    $.loadBtn.addEventListener('click', onLoadPack)
    $.clearBtn.addEventListener('click', onClearPack)

    if ($.exportUomBtn) {
      $.exportUomBtn.addEventListener('click', function () {
        onExportCurrentZoom().catch(function (error) {
          setSummary('导出失败：' + ((error && error.message) || error))
        })
      })
    }

    if ($.importUomBtn) {
      $.importUomBtn.addEventListener('click', function () {
        onImportUomPayload().catch(function (error) {
          setClickResult('导入失败：' + ((error && error.message) || error))
        })
      })
    }
  }

  function bootstrap() {
    initMap()
    bindEvents()
    setSummary('未加载')
    setClickResult('未加载')
  }

  bootstrap()
})()
