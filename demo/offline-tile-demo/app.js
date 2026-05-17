(function () {
  'use strict'

  var DEFAULT_CENTER = { lat: 39.908823, lng: 116.39747 }
  var DEFAULT_ZOOM = 11
  var EMPTY_TILE_DATA_URL = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='
  var QQMAP_SUGGEST_KEY = 'BSTBZ-7EECN-MQEFW-S4VWD-SDM3J-GVBQW'

  if (!window.OfflineTileApi) {
    throw new Error('OfflineTileApi not loaded')
  }

  var OfflineTilePackage = window.OfflineTileApi.OfflineTilePackage
  var normalizeCoordToGcj02 = window.OfflineTileApi.normalizeCoordToGcj02

  var state = {
    map: null,
    pack: null,
    clickMarker: null,
    searchMarker: null,
    importedPolygons: [],
    offlineMapType: null,
    offlineMapTypeIndex: -1,
    zoomPrepareToken: 0,
  }

  var $ = {
    fileInput: document.getElementById('zipFile'),
    dirInput: document.getElementById('tileDir'),
    loadBtn: document.getElementById('loadBtn'),
    clearBtn: document.getElementById('clearBtn'),
    searchInput: document.getElementById('searchKeyword'),
    searchBtn: document.getElementById('searchBtn'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    searchSummary: document.getElementById('searchSummary'),
    searchResults: document.getElementById('searchResults'),
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

  function setSearchSummary(text) {
    if ($.searchSummary) {
      $.searchSummary.textContent = text
    }
  }

  function renderSearchResultsEmpty(text) {
    if (!$.searchResults) {
      return
    }

    $.searchResults.innerHTML = ''
    var empty = document.createElement('div')
    empty.className = 'search-empty'
    empty.textContent = text
    $.searchResults.appendChild(empty)
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
      await classifyMapPoint(lat, lng, { prefix: '点击识别' })
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

  function clearSearchMarker() {
    if (!state.searchMarker) {
      return
    }

    try {
      state.searchMarker.setMap(null)
    } catch (e) {
      // ignore
    }
    state.searchMarker = null
  }

  function renderSearchMarker(lat, lng, title) {
    if (!state.map || !window.qq || !window.qq.maps) {
      return
    }

    clearSearchMarker()
    state.searchMarker = new window.qq.maps.Marker({
      map: state.map,
      position: new window.qq.maps.LatLng(lat, lng),
      title: title || '',
    })
  }

  function getCurrentMapCenter() {
    if (!state.map || typeof state.map.getCenter !== 'function') {
      return DEFAULT_CENTER
    }

    var center = state.map.getCenter()
    var lat = Number(center && center.getLat && center.getLat())
    var lng = Number(center && center.getLng && center.getLng())
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return DEFAULT_CENTER
    }

    return { lat: lat, lng: lng }
  }

  async function classifyMapPoint(lat, lng, options) {
    var prefix = options && options.prefix ? String(options.prefix) + '：' : ''

    if (!state.pack) {
      setClickResult(prefix + '未加载（坐标：' + lat.toFixed(6) + ', ' + lng.toFixed(6) + '）')
      return
    }

    try {
      var zoom = getCurrentZoom()
      var result = await state.pack.classifyPoint({
        lng: lng,
        lat: lat,
        zoom: zoom,
        coordType: ($.coordType && $.coordType.value) || 'GCJ02',
      })

      if (!result.loaded) {
        setClickResult(prefix + '未加载：' + result.reason + ' | Z' + result.z + '/' + result.x + '/' + result.y)
        return
      }

      setClickResult(
        prefix + result.zone + ' | ' + result.detail + ' | Z' + result.z + '/' + result.x + '/' + result.y +
        ' | RGBA(' + result.rgba.r + ',' + result.rgba.g + ',' + result.rgba.b + ',' + result.rgba.a + ')'
      )
    } catch (error) {
      setClickResult(prefix + '识别失败：' + ((error && error.message) || error))
    }
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

  function qqMapJsonp(url, callbackParam, timeout) {
    return new Promise(function (resolve, reject) {
      if (!document || !document.body) {
        reject(new Error('当前环境不支持地图搜索'))
        return
      }

      var callbackName = 'qqmap_jsonp_' + Date.now() + '_' + Math.random().toString(36).slice(2)
      var script = document.createElement('script')
      var timeoutId = null

      function cleanup() {
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
        try {
          delete window[callbackName]
        } catch (e) {
          window[callbackName] = void 0
        }
        if (script.parentNode) {
          script.parentNode.removeChild(script)
        }
      }

      window[callbackName] = function (data) {
        cleanup()
        resolve(data)
      }

      script.onerror = function () {
        cleanup()
        reject(new Error('地图搜索请求失败'))
      }

      timeoutId = setTimeout(function () {
        cleanup()
        reject(new Error('地图搜索超时'))
      }, timeout || 12000)

      script.src = url + (url.indexOf('?') > -1 ? '&' : '?') + (callbackParam || 'callback') + '=' + callbackName
      document.body.appendChild(script)
    })
  }

  async function searchPlaces(keyword, center) {
    var trimmed = String(keyword || '').trim()
    if (!trimmed) {
      return []
    }
    if (!QQMAP_SUGGEST_KEY) {
      throw new Error('缺少腾讯地图搜索 Key')
    }

    var url = new URL('https://apis.map.qq.com/ws/place/v1/suggestion')
    url.searchParams.set('key', QQMAP_SUGGEST_KEY)
    url.searchParams.set('keyword', trimmed)
    url.searchParams.set('output', 'jsonp')
    url.searchParams.set('region', 'nationwide')
    url.searchParams.set('policy', '1')
    url.searchParams.set('page_size', '8')

    if (center && Number.isFinite(center.lat) && Number.isFinite(center.lng)) {
      url.searchParams.set('location', center.lat + ',' + center.lng)
    }

    var data = await qqMapJsonp(url.toString(), 'callback', 12000)
    if (!data || data.status !== 0 || !Array.isArray(data.data)) {
      return []
    }

    var results = []
    for (var i = 0; i < data.data.length; i += 1) {
      var item = data.data[i]
      var location = item && item.location
      var lat = Number(location && location.lat)
      var lng = Number(location && location.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        continue
      }
      results.push({
        id: item.id || ('poi-' + i + '-' + lng + '-' + lat),
        title: item.title || '未命名地点',
        address: item.address || '',
        lat: lat,
        lng: lng,
      })
    }

    return results
  }

  function renderSearchResults(results) {
    if (!$.searchResults) {
      return
    }

    $.searchResults.innerHTML = ''
    if (!results || !results.length) {
      renderSearchResultsEmpty('未找到匹配地点')
      return
    }

    for (var i = 0; i < results.length; i += 1) {
      (function (item) {
        var button = document.createElement('button')
        button.type = 'button'
        button.className = 'search-result-item'

        var title = document.createElement('div')
        title.className = 'search-result-title'
        title.textContent = item.title || '未命名地点'

        var address = document.createElement('div')
        address.className = 'search-result-address'
        address.textContent = item.address || ('坐标：' + item.lat.toFixed(6) + ', ' + item.lng.toFixed(6))

        button.appendChild(title)
        button.appendChild(address)
        button.addEventListener('click', function () {
          applySearchResult(item)
        })
        $.searchResults.appendChild(button)
      })(results[i])
    }
  }

  function applySearchResult(item) {
    if (!state.map || !item) {
      return
    }

    var lat = Number(item.lat)
    var lng = Number(item.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return
    }

    var target = new window.qq.maps.LatLng(lat, lng)
    try {
      if (typeof state.map.setCenter === 'function') {
        state.map.setCenter(target)
      }
      if (typeof state.map.panTo === 'function') {
        state.map.panTo(target)
      }
      if (typeof state.map.setZoom === 'function') {
        state.map.setZoom(Math.max(getCurrentZoom(), 15))
      }
    } catch (e) {
      // ignore
    }

    renderSearchMarker(lat, lng, item.title || '')
    setSearchSummary('已定位：' + (item.title || '未命名地点'))
    if ($.searchInput) {
      $.searchInput.value = item.title || ''
    }

    setTimeout(function () {
      classifyMapPoint(lat, lng, { prefix: '搜索定位' }).catch(function () {
        // ignore
      })
    }, 0)
  }

  async function onSearch() {
    var keyword = $.searchInput && $.searchInput.value ? $.searchInput.value.trim() : ''
    if (!keyword) {
      setSearchSummary('请输入搜索关键词')
      renderSearchResultsEmpty('请输入地名、地址或 POI 后再搜索')
      return
    }

    setSearchSummary('搜索中...')
    renderSearchResultsEmpty('正在查询地点建议...')

    try {
      var results = await searchPlaces(keyword, getCurrentMapCenter())
      renderSearchResults(results)
      if (!results.length) {
        setSearchSummary('未找到结果')
        return
      }
      setSearchSummary('找到 ' + results.length + ' 个候选地点，点击可定位')
    } catch (error) {
      setSearchSummary('搜索失败：' + ((error && error.message) || error))
      renderSearchResultsEmpty('搜索失败，请稍后重试')
    }
  }

  function onClearSearch() {
    if ($.searchInput) {
      $.searchInput.value = ''
    }
    clearSearchMarker()
    setSearchSummary('未搜索')
    renderSearchResultsEmpty('输入关键词后可搜索地点并定位')
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
    kml.push('    <ExtendedData>')
    kml.push('      <Data name="coordType"><value>GCJ02</value></Data>')
    kml.push('    </ExtendedData>')
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
      kml.push('      <ExtendedData><Data name="coordType"><value>GCJ02</value></Data></ExtendedData>')
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

  function normalizeCoordTypeName(value, fallback) {
    var normalized = String(value || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
    if (normalized === 'GCJ02') {
      return 'GCJ02'
    }
    if (normalized === 'WGS84') {
      return 'WGS84'
    }
    return fallback || ''
  }

  function getFirstElementByLocalName(root, name) {
    var found = findElementsByLocalName(root, name)
    return found.length ? found[0] : null
  }

  function getFirstElementTextByLocalName(root, name) {
    var element = getFirstElementByLocalName(root, name)
    return element ? String(element.textContent || '').trim() : ''
  }

  function clampNumber(value, min, max, fallback) {
    var num = Number(value)
    if (!Number.isFinite(num)) {
      return fallback
    }
    if (num < min) return min
    if (num > max) return max
    return num
  }

  function toQqColor(hex, opacity) {
    var normalized = String(hex || '').replace('#', '')
    if (!/^[0-9a-fA-F]{6}$/.test(normalized) || !window.qq || !window.qq.maps || !window.qq.maps.Color) {
      return hex
    }
    return new window.qq.maps.Color(
      parseInt(normalized.slice(0, 2), 16),
      parseInt(normalized.slice(2, 4), 16),
      parseInt(normalized.slice(4, 6), 16),
      clampNumber(opacity, 0, 1, 1)
    )
  }

  function parseBooleanFlag(value, defaultValue) {
    var normalized = String(value == null ? '' : value).trim().toLowerCase()
    if (!normalized) {
      return defaultValue
    }
    if (normalized === '1' || normalized === 'true' || normalized === 'yes') {
      return true
    }
    if (normalized === '0' || normalized === 'false' || normalized === 'no') {
      return false
    }
    return defaultValue
  }

  function parseKmlColorValue(value, fallbackOpacity) {
    var normalized = String(value || '').trim()
    if (!normalized) {
      return null
    }

    if (normalized.charAt(0) === '#') {
      normalized = normalized.slice(1)
    }

    if (/^[0-9a-fA-F]{8}$/.test(normalized)) {
      var hex = normalized.toLowerCase()
      return {
        color: '#' + hex.slice(6, 8) + hex.slice(4, 6) + hex.slice(2, 4),
        opacity: Number((parseInt(hex.slice(0, 2), 16) / 255).toFixed(4)),
      }
    }

    if (/^[0-9a-fA-F]{6}$/.test(normalized)) {
      return {
        color: '#' + normalized.toLowerCase(),
        opacity: fallbackOpacity,
      }
    }

    return null
  }

  function mergeImportStyle(baseStyle, overrideStyle) {
    var merged = {}
    var key
    if (baseStyle) {
      for (key in baseStyle) {
        if (Object.prototype.hasOwnProperty.call(baseStyle, key) && baseStyle[key] != null) {
          merged[key] = baseStyle[key]
        }
      }
    }
    if (overrideStyle) {
      for (key in overrideStyle) {
        if (Object.prototype.hasOwnProperty.call(overrideStyle, key) && overrideStyle[key] != null) {
          merged[key] = overrideStyle[key]
        }
      }
    }
    return merged
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

  function getDirectChildElementsByLocalName(node, localName) {
    if (!node || !node.childNodes || !localName) {
      return []
    }

    var matches = []
    var expected = String(localName).toLowerCase()
    for (var i = 0; i < node.childNodes.length; i += 1) {
      var child = node.childNodes[i]
      if (child && child.nodeType === 1 && String(child.localName || child.nodeName || '').toLowerCase() === expected) {
        matches.push(child)
      }
    }
    return matches
  }

  function getExtendedDataValue(node, name) {
    if (!node || !name) {
      return ''
    }

    var target = String(name).trim().toLowerCase()
    var extendedDataNodes = getDirectChildElementsByLocalName(node, 'ExtendedData')
    for (var i = 0; i < extendedDataNodes.length; i += 1) {
      var dataNodes = getDirectChildElementsByLocalName(extendedDataNodes[i], 'Data')
      for (var j = 0; j < dataNodes.length; j += 1) {
        var dataNode = dataNodes[j]
        var dataName = String(dataNode.getAttribute('name') || '').trim().toLowerCase()
        if (dataName !== target) {
          continue
        }

        var value = getFirstElementTextByLocalName(dataNode, 'value')
        if (value) {
          return value
        }
      }
    }

    return ''
  }

  function parseCoordTypeFromNode(node) {
    return normalizeCoordTypeName(
      getExtendedDataValue(node, 'coordType') || getExtendedDataValue(node, 'coord_type'),
      ''
    )
  }

  function parseStyleNode(styleNode) {
    if (!styleNode) {
      return null
    }

    var style = {}
    var lineStyle = getFirstElementByLocalName(styleNode, 'LineStyle')
    if (lineStyle) {
      var lineColor = parseKmlColorValue(getFirstElementTextByLocalName(lineStyle, 'color'), null)
      if (lineColor) {
        style.strokeColor = lineColor.color
        style.strokeOpacity = lineColor.opacity
      }
      var width = Number(getFirstElementTextByLocalName(lineStyle, 'width'))
      if (Number.isFinite(width) && width > 0) {
        style.strokeWeight = width
      }
    }

    var polyStyle = getFirstElementByLocalName(styleNode, 'PolyStyle')
    if (polyStyle) {
      var fillColor = parseKmlColorValue(getFirstElementTextByLocalName(polyStyle, 'color'), null)
      if (fillColor) {
        style.fillColor = fillColor.color
        style.fillOpacity = fillColor.opacity
      }
      if (!parseBooleanFlag(getFirstElementTextByLocalName(polyStyle, 'fill'), true)) {
        style.fillOpacity = 0
      }
      if (!parseBooleanFlag(getFirstElementTextByLocalName(polyStyle, 'outline'), true)) {
        style.strokeOpacity = 0
      }
    }

    return style
  }

  function parseExtendedDataStyle(placemarkNode) {
    var dataNodes = findElementsByLocalName(placemarkNode, 'Data')
    if (!dataNodes.length) {
      return null
    }

    var style = {}
    for (var i = 0; i < dataNodes.length; i += 1) {
      var dataNode = dataNodes[i]
      var name = String(dataNode.getAttribute('name') || '').trim().toLowerCase()
      var value = getFirstElementTextByLocalName(dataNode, 'value')

      if (!name || !value) {
        continue
      }

      if (name === 'fill') {
        var fillColor = parseKmlColorValue(value, null)
        if (fillColor) {
          style.fillColor = fillColor.color
          if (fillColor.opacity != null) {
            style.fillOpacity = fillColor.opacity
          }
        }
      } else if (name === 'fill-opacity') {
        style.fillOpacity = clampNumber(value, 0, 1, null)
      } else if (name === 'stroke') {
        var strokeColor = parseKmlColorValue(value, null)
        if (strokeColor) {
          style.strokeColor = strokeColor.color
          if (strokeColor.opacity != null) {
            style.strokeOpacity = strokeColor.opacity
          }
        }
      } else if (name === 'stroke-opacity') {
        style.strokeOpacity = clampNumber(value, 0, 1, null)
      } else if (name === 'stroke-width') {
        var strokeWidth = Number(value)
        if (Number.isFinite(strokeWidth) && strokeWidth > 0) {
          style.strokeWeight = strokeWidth
        }
      }
    }

    return style
  }

  function buildKmlStyleRegistry(xml) {
    var styleNodes = findElementsByLocalName(xml, 'Style')
    var styleMapNodes = findElementsByLocalName(xml, 'StyleMap')
    var registry = {
      styles: {},
      styleMaps: {},
    }

    for (var i = 0; i < styleNodes.length; i += 1) {
      var styleNode = styleNodes[i]
      var styleId = String(styleNode.getAttribute('id') || '').trim()
      if (!styleId) {
        continue
      }
      registry.styles[styleId] = parseStyleNode(styleNode)
    }

    for (var j = 0; j < styleMapNodes.length; j += 1) {
      var styleMapNode = styleMapNodes[j]
      var styleMapId = String(styleMapNode.getAttribute('id') || '').trim()
      if (!styleMapId) {
        continue
      }

      var pairNodes = findElementsByLocalName(styleMapNode, 'Pair')
      var mappedStyleUrl = ''
      for (var k = 0; k < pairNodes.length; k += 1) {
        var pairNode = pairNodes[k]
        var key = getFirstElementTextByLocalName(pairNode, 'key').toLowerCase()
        var styleUrl = getFirstElementTextByLocalName(pairNode, 'styleUrl')
        if (!styleUrl) {
          continue
        }
        if (key === 'normal') {
          mappedStyleUrl = styleUrl
          break
        }
        if (!mappedStyleUrl) {
          mappedStyleUrl = styleUrl
        }
      }

      if (mappedStyleUrl) {
        registry.styleMaps[styleMapId] = mappedStyleUrl
      }
    }

    return registry
  }

  function normalizeStyleRef(styleUrl) {
    var value = String(styleUrl || '').trim()
    if (!value) {
      return ''
    }
    var hashIndex = value.lastIndexOf('#')
    if (hashIndex > -1) {
      return value.slice(hashIndex + 1)
    }
    return value
  }

  function resolveStyleFromUrl(styleUrl, registry, depth) {
    var styleRef = normalizeStyleRef(styleUrl)
    if (!styleRef || !registry || depth > 8) {
      return null
    }
    if (registry.styles[styleRef]) {
      return registry.styles[styleRef]
    }
    if (registry.styleMaps[styleRef]) {
      return resolveStyleFromUrl(registry.styleMaps[styleRef], registry, depth + 1)
    }
    return null
  }

  function parsePolygonGeometry(polygonNode) {
    if (!polygonNode) {
      return null
    }

    var outerBoundaryNode = getFirstElementByLocalName(polygonNode, 'outerBoundaryIs')
    var outerCoordinatesNode = outerBoundaryNode
      ? getFirstElementByLocalName(outerBoundaryNode, 'coordinates')
      : getFirstElementByLocalName(polygonNode, 'coordinates')
    var outerRing = parseCoordinatesText(outerCoordinatesNode ? outerCoordinatesNode.textContent : '')
    if (outerRing.length < 4) {
      return null
    }

    var innerBoundaryNodes = findElementsByLocalName(polygonNode, 'innerBoundaryIs')
    var innerRings = []
    for (var i = 0; i < innerBoundaryNodes.length; i += 1) {
      var innerCoordinatesNode = getFirstElementByLocalName(innerBoundaryNodes[i], 'coordinates')
      var innerRing = parseCoordinatesText(innerCoordinatesNode ? innerCoordinatesNode.textContent : '')
      if (innerRing.length >= 4) {
        innerRings.push(innerRing)
      }
    }

    return {
      outerRing: outerRing,
      innerRings: innerRings,
    }
  }

  function parseKmlShapes(text) {
    var parser = new DOMParser()
    var xml = parser.parseFromString(String(text || ''), 'application/xml')
    var parseError = xml.getElementsByTagName('parsererror')
    if (parseError && parseError.length) {
      throw new Error('KML 解析失败，请检查 XML 格式')
    }

    var registry = buildKmlStyleRegistry(xml)
    var documentNode = getFirstElementByLocalName(xml, 'Document')
    var documentCoordType = parseCoordTypeFromNode(documentNode) || parseCoordTypeFromNode(xml) || 'WGS84'
    var placemarkNodes = findElementsByLocalName(xml, 'Placemark')
    var shapes = []

    for (var i = 0; i < placemarkNodes.length; i += 1) {
      var placemarkNode = placemarkNodes[i]
      var placemarkStyle = resolveStyleFromUrl(getFirstElementTextByLocalName(placemarkNode, 'styleUrl'), registry, 0)
      placemarkStyle = mergeImportStyle(placemarkStyle, parseStyleNode(getFirstElementByLocalName(placemarkNode, 'Style')))
      placemarkStyle = mergeImportStyle(placemarkStyle, parseExtendedDataStyle(placemarkNode))
      var placemarkCoordType = parseCoordTypeFromNode(placemarkNode) || documentCoordType

      var polygonNodes = findElementsByLocalName(placemarkNode, 'Polygon')
      for (var j = 0; j < polygonNodes.length; j += 1) {
        var geometry = parsePolygonGeometry(polygonNodes[j])
        if (!geometry) {
          continue
        }
        shapes.push({
          outerRing: geometry.outerRing,
          innerRings: geometry.innerRings,
          style: placemarkStyle,
          coordType: placemarkCoordType,
        })
      }
    }

    return shapes
  }

  function renderImportedShapes(shapes) {
    if (!state.map || !window.qq || !window.qq.maps || !window.qq.maps.Polygon || !window.qq.maps.LatLng) {
      throw new Error('qq.maps polygon not available')
    }

    clearImportedPolygons()

    var minLng = Infinity
    var minLat = Infinity
    var maxLng = -Infinity
    var maxLat = -Infinity

    for (var i = 0; i < shapes.length; i += 1) {
      var shape = shapes[i]
      if (!shape || !shape.outerRing) {
        continue
      }

      var allRings = [shape.outerRing].concat(Array.isArray(shape.innerRings) ? shape.innerRings : [])
      var polygonPaths = []
      var coordType = normalizeCoordTypeName(shape.coordType, 'WGS84') || 'WGS84'

      for (var j = 0; j < allRings.length; j += 1) {
        var ring = normalizeRing(allRings[j])
        if (!ring) {
          continue
        }

        var path = []
        for (var k = 0; k < ring.length; k += 1) {
          var point = ring[k]
          var lng = Number(point[0])
          var lat = Number(point[1])
          if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
            continue
          }

          var normalized = normalizeCoordToGcj02({
            lng: lng,
            lat: lat,
            coordType: coordType,
          })
          lng = normalized.lng
          lat = normalized.lat

          if (lng < minLng) minLng = lng
          if (lng > maxLng) maxLng = lng
          if (lat < minLat) minLat = lat
          if (lat > maxLat) maxLat = lat
          path.push(new window.qq.maps.LatLng(lat, lng))
        }

        if (path.length >= 4) {
          polygonPaths.push(path)
        }
      }

      if (!polygonPaths.length) {
        continue
      }

      var style = shape.style || {}
      var fillOpacity = style.fillOpacity != null ? clampNumber(style.fillOpacity, 0, 1, 0.26) : 0.26
      var strokeOpacity = style.strokeOpacity != null ? clampNumber(style.strokeOpacity, 0, 1, 0.95) : 0.95
      var fillColor = style.fillColor || '#22c55e'
      var strokeColor = style.strokeColor || '#15803d'
      var polygon = new window.qq.maps.Polygon({
        map: state.map,
        path: polygonPaths.length === 1 ? polygonPaths[0] : polygonPaths,
        fillColor: toQqColor(fillColor, fillOpacity),
        fillOpacity: fillOpacity,
        strokeColor: toQqColor(strokeColor, strokeOpacity),
        strokeWeight: style.strokeWeight != null ? Math.max(1, Number(style.strokeWeight) || 2) : 2,
        strokeOpacity: strokeOpacity,
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
      var shapes = parseKmlShapes(raw)
      if (!shapes.length) {
        throw new Error('KML 中未找到可导入的 coordinates')
      }
      renderImportedShapes(shapes)
      setClickResult('导入完成，已绘制 ' + state.importedPolygons.length + ' 个区域')
    } catch (error) {
      setClickResult('导入失败：' + ((error && error.message) || error))
    }
  }

  async function onLoadPack() {
    var file = $.fileInput && $.fileInput.files && $.fileInput.files[0]
    var dirFiles = $.dirInput && $.dirInput.files ? Array.from($.dirInput.files) : []
    if (!file && !dirFiles.length) {
      setSummary('请先选择 zip 文件或瓦片目录')
      return
    }

    setSummary('正在加载离线瓦片包...')
    setClickResult('未加载')

    try {
      if (state.pack) {
        state.pack.dispose()
      }

      var pack = null
      var sourceLabel = 'zip'
      if (dirFiles.length) {
        pack = await OfflineTilePackage.fromDirectoryFiles(dirFiles)
        sourceLabel = '目录'
      } else {
        pack = await OfflineTilePackage.fromFile(file)
      }
      state.pack = pack
      state.zoomPrepareToken += 1
      var token = state.zoomPrepareToken

      var summary = pack.getLoadedSummary()
      var zoomText = summary.availableZooms.length
        ? summary.availableZooms.join(',')
        : '无'

      setSummary('已加载瓦片' + sourceLabel + ' | 可用缩放: [' + zoomText + '] | downloaded=' + summary.downloaded)

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
    if ($.fileInput) {
      $.fileInput.value = ''
    }
    if ($.dirInput) {
      $.dirInput.value = ''
    }
    setSummary('未加载')
    setClickResult('未加载')
  }

  function bindEvents() {
    $.loadBtn.addEventListener('click', onLoadPack)
    $.clearBtn.addEventListener('click', onClearPack)
    if ($.searchBtn) {
      $.searchBtn.addEventListener('click', function () {
        onSearch().catch(function (error) {
          setSearchSummary('搜索失败：' + ((error && error.message) || error))
        })
      })
    }
    if ($.clearSearchBtn) {
      $.clearSearchBtn.addEventListener('click', onClearSearch)
    }
    if ($.searchInput) {
      $.searchInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          event.preventDefault()
          onSearch().catch(function (error) {
            setSearchSummary('搜索失败：' + ((error && error.message) || error))
          })
        }
      })
    }

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
    setSearchSummary('未搜索')
    renderSearchResultsEmpty('输入关键词后可搜索地点并定位')
  }

  bootstrap()
})()
