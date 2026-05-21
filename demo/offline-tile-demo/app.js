(function () {
  'use strict'

  var DEFAULT_CENTER = { lat: 39.908823, lng: 116.39747 }
  var DEFAULT_ZOOM = 11
  var MIN_MEANINGFUL_COVERAGE_PIXELS = 200
  var MAX_PROVINCE_EVALUATION_ZOOM = 8
  var EMPTY_TILE_DATA_URL = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='
  var QQMAP_SUGGEST_KEY = 'BSTBZ-7EECN-MQEFW-S4VWD-SDM3J-GVBQW'
  var PACK_KEYS = ['old', 'new']
  var PACK_LABELS = {
    old: '旧版',
    new: '新版',
  }
  var PROVINCE_DISPLAY_NAMES = {
    'CN-11': '北京市',
    'CN-12': '天津市',
    'CN-13': '河北省',
    'CN-14': '山西省',
    'CN-15': '内蒙古自治区',
    'CN-21': '辽宁省',
    'CN-22': '吉林省',
    'CN-23': '黑龙江省',
    'CN-31': '上海市',
    'CN-32': '江苏省',
    'CN-33': '浙江省',
    'CN-34': '安徽省',
    'CN-35': '福建省',
    'CN-36': '江西省',
    'CN-37': '山东省',
    'CN-41': '河南省',
    'CN-42': '湖北省',
    'CN-43': '湖南省',
    'CN-44': '广东省',
    'CN-45': '广西壮族自治区',
    'CN-46': '海南省',
    'CN-50': '重庆市',
    'CN-51': '四川省',
    'CN-52': '贵州省',
    'CN-53': '云南省',
    'CN-54': '西藏自治区',
    'CN-61': '陕西省',
    'CN-62': '甘肃省',
    'CN-63': '青海省',
    'CN-64': '宁夏回族自治区',
    'CN-65': '新疆维吾尔自治区',
    'CN-71': '台湾省',
    'CN-81': '香港特别行政区',
    'CN-82': '澳门特别行政区',
  }
  if (!window.OfflineTileApi) {
    throw new Error('OfflineTileApi not loaded')
  }

  var OfflineTilePackage = window.OfflineTileApi.OfflineTilePackage
  var normalizeCoordToGcj02 = window.OfflineTileApi.normalizeCoordToGcj02
  var metersPerPixelAtLat = window.OfflineTileApi.metersPerPixelAtLat

  var state = {
    map: null,
    packs: {
      old: null,
      new: null,
    },
    offlineMapTypes: {
      old: null,
      new: null,
    },
    visibleLayerIndex: -1,
    visibleLayerKey: '',
    activePackKey: 'old',
    zoomPrepareTokens: {
      old: 0,
      new: 0,
    },
    clickMarker: null,
    searchMarker: null,
    importedPolygons: [],
    provinceMaskCanvas: null,
    provinceMaskListeners: [],
    provinceMaskResizeHandler: null,
    activeProvince: null,
    provinceCatalog: [],
    provinceShapeCache: {},
    bboxSelectionLayer: null,
    bboxSelectionRect: null,
    bboxSelectionActive: false,
    bboxSelectionDragging: false,
    bboxSelectionStartPixel: null,
    bboxSelectionCurrentPixel: null,
    bboxSelectionBounds: null,
  }

  var $ = {
    oldZipFile: document.getElementById('oldZipFile'),
    newTileDir: document.getElementById('newTileDir'),
    loadPacksBtn: document.getElementById('loadPacksBtn'),
    clearPacksBtn: document.getElementById('clearPacksBtn'),
    showOldBtn: document.getElementById('showOldBtn'),
    showNewBtn: document.getElementById('showNewBtn'),
    oldPackSummary: document.getElementById('oldPackSummary'),
    newPackSummary: document.getElementById('newPackSummary'),
    activeLayerSummary: document.getElementById('activeLayerSummary'),
    zoomInfo: document.getElementById('zoomInfo'),
    enableProvinceMask: document.getElementById('enableProvinceMask'),
    provinceSelect: document.getElementById('provinceSelect'),
    compareZoom: document.getElementById('compareZoom'),
    applyProvinceBtn: document.getElementById('applyProvinceBtn'),
    clearProvinceBtn: document.getElementById('clearProvinceBtn'),
    provinceSummary: document.getElementById('provinceSummary'),
    evaluateBtn: document.getElementById('evaluateBtn'),
    compareResult: document.getElementById('compareResult'),
    reportProvinceSelect: document.getElementById('reportProvinceSelect'),
    selectAllReportProvincesBtn: document.getElementById('selectAllReportProvincesBtn'),
    clearReportProvincesBtn: document.getElementById('clearReportProvincesBtn'),
    generateReportBtn: document.getElementById('generateReportBtn'),
    reportStatus: document.getElementById('reportStatus'),
    coordType: document.getElementById('coordType'),
    clickResult: document.getElementById('clickResult'),
    searchInput: document.getElementById('searchKeyword'),
    searchBtn: document.getElementById('searchBtn'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    searchSummary: document.getElementById('searchSummary'),
    searchResults: document.getElementById('searchResults'),
    startBboxSelectBtn: document.getElementById('startBboxSelectBtn'),
    clearBboxSelectionBtn: document.getElementById('clearBboxSelectionBtn'),
    copyBboxBtn: document.getElementById('copyBboxBtn'),
    bboxOutput: document.getElementById('bboxOutput'),
    bboxSummary: document.getElementById('bboxSummary'),
    exportUomBtn: document.getElementById('exportUomBtn'),
    importUomBtn: document.getElementById('importUomBtn'),
    kmlFileInput: document.getElementById('kmlFile'),
    segmentMeters: document.getElementById('segmentMeters'),
    coordPayload: document.getElementById('coordPayload'),
  }

  function setPackSummary(kind, text) {
    var el = kind === 'old' ? $.oldPackSummary : $.newPackSummary
    if (el) {
      el.textContent = text
    }
  }

  function setProvinceSummary(text) {
    if ($.provinceSummary) {
      $.provinceSummary.textContent = text
    }
  }

  function setClickResult(text) {
    if ($.clickResult) {
      $.clickResult.textContent = text
    }
  }

  function setSearchSummary(text) {
    if ($.searchSummary) {
      $.searchSummary.textContent = text
    }
  }

  function setBboxSummary(text) {
    if ($.bboxSummary) {
      $.bboxSummary.textContent = text
    }
  }

  function setBboxOutput(text) {
    if ($.bboxOutput) {
      $.bboxOutput.value = text
    }
  }

  function setCompareResult(text) {
    if ($.compareResult) {
      $.compareResult.textContent = text
    }
  }

  function setReportStatus(text) {
    if ($.reportStatus) {
      $.reportStatus.textContent = text
    }
  }

  function getCurrentZoom() {
    if (!state.map || typeof state.map.getZoom !== 'function') {
      return DEFAULT_ZOOM
    }
    return Math.round(state.map.getZoom())
  }

  function getPack(kind) {
    return state.packs[kind] || null
  }

  function getPackLabel(kind) {
    return PACK_LABELS[kind] || kind
  }

  function getActivePack() {
    return getPack(state.activePackKey)
  }

  function getLoadedPackKeys() {
    return PACK_KEYS.filter(function (kind) {
      return Boolean(getPack(kind))
    })
  }

  function clearVisibleOfflineLayer() {
    if (!state.map || !state.map.overlayMapTypes) {
      state.visibleLayerIndex = -1
      state.visibleLayerKey = ''
      return
    }

    if (state.visibleLayerIndex > -1) {
      try {
        state.map.overlayMapTypes.removeAt(state.visibleLayerIndex)
      } catch (e) {
        // ignore
      }
    }
    state.visibleLayerIndex = -1
    state.visibleLayerKey = ''
  }

  function ensureOfflineMapType(kind) {
    if (state.offlineMapTypes[kind] || !window.qq || !window.qq.maps || !window.qq.maps.ImageMapType || !window.qq.maps.Size) {
      return state.offlineMapTypes[kind]
    }

    state.offlineMapTypes[kind] = new window.qq.maps.ImageMapType({
      name: 'OfflineTiles-' + kind,
      tileSize: new window.qq.maps.Size(256, 256),
      isPng: true,
      getTileUrl: function (tileCoord, zoom) {
        var pack = getPack(kind)
        if (!pack) return EMPTY_TILE_DATA_URL
        var z = Number(zoom)
        var x = Number(tileCoord && tileCoord.x)
        var y = Number(tileCoord && tileCoord.y)
        var url = pack.getTileObjectUrlSync(z, x, y)
        return url || EMPTY_TILE_DATA_URL
      },
    })

    return state.offlineMapTypes[kind]
  }

  function refreshVisiblePackLayer() {
    clearVisibleOfflineLayer()

    if (!state.map || !window.qq || !window.qq.maps) {
      return
    }

    var activePack = getActivePack()
    if (!activePack) {
      $.activeLayerSummary.textContent = '未显示'
      updateLayerToggleButtons()
      return
    }

    var mapType = ensureOfflineMapType(state.activePackKey)
    if (!mapType) {
      $.activeLayerSummary.textContent = '未显示'
      updateLayerToggleButtons()
      return
    }

    state.visibleLayerIndex = state.map.overlayMapTypes.push(mapType) - 1
    state.visibleLayerKey = state.activePackKey
    $.activeLayerSummary.textContent = getPackLabel(state.activePackKey)
    updateLayerToggleButtons()
  }

  function updateLayerToggleButtons() {
    if ($.showOldBtn) {
      $.showOldBtn.disabled = !getPack('old')
      $.showOldBtn.className = state.activePackKey === 'old' ? '' : 'ghost'
    }
    if ($.showNewBtn) {
      $.showNewBtn.disabled = !getPack('new')
      $.showNewBtn.className = state.activePackKey === 'new' ? '' : 'ghost'
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

  async function preparePackZoom(kind, zoom, silent) {
    var pack = getPack(kind)
    if (!pack) {
      return
    }

    var z = Number(zoom)
    if (!Number.isFinite(z)) {
      return
    }

    if (!pack.hasZoom(z)) {
      if (!silent) {
        setPackSummary(kind, getPackLabel(kind) + ' 当前缩放 Z' + z + ' 无离线瓦片')
      }
      if (state.activePackKey === kind) {
        refreshVisiblePackLayer()
      }
      return
    }

    var availableZooms = pack.getAvailableZooms()
    for (var i = 0; i < availableZooms.length; i += 1) {
      var otherZoom = Number(availableZooms[i])
      if (otherZoom !== z && pack.isZoomPrepared(otherZoom)) {
        pack.releaseZoomTileUrls(otherZoom)
      }
    }

    var token = state.zoomPrepareTokens[kind]
    var stats = await pack.prepareZoomTileUrls(z)
    if (token !== state.zoomPrepareTokens[kind]) {
      return
    }

    if (!silent) {
      setPackSummary(kind, '已准备 ' + getPackLabel(kind) + ' Z' + z + ' 瓦片 ' + stats.prepared + '/' + stats.total)
    }

    if (state.activePackKey === kind) {
      refreshVisiblePackLayer()
    }
  }

  function getPrimaryBounds() {
    var province = getSelectedProvince()
    if (province && province.bounds) {
      return province.bounds
    }

    var activePack = getActivePack()
    if (activePack && activePack.metadata && activePack.metadata.bounds) {
      return activePack.metadata.bounds
    }

    var loadedKeys = getLoadedPackKeys()
    for (var i = 0; i < loadedKeys.length; i += 1) {
      var pack = getPack(loadedKeys[i])
      if (pack && pack.metadata && pack.metadata.bounds) {
        return pack.metadata.bounds
      }
    }

    return null
  }

  function setActivePack(kind) {
    if (!getPack(kind)) {
      return
    }

    state.activePackKey = kind
    state.zoomPrepareTokens[kind] += 1
    preparePackZoom(kind, getCurrentZoom(), false).catch(function (error) {
      setPackSummary(kind, '瓦片准备失败：' + ((error && error.message) || error))
    })
    refreshVisiblePackLayer()
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

    window.qq.maps.event.addListener(state.map, 'zoom_changed', function () {
      var z = getCurrentZoom()
      $.zoomInfo.textContent = '当前缩放：Z' + z

      window.requestAnimationFrame(syncBboxSelectionRectFromBounds)
      var activeKind = state.activePackKey
      if (!getPack(activeKind)) {
        return
      }

      state.zoomPrepareTokens[activeKind] += 1
      var token = state.zoomPrepareTokens[activeKind]
      preparePackZoom(activeKind, z, true).catch(function (error) {
        if (token !== state.zoomPrepareTokens[activeKind]) {
          return
        }
        setPackSummary(activeKind, '缩放瓦片准备失败：' + ((error && error.message) || error))
      })
    })

    window.qq.maps.event.addListener(state.map, 'bounds_changed', function () {
      window.requestAnimationFrame(syncBboxSelectionRectFromBounds)
    })

    window.qq.maps.event.addListener(state.map, 'center_changed', function () {
      window.requestAnimationFrame(syncBboxSelectionRectFromBounds)
    })

    window.qq.maps.event.addListener(state.map, 'click', function (event) {
      if (state.bboxSelectionActive || state.bboxSelectionDragging) {
        return
      }

      var lat = Number(event && event.latLng && event.latLng.getLat && event.latLng.getLat())
      var lng = Number(event && event.latLng && event.latLng.getLng && event.latLng.getLng())
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return
      }

      renderClickMarker(lat, lng)
      classifyMapPoint(lat, lng, { prefix: '点击识别' }).catch(function (error) {
        setClickResult('点击识别失败：' + ((error && error.message) || error))
      })
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

  function formatZoneChange(oldResult, newResult) {
    if (!oldResult || !oldResult.loaded || !newResult || !newResult.loaded) {
      return ''
    }
    var oldSuitable = oldResult.rgba && oldResult.rgba.a > oldResult.alphaThreshold
    var newSuitable = newResult.rgba && newResult.rgba.a > newResult.alphaThreshold
    if (oldSuitable === newSuitable) {
      return '一致'
    }
    return newSuitable ? '适飞新增' : '适飞减少'
  }

  function buildClassifyText(label, result) {
    if (!result) {
      return label + '未加载'
    }
    if (!result.loaded) {
      return label + '未加载(' + result.reason + ')'
    }
    return label + result.zone
  }

  async function classifyMapPoint(lat, lng, options) {
    var prefix = options && options.prefix ? String(options.prefix) + '：' : ''
    var coordType = ($.coordType && $.coordType.value) || 'GCJ02'
    var oldPack = getPack('old')
    var newPack = getPack('new')

    if (!oldPack && !newPack) {
      setClickResult(prefix + '未加载（坐标：' + lat.toFixed(6) + ', ' + lng.toFixed(6) + '）')
      return
    }

    var zoom = getCurrentZoom()
    var oldResult = oldPack ? await oldPack.classifyPoint({ lng: lng, lat: lat, zoom: zoom, coordType: coordType }) : null
    var newResult = newPack ? await newPack.classifyPoint({ lng: lng, lat: lat, zoom: zoom, coordType: coordType }) : null

    if (oldResult && newResult) {
      setClickResult(
        prefix +
        buildClassifyText('旧版=', oldResult) +
        ' | ' +
        buildClassifyText('新版=', newResult) +
        ' | 变化=' + formatZoneChange(oldResult, newResult)
      )
      return
    }

    var singleKind = oldResult ? '旧版=' : '新版='
    var singleResult = oldResult || newResult
    setClickResult(prefix + buildClassifyText(singleKind, singleResult))
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
    if (!state.importedPolygons.length) {
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

  function clampNumber(value, min, max, fallback) {
    var num = Number(value)
    if (!Number.isFinite(num)) {
      return fallback
    }
    if (num < min) return min
    if (num > max) return max
    return num
  }

  function parseBooleanFlag(value, fallback) {
    if (value == null || value === '') {
      return fallback
    }
    var text = String(value).trim().toLowerCase()
    if (text === '1' || text === 'true' || text === 'yes') return true
    if (text === '0' || text === 'false' || text === 'no') return false
    return fallback
  }

  function normalizeCoordTypeName(value, fallback) {
    var text = String(value || '').trim().toUpperCase()
    if (text === 'GCJ02' || text === 'GCJ-02') return 'GCJ02'
    if (text === 'WGS84' || text === 'WGS-84') return 'WGS84'
    return fallback
  }

  function parseCoordinatesText(text) {
    var values = String(text || '').trim().split(/\s+/)
    var points = []
    for (var i = 0; i < values.length; i += 1) {
      var item = values[i].trim()
      if (!item) continue
      var segments = item.split(',')
      if (segments.length < 2) continue
      var lng = Number(segments[0])
      var lat = Number(segments[1])
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        continue
      }
      points.push([lng, lat])
    }
    return normalizeRing(points) || []
  }

  function mergeImportStyle(base, extra) {
    var merged = {}
    var key
    if (base) {
      for (key in base) merged[key] = base[key]
    }
    if (extra) {
      for (key in extra) merged[key] = extra[key]
    }
    return Object.keys(merged).length ? merged : null
  }

  function toHexByte(value) {
    return String(Math.round(clampNumber(value, 0, 255, 0)).toString(16)).padStart(2, '0')
  }

  function parseKmlColorValue(value, fallback) {
    var text = String(value || '').trim()
    if (!text) {
      return fallback
    }

    if (/^#[0-9a-f]{6}$/i.test(text)) {
      return { color: text, opacity: null }
    }

    if (!/^[0-9a-f]{8}$/i.test(text)) {
      return fallback
    }

    var alpha = parseInt(text.slice(0, 2), 16)
    var blue = text.slice(2, 4)
    var green = text.slice(4, 6)
    var red = text.slice(6, 8)
    return {
      color: '#' + red + green + blue,
      opacity: alpha / 255,
    }
  }

  function toQqColor(hexColor, opacity) {
    var color = String(hexColor || '#000000').trim()
    if (!/^#[0-9a-f]{6}$/i.test(color)) {
      color = '#000000'
    }
    var alpha = clampNumber(opacity, 0, 1, 1)
    var rgba = 'rgba(' +
      parseInt(color.slice(1, 3), 16) + ',' +
      parseInt(color.slice(3, 5), 16) + ',' +
      parseInt(color.slice(5, 7), 16) + ',' +
      alpha + ')'
    return rgba
  }

  function getFirstElementByLocalName(root, localName) {
    var elements = findElementsByLocalName(root, localName)
    return elements.length ? elements[0] : null
  }

  function getFirstElementTextByLocalName(root, localName) {
    var node = getFirstElementByLocalName(root, localName)
    return node ? String(node.textContent || '').trim() : ''
  }

  function findElementsByLocalName(root, localName) {
    if (!root || !localName) {
      return []
    }

    var target = String(localName).toLowerCase()
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
      var fillOpacity = style.fillOpacity != null ? clampNumber(style.fillOpacity, 0, 1, 0.22) : 0.22
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
    var pack = getActivePack()
    if (!pack) {
      setClickResult('未加载当前显示版本，无法导出')
      return
    }
    if (typeof pack.exportZoomRegionLatLng !== 'function') {
      setClickResult('当前离线包 API 不支持导出')
      return
    }

    var z = getCurrentZoom()
    if (!pack.hasZoom(z)) {
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

    setPackSummary(state.activePackKey, '正在导出 ' + getPackLabel(state.activePackKey) + ' Z' + z + ' UOM KML...')
    var lastProgressUpdate = -1

    try {
      var exported = await pack.exportZoomRegionLatLng({
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
            setPackSummary(
              state.activePackKey,
              '正在导出 ' + getPackLabel(state.activePackKey) + ' Z' + z + ' UOM KML... ' + done + '/' + total + ' 张瓦片'
            )
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
      setPackSummary(
        state.activePackKey,
        '导出完成 | rings=' + exported.stats.rings + ' | points=' + exported.stats.points + ' | selectedPixels=' + exported.stats.selectedPixels
      )
      setClickResult('导出完成，KML 已填充并下载')
    } catch (error) {
      setPackSummary(state.activePackKey, '导出失败：' + ((error && error.message) || error))
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

  function disposePack(kind) {
    var pack = getPack(kind)
    if (!pack) {
      return
    }
    try {
      pack.dispose()
    } catch (e) {
      // ignore
    }
    state.packs[kind] = null
    state.zoomPrepareTokens[kind] += 1
    setPackSummary(kind, '未加载')
  }

  function buildPackSummaryText(kind, pack) {
    var summary = pack.getLoadedSummary()
    var zoomText = summary.availableZooms.length ? summary.availableZooms.join(',') : '无'
    return getPackLabel(kind) + '已加载 | 可用缩放: [' + zoomText + '] | downloaded=' + summary.downloaded
  }

  function syncCompareZoomOptions() {
    if (!$.compareZoom) {
      return
    }

    var oldPack = getPack('old')
    var newPack = getPack('new')
    var currentValue = $.compareZoom.value
    $.compareZoom.innerHTML = ''

    if (!oldPack || !newPack) {
      var emptyOption = document.createElement('option')
      emptyOption.value = ''
      emptyOption.textContent = '需同时加载旧版和新版'
      $.compareZoom.appendChild(emptyOption)
      $.compareZoom.disabled = true
      if ($.evaluateBtn) {
        $.evaluateBtn.disabled = true
      }
      return
    }

    var sharedZooms = oldPack.getSharedZooms(newPack).filter(function (zoom) {
      return Number(zoom) <= MAX_PROVINCE_EVALUATION_ZOOM
    })
    if (!sharedZooms.length) {
      var noneOption = document.createElement('option')
      noneOption.value = ''
      noneOption.textContent = '无可用评估缩放（仅支持 Z' + MAX_PROVINCE_EVALUATION_ZOOM + ' 及以下）'
      $.compareZoom.appendChild(noneOption)
      $.compareZoom.disabled = true
      if ($.evaluateBtn) {
        $.evaluateBtn.disabled = true
      }
      return
    }

    for (var i = 0; i < sharedZooms.length; i += 1) {
      var zoom = sharedZooms[i]
      var option = document.createElement('option')
      option.value = String(zoom)
      option.textContent = 'Z' + zoom
      $.compareZoom.appendChild(option)
    }

    $.compareZoom.disabled = false
    if (sharedZooms.indexOf(Number(currentValue)) > -1) {
      $.compareZoom.value = currentValue
    } else {
      $.compareZoom.value = String(sharedZooms[sharedZooms.length - 1])
    }
    if ($.evaluateBtn) {
      $.evaluateBtn.disabled = false
    }
  }

  function getPreferredLoadedZoom() {
    var oldPack = getPack('old')
    var newPack = getPack('new')
    if (oldPack && newPack) {
      var highestCommon = oldPack.getHighestCommonZoom(newPack)
      if (Number.isFinite(highestCommon)) {
        return highestCommon
      }
    }

    var activePack = getActivePack()
    if (activePack) {
      var zooms = activePack.getAvailableZooms()
      if (zooms.length) {
        return zooms[zooms.length - 1]
      }
    }

    var loadedKeys = getLoadedPackKeys()
    for (var i = 0; i < loadedKeys.length; i += 1) {
      var pack = getPack(loadedKeys[i])
      var packZooms = pack ? pack.getAvailableZooms() : []
      if (packZooms.length) {
        return packZooms[packZooms.length - 1]
      }
    }

    return DEFAULT_ZOOM
  }

  async function onLoadPacks() {
    var oldFile = $.oldZipFile && $.oldZipFile.files ? $.oldZipFile.files[0] : null
    var newDirFiles = $.newTileDir && $.newTileDir.files ? Array.from($.newTileDir.files) : []

    if (!oldFile && !newDirFiles.length && !getPack('old') && !getPack('new')) {
      setPackSummary('old', '请选择旧版 zip')
      setPackSummary('new', '请选择新版目录')
      return
    }

    if (oldFile) {
      setPackSummary('old', '正在加载旧版 zip...')
      try {
        disposePack('old')
        state.packs.old = await OfflineTilePackage.fromFile(oldFile)
        setPackSummary('old', buildPackSummaryText('old', state.packs.old))
      } catch (error) {
        disposePack('old')
        setPackSummary('old', '加载失败：' + ((error && error.message) || error))
      }
    }

    if (newDirFiles.length) {
      setPackSummary('new', '正在加载新版目录...')
      try {
        disposePack('new')
        state.packs.new = await OfflineTilePackage.fromDirectoryFiles(newDirFiles)
        setPackSummary('new', buildPackSummaryText('new', state.packs.new))
      } catch (error) {
        disposePack('new')
        setPackSummary('new', '加载失败：' + ((error && error.message) || error))
      }
    }

    if (!getPack(state.activePackKey)) {
      var loaded = getLoadedPackKeys()
      state.activePackKey = loaded[0] || 'old'
    }

    syncCompareZoomOptions()
    refreshVisiblePackLayer()

    var bounds = getPrimaryBounds()
    if (bounds) {
      fitToBounds(bounds)
    }

    var preferredZoom = getPreferredLoadedZoom()
    var activePack = getActivePack()
    if (activePack && !activePack.hasZoom(getCurrentZoom()) && Number.isFinite(preferredZoom) && state.map && typeof state.map.setZoom === 'function') {
      state.map.setZoom(preferredZoom)
    }

    var currentZoom = getCurrentZoom()
    for (var i = 0; i < PACK_KEYS.length; i += 1) {
      var kind = PACK_KEYS[i]
      if (!getPack(kind)) {
        continue
      }
      state.zoomPrepareTokens[kind] += 1
      await preparePackZoom(kind, currentZoom, kind !== state.activePackKey).catch(function (error) {
        setPackSummary(kind, '缩放瓦片准备失败：' + ((error && error.message) || error))
      })
    }

    updateLayerToggleButtons()
    setClickResult('已加载，点击地图可同时识别新旧版本')
  }

  function onClearPacks() {
    disposePack('old')
    disposePack('new')
    clearVisibleOfflineLayer()
    clearImportedPolygons()

    if ($.oldZipFile) $.oldZipFile.value = ''
    if ($.newTileDir) $.newTileDir.value = ''

    syncCompareZoomOptions()
    updateLayerToggleButtons()
    $.activeLayerSummary.textContent = '未显示'
    setCompareResult('加载旧版 zip、新版目录并应用省域后，可评估省内适飞区增减。')
    setClickResult('未加载')
    setReportStatus('未生成')
  }

  function buildProvinceCatalog() {
    var payload = window.OfflineProvinceData
    if (!payload || !Array.isArray(payload.provinces)) {
      return []
    }

    return payload.provinces.map(function (province) {
      return {
        id: province.id,
        slug: province.slug,
        name: PROVINCE_DISPLAY_NAMES[province.id] || province.name || province.id,
        bounds: province.bounds || null,
        shapes: province.shapes || [],
      }
    }).sort(function (a, b) {
      return a.id.localeCompare(b.id)
    })
  }

  function populateProvinceSelect() {
    if (!$.provinceSelect) {
      return
    }

    $.provinceSelect.innerHTML = ''
    var placeholder = document.createElement('option')
    placeholder.value = ''
    placeholder.textContent = '请选择省份'
    $.provinceSelect.appendChild(placeholder)

    for (var i = 0; i < state.provinceCatalog.length; i += 1) {
      var province = state.provinceCatalog[i]
      var option = document.createElement('option')
      option.value = province.id
      option.textContent = province.name
      $.provinceSelect.appendChild(option)
    }
  }

  function populateReportProvinceSelect() {
    if (!$.reportProvinceSelect) {
      return
    }

    $.reportProvinceSelect.innerHTML = ''
    for (var i = 0; i < state.provinceCatalog.length; i += 1) {
      var province = state.provinceCatalog[i]
      var option = document.createElement('option')
      option.value = province.id
      option.textContent = province.name
      $.reportProvinceSelect.appendChild(option)
    }
  }

  function findProvinceById(provinceId) {
    for (var i = 0; i < state.provinceCatalog.length; i += 1) {
      if (state.provinceCatalog[i].id === provinceId) {
        return state.provinceCatalog[i]
      }
    }
    return null
  }

  function getSelectedProvince() {
    var selectedId = $.provinceSelect && $.provinceSelect.value ? $.provinceSelect.value : ''
    if (!selectedId) {
      return null
    }

    return findProvinceById(selectedId)
  }

  function getSelectedReportProvinces() {
    if (!$.reportProvinceSelect) {
      return []
    }

    var options = Array.prototype.slice.call($.reportProvinceSelect.options || [])
    var provinces = []
    for (var i = 0; i < options.length; i += 1) {
      if (!options[i].selected) {
        continue
      }
      var province = findProvinceById(options[i].value)
      if (province) {
        provinces.push(province)
      }
    }
    return provinces
  }

  function selectAllReportProvinces() {
    if (!$.reportProvinceSelect) {
      return
    }

    var options = $.reportProvinceSelect.options || []
    for (var i = 0; i < options.length; i += 1) {
      options[i].selected = true
    }
  }

  function clearReportProvinceSelection() {
    if (!$.reportProvinceSelect) {
      return
    }

    var options = $.reportProvinceSelect.options || []
    for (var i = 0; i < options.length; i += 1) {
      options[i].selected = false
    }
  }

  function ringToQqLatLngPath(ring) {
    var path = []
    for (var i = 0; i < ring.length; i += 1) {
      var point = ring[i]
      var lng = Number(point[0])
      var lat = Number(point[1])
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        continue
      }
      path.push(new window.qq.maps.LatLng(lat, lng))
    }
    return path
  }

  function getMapContainer() {
    return document.getElementById('map')
  }

  function getMapProjection() {
    if (!state.map || typeof state.map.getProjection !== 'function' || !window.qq || !window.qq.maps || !window.qq.maps.LatLng) {
      return null
    }

    var projection = state.map.getProjection()
    if (!projection || typeof projection.fromLatLngToPoint !== 'function') {
      return null
    }

    return projection
  }

  function latLngToContainerPixel(lat, lng) {
    var projection = getMapProjection()
    var mapContainer = getMapContainer()
    if (!projection || !mapContainer || !state.map || !window.qq || !window.qq.maps || !window.qq.maps.LatLng) {
      return null
    }

    var center = state.map.getCenter && state.map.getCenter()
    var zoom = state.map.getZoom && state.map.getZoom()
    var centerLat = Number(center && center.getLat && center.getLat())
    var centerLng = Number(center && center.getLng && center.getLng())
    var targetLat = Number(lat)
    var targetLng = Number(lng)

    if (![centerLat, centerLng, targetLat, targetLng, zoom].every(Number.isFinite)) {
      return null
    }

    var centerPoint = projection.fromLatLngToPoint(new window.qq.maps.LatLng(centerLat, centerLng))
    var targetPoint = projection.fromLatLngToPoint(new window.qq.maps.LatLng(targetLat, targetLng))
    if (!centerPoint || !targetPoint) {
      return null
    }

    var rect = mapContainer.getBoundingClientRect()
    var scale = Math.pow(2, Number(zoom))
    return {
      x: (targetPoint.x - centerPoint.x) * scale + rect.width / 2,
      y: (targetPoint.y - centerPoint.y) * scale + rect.height / 2,
    }
  }

  function containerPixelToLatLng(x, y) {
    var projection = getMapProjection()
    var mapContainer = getMapContainer()
    if (!projection || typeof projection.fromPointToLatLng !== 'function' || !mapContainer || !state.map) {
      return null
    }

    var center = state.map.getCenter && state.map.getCenter()
    var zoom = state.map.getZoom && state.map.getZoom()
    var centerLat = Number(center && center.getLat && center.getLat())
    var centerLng = Number(center && center.getLng && center.getLng())
    var pixelX = Number(x)
    var pixelY = Number(y)

    if (![centerLat, centerLng, pixelX, pixelY, zoom].every(Number.isFinite)) {
      return null
    }

    var centerPoint = projection.fromLatLngToPoint(new window.qq.maps.LatLng(centerLat, centerLng))
    if (!centerPoint) {
      return null
    }

    var rect = mapContainer.getBoundingClientRect()
    var scale = Math.pow(2, Number(zoom))
    var targetPointX = centerPoint.x + (pixelX - rect.width / 2) / scale
    var targetPointY = centerPoint.y + (pixelY - rect.height / 2) / scale
    var pointCtor = centerPoint.constructor
    var targetPoint = pointCtor ? new pointCtor(targetPointX, targetPointY) : { x: targetPointX, y: targetPointY }
    var latLng = projection.fromPointToLatLng(targetPoint)
    if (!latLng) {
      return null
    }

    var lat = Number(latLng.getLat && latLng.getLat())
    var lng = Number(latLng.getLng && latLng.getLng())
    if (![lat, lng].every(Number.isFinite)) {
      return null
    }

    return { lat: lat, lng: lng }
  }

  function formatBboxNumber(value) {
    var num = Number(value)
    if (!Number.isFinite(num)) {
      return ''
    }
    return num.toFixed(6)
  }

  function formatBboxBounds(bounds) {
    if (!bounds) {
      return ''
    }
    return [
      formatBboxNumber(bounds.minLng),
      formatBboxNumber(bounds.minLat),
      formatBboxNumber(bounds.maxLng),
      formatBboxNumber(bounds.maxLat),
    ].join(',')
  }

  function syncBboxSelectionButtons() {
    if ($.startBboxSelectBtn) {
      $.startBboxSelectBtn.textContent = state.bboxSelectionActive ? '取消框选' : '开始框选'
      $.startBboxSelectBtn.className = state.bboxSelectionActive ? 'warn' : ''
    }
    if ($.copyBboxBtn) {
      $.copyBboxBtn.disabled = !state.bboxSelectionBounds
    }
    if ($.clearBboxSelectionBtn) {
      $.clearBboxSelectionBtn.disabled = !state.bboxSelectionBounds && !state.bboxSelectionDragging
    }
  }

  function ensureBboxSelectionLayer() {
    var mapContainer = getMapContainer()
    if (!mapContainer) {
      return null
    }

    if (state.bboxSelectionLayer && state.bboxSelectionRect) {
      return state.bboxSelectionLayer
    }

    var layer = document.createElement('div')
    layer.className = 'bbox-selection-layer'

    var rect = document.createElement('div')
    rect.className = 'bbox-selection-rect'
    layer.appendChild(rect)

    layer.addEventListener('pointerdown', onBboxSelectionPointerDown)
    layer.addEventListener('pointermove', onBboxSelectionPointerMove)
    layer.addEventListener('pointerup', onBboxSelectionPointerUp)
    layer.addEventListener('pointercancel', onBboxSelectionPointerCancel)

    mapContainer.appendChild(layer)
    state.bboxSelectionLayer = layer
    state.bboxSelectionRect = rect

    syncBboxSelectionLayerState()
    return layer
  }

  function syncBboxSelectionLayerState() {
    var layer = ensureBboxSelectionLayer()
    if (!layer) {
      return
    }

    layer.classList.toggle('active', Boolean(state.bboxSelectionActive))
  }

  function hideBboxSelectionRect() {
    if (state.bboxSelectionRect) {
      state.bboxSelectionRect.style.display = 'none'
    }
  }

  function renderBboxSelectionRect(startPixel, endPixel) {
    var rect = state.bboxSelectionRect
    if (!rect || !startPixel || !endPixel) {
      hideBboxSelectionRect()
      return
    }

    var left = Math.min(startPixel.x, endPixel.x)
    var top = Math.min(startPixel.y, endPixel.y)
    var width = Math.abs(endPixel.x - startPixel.x)
    var height = Math.abs(endPixel.y - startPixel.y)

    rect.style.display = 'block'
    rect.style.left = left + 'px'
    rect.style.top = top + 'px'
    rect.style.width = width + 'px'
    rect.style.height = height + 'px'
  }

  function getBboxSelectionPointerPixel(event) {
    var layer = state.bboxSelectionLayer
    if (!layer || !event) {
      return null
    }

    var rect = layer.getBoundingClientRect()
    var x = Number(event.clientX) - rect.left
    var y = Number(event.clientY) - rect.top
    if (![x, y].every(Number.isFinite)) {
      return null
    }

    return {
      x: Math.max(0, Math.min(rect.width, x)),
      y: Math.max(0, Math.min(rect.height, y)),
    }
  }

  function buildBboxBoundsFromPixels(startPixel, endPixel) {
    if (!startPixel || !endPixel) {
      return null
    }

    var first = containerPixelToLatLng(startPixel.x, startPixel.y)
    var second = containerPixelToLatLng(endPixel.x, endPixel.y)
    if (!first || !second) {
      return null
    }

    return {
      minLat: Math.min(first.lat, second.lat),
      maxLat: Math.max(first.lat, second.lat),
      minLng: Math.min(first.lng, second.lng),
      maxLng: Math.max(first.lng, second.lng),
    }
  }

  function applyBboxSelection(bounds) {
    state.bboxSelectionBounds = bounds || null

    if (!bounds) {
      setBboxOutput('')
      setBboxSummary('未框选')
      hideBboxSelectionRect()
      syncBboxSelectionButtons()
      return
    }

    var bboxText = formatBboxBounds(bounds)
    setBboxOutput(bboxText)
    setBboxSummary(
      'SW(' + formatBboxNumber(bounds.minLat) + ', ' + formatBboxNumber(bounds.minLng) + ') | ' +
      'NE(' + formatBboxNumber(bounds.maxLat) + ', ' + formatBboxNumber(bounds.maxLng) + ')'
    )
    syncBboxSelectionRectFromBounds()
    syncBboxSelectionButtons()
  }

  function clearBboxSelection() {
    state.bboxSelectionDragging = false
    state.bboxSelectionStartPixel = null
    state.bboxSelectionCurrentPixel = null
    applyBboxSelection(null)
  }

  function setBboxSelectionActive(active) {
    state.bboxSelectionActive = Boolean(active)
    if (!state.bboxSelectionActive) {
      state.bboxSelectionDragging = false
      state.bboxSelectionStartPixel = null
      state.bboxSelectionCurrentPixel = null
    }
    syncBboxSelectionLayerState()
    if (!state.bboxSelectionActive && !state.bboxSelectionBounds) {
      hideBboxSelectionRect()
    }
    if (state.bboxSelectionActive) {
      setBboxSummary('拖拽地图上的矩形区域，松开后自动生成 BBOX')
    } else if (!state.bboxSelectionBounds) {
      setBboxSummary('未框选')
    }
    syncBboxSelectionButtons()
  }

  function toggleBboxSelection() {
    setBboxSelectionActive(!state.bboxSelectionActive)
  }

  function syncBboxSelectionRectFromBounds() {
    if (state.bboxSelectionDragging) {
      return
    }

    var bounds = state.bboxSelectionBounds
    if (!bounds) {
      hideBboxSelectionRect()
      return
    }

    var topLeft = latLngToContainerPixel(bounds.maxLat, bounds.minLng)
    var bottomRight = latLngToContainerPixel(bounds.minLat, bounds.maxLng)
    if (!topLeft || !bottomRight) {
      hideBboxSelectionRect()
      return
    }

    renderBboxSelectionRect(topLeft, bottomRight)
  }

  function onBboxSelectionPointerDown(event) {
    if (!state.bboxSelectionActive) {
      return
    }
    if (typeof event.button === 'number' && event.button !== 0) {
      return
    }

    var pixel = getBboxSelectionPointerPixel(event)
    if (!pixel) {
      return
    }

    state.bboxSelectionDragging = true
    state.bboxSelectionStartPixel = pixel
    state.bboxSelectionCurrentPixel = pixel
    renderBboxSelectionRect(pixel, pixel)
    if (state.bboxSelectionLayer && typeof state.bboxSelectionLayer.setPointerCapture === 'function') {
      try {
        state.bboxSelectionLayer.setPointerCapture(event.pointerId)
      } catch (e) {
        // ignore
      }
    }
    event.preventDefault()
  }

  function onBboxSelectionPointerMove(event) {
    if (!state.bboxSelectionActive || !state.bboxSelectionDragging) {
      return
    }

    var pixel = getBboxSelectionPointerPixel(event)
    if (!pixel) {
      return
    }

    state.bboxSelectionCurrentPixel = pixel
    renderBboxSelectionRect(state.bboxSelectionStartPixel, pixel)
    event.preventDefault()
  }

  function finishBboxSelection(event, canceled) {
    if (!state.bboxSelectionDragging) {
      return
    }

    var pixel = canceled ? state.bboxSelectionCurrentPixel : getBboxSelectionPointerPixel(event) || state.bboxSelectionCurrentPixel
    state.bboxSelectionDragging = false
    state.bboxSelectionCurrentPixel = pixel

    if (state.bboxSelectionLayer && event && typeof state.bboxSelectionLayer.releasePointerCapture === 'function') {
      try {
        state.bboxSelectionLayer.releasePointerCapture(event.pointerId)
      } catch (e) {
        // ignore
      }
    }

    var startPixel = state.bboxSelectionStartPixel
    state.bboxSelectionStartPixel = null

    if (!startPixel || !pixel) {
      hideBboxSelectionRect()
      setBboxSelectionActive(false)
      return
    }

    var width = Math.abs(pixel.x - startPixel.x)
    var height = Math.abs(pixel.y - startPixel.y)
    if (canceled || width < 4 || height < 4) {
      syncBboxSelectionRectFromBounds()
      setBboxSelectionActive(false)
      return
    }

    var bounds = buildBboxBoundsFromPixels(startPixel, pixel)
    applyBboxSelection(bounds)
    setBboxSelectionActive(false)
  }

  function onBboxSelectionPointerUp(event) {
    finishBboxSelection(event, false)
  }

  function onBboxSelectionPointerCancel(event) {
    finishBboxSelection(event, true)
  }

  async function copyBboxToClipboard() {
    var bboxText = $.bboxOutput && $.bboxOutput.value ? $.bboxOutput.value.trim() : ''
    if (!bboxText) {
      setBboxSummary('没有可复制的 BBOX，请先框选区域')
      return
    }

    if (navigator && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(bboxText)
    } else if ($.bboxOutput && typeof $.bboxOutput.select === 'function') {
      $.bboxOutput.focus()
      $.bboxOutput.select()
      document.execCommand('copy')
      $.bboxOutput.setSelectionRange(0, 0)
    } else {
      throw new Error('当前环境不支持剪贴板复制')
    }

    setBboxSummary('BBOX 已复制：' + bboxText)
  }

  function ensureProvinceMaskCanvas() {
    var mapContainer = getMapContainer()
    if (!mapContainer) {
      return null
    }

    if (!state.provinceMaskCanvas) {
      var canvas = document.createElement('canvas')
      canvas.className = 'province-mask-canvas'
      canvas.style.position = 'absolute'
      canvas.style.inset = '0'
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      canvas.style.pointerEvents = 'none'
      canvas.style.zIndex = '2'
      mapContainer.appendChild(canvas)
      state.provinceMaskCanvas = canvas
    }

    return state.provinceMaskCanvas
  }

  function removeProvinceMaskCanvas() {
    if (state.provinceMaskCanvas && state.provinceMaskCanvas.parentNode) {
      state.provinceMaskCanvas.parentNode.removeChild(state.provinceMaskCanvas)
    }
    state.provinceMaskCanvas = null
  }

  function resizeProvinceMaskCanvas(canvas) {
    var mapContainer = getMapContainer()
    if (!canvas || !mapContainer) {
      return null
    }

    var rect = mapContainer.getBoundingClientRect()
    var width = Math.max(1, Math.round(rect.width))
    var height = Math.max(1, Math.round(rect.height))
    var dpr = window.devicePixelRatio || 1

    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
    }

    return {
      width: width,
      height: height,
      dpr: dpr,
    }
  }

  function traceRingOnCanvas(ctx, ring) {
    if (!ctx || !Array.isArray(ring) || !ring.length) {
      return false
    }

    var moved = false
    for (var i = 0; i < ring.length; i += 1) {
      var point = ring[i]
      var lng = Number(point[0])
      var lat = Number(point[1])
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        continue
      }

      var pixel = latLngToContainerPixel(lat, lng)
      if (!pixel) {
        continue
      }

      if (!moved) {
        ctx.moveTo(pixel.x, pixel.y)
        moved = true
      } else {
        ctx.lineTo(pixel.x, pixel.y)
      }
    }

    if (moved) {
      ctx.closePath()
    }
    return moved
  }

  function drawProvinceMaskOverlay() {
    var province = state.activeProvince
    var canvas = ensureProvinceMaskCanvas()
    if (!province || !canvas) {
      return
    }

    var size = resizeProvinceMaskCanvas(canvas)
    var ctx = canvas.getContext('2d')
    if (!size || !ctx) {
      return
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.scale(size.dpr, size.dpr)

    ctx.fillStyle = 'rgba(15,23,42,0.68)'
    ctx.beginPath()
    ctx.rect(0, 0, size.width, size.height)
    for (var i = 0; i < province.shapes.length; i += 1) {
      var shape = province.shapes[i]
      if (!shape || !shape.outerRing) {
        continue
      }
      traceRingOnCanvas(ctx, shape.outerRing)
      if (Array.isArray(shape.innerRings)) {
        for (var j = 0; j < shape.innerRings.length; j += 1) {
          traceRingOnCanvas(ctx, shape.innerRings[j])
        }
      }
    }
    ctx.fill('evenodd')

    ctx.strokeStyle = 'rgba(15,98,254,0.98)'
    ctx.lineWidth = 2
    ctx.beginPath()
    for (var k = 0; k < province.shapes.length; k += 1) {
      traceRingOnCanvas(ctx, province.shapes[k].outerRing)
    }
    ctx.stroke()
  }

  function detachProvinceMaskListeners() {
    if (Array.isArray(state.provinceMaskListeners) && state.provinceMaskListeners.length && window.qq && window.qq.maps && window.qq.maps.event) {
      for (var i = 0; i < state.provinceMaskListeners.length; i += 1) {
        try {
          window.qq.maps.event.removeListener(state.provinceMaskListeners[i])
        } catch (e) {
          // ignore
        }
      }
    }
    state.provinceMaskListeners = []

    if (state.provinceMaskResizeHandler) {
      window.removeEventListener('resize', state.provinceMaskResizeHandler)
      state.provinceMaskResizeHandler = null
    }
  }

  function attachProvinceMaskListeners() {
    detachProvinceMaskListeners()

    if (!state.map || !window.qq || !window.qq.maps || !window.qq.maps.event || !state.activeProvince) {
      return
    }

    var scheduleDraw = function () {
      window.requestAnimationFrame(drawProvinceMaskOverlay)
    }

    state.provinceMaskListeners.push(window.qq.maps.event.addListener(state.map, 'bounds_changed', scheduleDraw))
    state.provinceMaskListeners.push(window.qq.maps.event.addListener(state.map, 'zoom_changed', scheduleDraw))
    state.provinceMaskListeners.push(window.qq.maps.event.addListener(state.map, 'center_changed', scheduleDraw))

    state.provinceMaskResizeHandler = scheduleDraw
    window.addEventListener('resize', state.provinceMaskResizeHandler)
  }

  function clearProvinceOverlays() {
    state.activeProvince = null
    detachProvinceMaskListeners()
    removeProvinceMaskCanvas()
  }

  function renderProvinceOverlay(province) {
    clearProvinceOverlays()

    if (!province || !province.shapes || !province.shapes.length) {
      throw new Error('省域数据不存在')
    }

    if (!state.map || !window.qq || !window.qq.maps) {
      throw new Error('qq.maps not available')
    }

    state.activeProvince = province
    ensureProvinceMaskCanvas()
    attachProvinceMaskListeners()
    drawProvinceMaskOverlay()
    fitToBounds(province.bounds)
  }

  function onApplyProvince() {
    var province = getSelectedProvince()
    if (!province) {
      clearProvinceOverlays()
      setProvinceSummary('请选择省份')
      return
    }

    if (!$.enableProvinceMask || !$.enableProvinceMask.checked) {
      clearProvinceOverlays()
      setProvinceSummary('已选择 ' + province.name + '，但未启用省域遮罩')
      return
    }

    try {
      renderProvinceOverlay(province)
      setProvinceSummary('已加载 ' + province.name + ' 省域遮罩')
    } catch (error) {
      setProvinceSummary('加载失败：' + ((error && error.message) || error))
    }
  }

  function onClearProvince() {
    clearProvinceOverlays()
    setProvinceSummary('未加载')
  }

  function formatArea(areaSqMeters) {
    var value = Number(areaSqMeters)
    if (!Number.isFinite(value)) {
      return '-'
    }
    if (value >= 1000000) {
      return (value / 1000000).toFixed(2) + ' km²'
    }
    if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'k m²'
    }
    return Math.round(value) + ' m²'
  }

  function formatPercent(base, next) {
    var oldValue = Number(base)
    var newValue = Number(next)
    if (!Number.isFinite(oldValue) || !Number.isFinite(newValue)) {
      return '-'
    }
    if (oldValue === 0) {
      return newValue === 0 ? '0%' : '新值基于 0 增长'
    }
    return (((newValue - oldValue) / oldValue) * 100).toFixed(2) + '%'
  }

  function formatCoverageChangeRate(base, next) {
    var oldValue = Number(base)
    var newValue = Number(next)
    if (!Number.isFinite(oldValue) || !Number.isFinite(newValue)) {
      return '-'
    }

    if (Math.max(oldValue, newValue) < MIN_MEANINGFUL_COVERAGE_PIXELS) {
      return '像素过少（少于 ' + MIN_MEANINGFUL_COVERAGE_PIXELS + '），不显示变化率'
    }

    return formatPercent(oldValue, newValue)
  }

  function pad2(value) {
    return String(value).padStart(2, '0')
  }

  function formatReportTimestamp(date) {
    var d = date instanceof Date ? date : new Date()
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' +
      pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds())
  }

  function formatReportFileName(date) {
    var d = date instanceof Date ? date : new Date()
    return 'offline-tile-report-' +
      d.getFullYear() +
      pad2(d.getMonth() + 1) +
      pad2(d.getDate()) + '-' +
      pad2(d.getHours()) +
      pad2(d.getMinutes()) +
      pad2(d.getSeconds()) + '.html'
  }

  function escapeHtml(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  function lonLatToWorldPixel(lng, lat, zoom, tileSize) {
    var size = Number(tileSize) || 256
    var sinLat = Math.sin((Math.max(-85.05112878, Math.min(85.05112878, Number(lat))) * Math.PI) / 180)
    var scale = Math.pow(2, Number(zoom)) * size
    return {
      x: ((Number(lng) + 180) / 360) * scale,
      y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale,
    }
  }

  function tileXYToLonLatBoundsLocal(x, y, z) {
    var n = Math.pow(2, z)
    var lngLeft = (x / n) * 360 - 180
    var lngRight = ((x + 1) / n) * 360 - 180
    var latTopRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)))
    var latBottomRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n)))
    return {
      minLng: lngLeft,
      maxLng: lngRight,
      minLat: (latBottomRad * 180) / Math.PI,
      maxLat: (latTopRad * 180) / Math.PI,
    }
  }

  function doBoundsIntersectRect(a, b) {
    if (!a || !b) {
      return false
    }

    return !(a.maxLng < b.minLng || a.minLng > b.maxLng || a.maxLat < b.minLat || a.minLat > b.maxLat)
  }

  function appendProvincePath(ctx, province, projector) {
    if (!ctx || !province || !Array.isArray(province.shapes)) {
      return
    }

    for (var i = 0; i < province.shapes.length; i += 1) {
      var shape = province.shapes[i]
      if (!shape || !shape.outerRing) {
        continue
      }
      traceProjectedRing(ctx, shape.outerRing, projector)
      if (Array.isArray(shape.innerRings)) {
        for (var j = 0; j < shape.innerRings.length; j += 1) {
          traceProjectedRing(ctx, shape.innerRings[j], projector)
        }
      }
    }
  }

  function traceProjectedRing(ctx, ring, projector) {
    if (!ctx || !Array.isArray(ring) || !ring.length || typeof projector !== 'function') {
      return false
    }

    var moved = false
    for (var i = 0; i < ring.length; i += 1) {
      var point = ring[i]
      var lng = Number(point[0])
      var lat = Number(point[1])
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        continue
      }

      var pixel = projector(lng, lat)
      if (!pixel) {
        continue
      }

      if (!moved) {
        ctx.moveTo(pixel.x, pixel.y)
        moved = true
      } else {
        ctx.lineTo(pixel.x, pixel.y)
      }
    }

    if (moved) {
      ctx.closePath()
    }
    return moved
  }

  function worldPixelToLonLatLocal(worldX, worldY, zoom, tileSize) {
    var scale = Math.pow(2, Number(zoom)) * (Number(tileSize) || 256)
    var lng = (Number(worldX) / scale) * 360 - 180
    var latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * Number(worldY)) / scale)))
    return {
      lng: lng,
      lat: (latRad * 180) / Math.PI,
    }
  }

  function buildProvinceSnapshotViewport(province, preferredZoom) {
    var tileSize = 256
    var requestWidth = 900
    var requestHeight = 560
    var requestScale = 2
    var padding = 16
    var bounds = province && province.bounds
    if (!province || !bounds) {
      throw new Error('缺少省域范围')
    }

    var displayZoom = Math.round(Number(preferredZoom))
    if (!Number.isFinite(displayZoom)) {
      displayZoom = DEFAULT_ZOOM
    }

    for (var z = displayZoom; z >= 1; z -= 1) {
      var topLeftAtZ = lonLatToWorldPixel(bounds.minLng, bounds.maxLat, z, tileSize)
      var bottomRightAtZ = lonLatToWorldPixel(bounds.maxLng, bounds.minLat, z, tileSize)
      var worldWidthAtZ = Math.max(1, bottomRightAtZ.x - topLeftAtZ.x)
      var worldHeightAtZ = Math.max(1, bottomRightAtZ.y - topLeftAtZ.y)
      if (worldWidthAtZ <= requestWidth - padding * 2 && worldHeightAtZ <= requestHeight - padding * 2) {
        displayZoom = z
        break
      }
      if (z === 1) {
        displayZoom = 1
      }
    }

    var topLeft = lonLatToWorldPixel(bounds.minLng, bounds.maxLat, displayZoom, tileSize)
    var bottomRight = lonLatToWorldPixel(bounds.maxLng, bounds.minLat, displayZoom, tileSize)
    var centerWorldX = (topLeft.x + bottomRight.x) / 2
    var centerWorldY = (topLeft.y + bottomRight.y) / 2
    var center = worldPixelToLonLatLocal(centerWorldX, centerWorldY, displayZoom, tileSize)

    return {
      bounds: bounds,
      tileSize: tileSize,
      displayZoom: displayZoom,
      requestWidth: requestWidth,
      requestHeight: requestHeight,
      requestScale: requestScale,
      outputWidth: requestWidth * requestScale,
      outputHeight: requestHeight * requestScale,
      viewportLeft: centerWorldX - requestWidth / 2,
      viewportTop: centerWorldY - requestHeight / 2,
      center: center,
    }
  }

  function buildTencentStaticMapUrl(viewport) {
    var query = [
      'center=' + encodeURIComponent(viewport.center.lat + ',' + viewport.center.lng),
      'zoom=' + encodeURIComponent(String(viewport.displayZoom)),
      'size=' + encodeURIComponent(viewport.requestWidth + '*' + viewport.requestHeight),
      'scale=' + encodeURIComponent(String(viewport.requestScale)),
      'maptype=roadmap',
      'key=' + encodeURIComponent(QQMAP_SUGGEST_KEY),
    ]
    return 'https://apis.map.qq.com/ws/staticmap/v2/?' + query.join('&')
  }

  async function renderProvinceSnapshot(pack, province, viewport) {
    var tileSize = viewport && viewport.tileSize ? viewport.tileSize : 256
    var bounds = province && province.bounds
    var zoom = viewport && viewport.displayZoom
    var outputWidth = viewport && viewport.outputWidth
    var outputHeight = viewport && viewport.outputHeight
    var requestScale = viewport && viewport.requestScale
    var viewportLeft = viewport && viewport.viewportLeft
    var viewportTop = viewport && viewport.viewportTop
    if (!pack || !province || !bounds || !viewport) {
      throw new Error('缺少生成快照所需参数')
    }

    var canvas = document.createElement('canvas')
    canvas.width = outputWidth
    canvas.height = outputHeight
    var ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('无法创建快照画布')
    }
    ctx.imageSmoothingEnabled = true

    var projector = function (lng, lat) {
      var point = lonLatToWorldPixel(lng, lat, zoom, tileSize)
      return {
        x: (point.x - viewportLeft) * requestScale,
        y: (point.y - viewportTop) * requestScale,
      }
    }

    ctx.beginPath()
    ctx.rect(0, 0, outputWidth, outputHeight)
    appendProvincePath(ctx, province, projector)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.56)'
    ctx.fill('evenodd')

    ctx.save()
    ctx.beginPath()
    appendProvincePath(ctx, province, projector)
    ctx.clip('evenodd')

    var entries = pack.getTileEntriesForZoom(zoom)
    var tileCanvas = document.createElement('canvas')
    var tileCtx = tileCanvas.getContext('2d')
    for (var i = 0; i < entries.length; i += 1) {
      var entry = entries[i]
      var tileBounds = tileXYToLonLatBoundsLocal(entry.x, entry.y, zoom)
      if (!doBoundsIntersectRect(tileBounds, bounds)) {
        continue
      }

      var imageData = await pack.getTileImageData(zoom, entry.x, entry.y)
      if (!imageData || !imageData.data) {
        continue
      }

      tileCanvas.width = imageData.width || tileSize
      tileCanvas.height = imageData.height || tileSize
      tileCtx.clearRect(0, 0, tileCanvas.width, tileCanvas.height)
      tileCtx.putImageData(imageData, 0, 0)

      var dx = (entry.x * tileSize - viewportLeft) * requestScale
      var dy = (entry.y * tileSize - viewportTop) * requestScale
      ctx.drawImage(tileCanvas, dx, dy, tileCanvas.width * requestScale, tileCanvas.height * requestScale)
    }
    ctx.restore()

    ctx.beginPath()
    appendProvincePath(ctx, province, projector)
    ctx.lineWidth = 3
    ctx.strokeStyle = '#0f62fe'
    ctx.stroke()

    return canvas.toDataURL('image/png')
  }

  function buildProvinceReportHtml(records, meta) {
    var totalOld = 0
    var totalNew = 0
    var totalAdded = 0
    var totalRemoved = 0
    var totalShared = 0

    for (var i = 0; i < records.length; i += 1) {
      totalOld += records[i].result.oldPixels
      totalNew += records[i].result.newPixels
      totalAdded += records[i].result.addedPixels
      totalRemoved += records[i].result.removedPixels
      totalShared += records[i].result.sharedPixels
    }

    var cards = records.map(function (record, index) {
      var result = record.result
      return [
        '<section class="card">',
        '<div class="card-header">',
        '<div>',
        '<h2>' + (index + 1) + '. ' + escapeHtml(record.province.name) + '</h2>',
        '<p>' + escapeHtml(record.province.id) + '</p>',
        '</div>',
        '<div class="rate">' + escapeHtml(record.changeRateText) + '</div>',
        '</div>',
        '<div class="metrics">',
        '<div><span>旧版适飞像素</span><strong>' + escapeHtml(result.oldPixels) + '</strong></div>',
        '<div><span>新版适飞像素</span><strong>' + escapeHtml(result.newPixels) + '</strong></div>',
        '<div><span>新增适飞像素</span><strong>' + escapeHtml(result.addedPixels) + '</strong></div>',
        '<div><span>减少适飞像素</span><strong>' + escapeHtml(result.removedPixels) + '</strong></div>',
        '<div><span>重合适飞像素</span><strong>' + escapeHtml(result.sharedPixels) + '</strong></div>',
        '<div><span>旧版近似面积</span><strong>' + escapeHtml(formatArea(result.approxArea.oldSqMeters)) + '</strong></div>',
        '<div><span>新版近似面积</span><strong>' + escapeHtml(formatArea(result.approxArea.newSqMeters)) + '</strong></div>',
        '<div><span>新增近似面积</span><strong>' + escapeHtml(formatArea(result.approxArea.addedSqMeters)) + '</strong></div>',
        '</div>',
        '<div class="shots">',
        '<figure><div class="map-shot"><img class="map-base" src="' + record.baseMapUrl + '" alt="' + escapeHtml(record.province.name) + ' 旧版腾讯底图" /><img class="map-overlay" src="' + record.oldSnapshotUrl + '" alt="' + escapeHtml(record.province.name) + ' 旧版适飞区叠加图" /></div><figcaption>旧版适飞区快照</figcaption></figure>',
        '<figure><div class="map-shot"><img class="map-base" src="' + record.baseMapUrl + '" alt="' + escapeHtml(record.province.name) + ' 新版腾讯底图" /><img class="map-overlay" src="' + record.newSnapshotUrl + '" alt="' + escapeHtml(record.province.name) + ' 新版适飞区叠加图" /></div><figcaption>新版适飞区快照</figcaption></figure>',
        '</div>',
        '</section>',
      ].join('')
    }).join('')

    return [
      '<!doctype html>',
      '<html lang="zh-CN">',
      '<head>',
      '<meta charset="UTF-8" />',
      '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
      '<title>适飞区变化率评估报告</title>',
      '<style>',
      'body{margin:0;font-family:"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;background:#edf2f7;color:#0f172a;}',
      '.page{max-width:1600px;margin:0 auto;padding:32px 20px 48px;}',
      '.hero{background:linear-gradient(135deg,#0f172a,#1d4ed8);color:#fff;border-radius:24px;padding:28px 32px;box-shadow:0 20px 45px rgba(15,23,42,.18);}',
      '.hero h1{margin:0 0 10px;font-size:28px;}',
      '.hero p{margin:4px 0;font-size:14px;opacity:.92;}',
      '.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:20px 0 24px;}',
      '.summary .item{background:#fff;border:1px solid #dbe4ef;border-radius:18px;padding:16px;box-shadow:0 10px 24px rgba(15,23,42,.05);}',
      '.summary span{display:block;font-size:12px;color:#64748b;margin-bottom:8px;}',
      '.summary strong{font-size:22px;}',
      '.note{margin:0 0 24px;font-size:13px;color:#475569;}',
      '.card{background:#fff;border:1px solid #dbe4ef;border-radius:22px;padding:24px;margin-bottom:24px;box-shadow:0 12px 28px rgba(15,23,42,.06);min-height:calc(100vh - 88px);display:grid;grid-template-rows:auto auto 1fr;page-break-after:always;}',
      '.card-header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:14px;}',
      '.card-header h2{margin:0 0 6px;font-size:22px;}',
      '.card-header p{margin:0;font-size:13px;color:#64748b;}',
      '.rate{padding:10px 14px;border-radius:999px;background:#eef4ff;color:#0f62fe;font-weight:700;font-size:13px;white-space:nowrap;}',
      '.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:18px;}',
      '.metrics div{padding:12px 14px;border-radius:16px;background:#f8fbff;border:1px solid #dbe7ff;}',
      '.metrics span{display:block;font-size:12px;color:#64748b;margin-bottom:6px;}',
      '.metrics strong{font-size:16px;color:#0f172a;}',
      '.shots{display:grid;grid-template-columns:1fr;gap:18px;align-items:stretch;}',
      '.shots figure{margin:0;padding:12px;border:1px solid #dbe4ef;border-radius:18px;background:#f8fbff;display:flex;flex-direction:column;min-height:100%;}',
      '.map-shot{position:relative;width:100%;aspect-ratio:1800 / 1120;min-height:460px;border-radius:12px;overflow:hidden;background:#d7dfeb;}',
      '.map-base,.map-overlay{position:absolute;inset:0;display:block;width:100%;height:100%;}',
      '.map-base{object-fit:fill;background:#d7dfeb;}',
      '.map-overlay{object-fit:fill;background:transparent;}',
      '.shots figcaption{margin-top:10px;font-size:13px;color:#475569;text-align:center;font-weight:600;}',
      '@media (max-width:720px){.page{padding:18px 12px 32px;}.hero{padding:20px 18px;}.card{min-height:auto;padding:18px;}.card-header{flex-direction:column;}.rate{white-space:normal;}.map-shot{min-height:300px;}}',
      '@media print{body{background:#fff;}.page{max-width:none;padding:0;}.hero{box-shadow:none;}.summary .item,.card{box-shadow:none;}.card{min-height:100vh;border-radius:0;margin:0;break-after:page;page-break-after:always;}.card:last-of-type{break-after:auto;page-break-after:auto;}}',
      '</style>',
      '</head>',
      '<body>',
      '<main class="page">',
      '<section class="hero">',
      '<h1>适飞区变化率评估报告</h1>',
      '<p>生成时间：' + escapeHtml(meta.generatedAt) + '</p>',
      '<p>评估缩放：Z' + escapeHtml(meta.zoom) + '</p>',
      '<p>省份数量：' + escapeHtml(meta.provinceCount) + '</p>',
      '</section>',
      '<section class="summary">',
      '<div class="item"><span>旧版适飞像素总量</span><strong>' + escapeHtml(totalOld) + '</strong></div>',
      '<div class="item"><span>新版适飞像素总量</span><strong>' + escapeHtml(totalNew) + '</strong></div>',
      '<div class="item"><span>新增适飞像素总量</span><strong>' + escapeHtml(totalAdded) + '</strong></div>',
      '<div class="item"><span>减少适飞像素总量</span><strong>' + escapeHtml(totalRemoved) + '</strong></div>',
      '<div class="item"><span>重合适飞像素总量</span><strong>' + escapeHtml(totalShared) + '</strong></div>',
      '<div class="item"><span>总变化率</span><strong>' + escapeHtml(formatCoverageChangeRate(totalOld, totalNew)) + '</strong></div>',
      '</section>',
      '<p class="note">说明：有像素即视为适飞区。面积按当前缩放级别的像素分辨率近似换算；当新旧像素量都小于 ' + escapeHtml(MIN_MEANINGFUL_COVERAGE_PIXELS) + ' 时，不显示变化率。</p>',
      cards,
      '</main>',
      '</body>',
      '</html>',
    ].join('')
  }

  function downloadHtmlReport(html, fileName) {
    var blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    var objectUrl = URL.createObjectURL(blob)
    var anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    window.setTimeout(function () {
      URL.revokeObjectURL(objectUrl)
    }, 1000)
  }

  async function onGenerateProvinceReport() {
    var oldPack = getPack('old')
    var newPack = getPack('new')
    var zoom = Math.min(MAX_PROVINCE_EVALUATION_ZOOM, Number($.compareZoom && $.compareZoom.value))
    var provinces = getSelectedReportProvinces()
    if (!provinces.length) {
      var currentProvince = getSelectedProvince()
      if (currentProvince) {
        provinces = [currentProvince]
      }
    }

    if (!oldPack || !newPack) {
      setReportStatus('生成失败：需要同时加载旧版 zip 和新版目录。')
      return
    }
    if (!Number.isFinite(zoom)) {
      setReportStatus('生成失败：当前没有可用的共同缩放级别。')
      return
    }
    if (!provinces.length) {
      setReportStatus('生成失败：请先选择至少一个报告省份。')
      return
    }

    if ($.generateReportBtn) {
      $.generateReportBtn.disabled = true
    }

    try {
      var generatedAt = new Date()
      var records = []
      for (var i = 0; i < provinces.length; i += 1) {
        var province = provinces[i]
        setReportStatus('正在生成报告：' + (i + 1) + '/' + provinces.length + ' ' + province.name + '，计算变化率...')

        var result = await oldPack.compareColoredRegion(newPack, {
          zoom: zoom,
          regionShapes: province.shapes,
          regionBounds: province.bounds,
          alphaThreshold: 16,
          selectMode: 'colored',
        })

        setReportStatus('正在生成报告：' + (i + 1) + '/' + provinces.length + ' ' + province.name + '，生成旧版快照...')
        var viewport = buildProvinceSnapshotViewport(province, zoom)
        var baseMapUrl = buildTencentStaticMapUrl(viewport)
        var oldSnapshotUrl = await renderProvinceSnapshot(oldPack, province, viewport)

        setReportStatus('正在生成报告：' + (i + 1) + '/' + provinces.length + ' ' + province.name + '，生成新版快照...')
        var newSnapshotUrl = await renderProvinceSnapshot(newPack, province, viewport)

        records.push({
          province: province,
          result: result,
          changeRateText: formatCoverageChangeRate(result.oldPixels, result.newPixels),
          baseMapUrl: baseMapUrl,
          oldSnapshotUrl: oldSnapshotUrl,
          newSnapshotUrl: newSnapshotUrl,
        })
      }

      var html = buildProvinceReportHtml(records, {
        zoom: zoom,
        generatedAt: formatReportTimestamp(generatedAt),
        provinceCount: records.length,
      })
      var fileName = formatReportFileName(generatedAt)
      downloadHtmlReport(html, fileName)
      setReportStatus('报告已生成：' + fileName)
    } catch (error) {
      setReportStatus('生成失败：' + ((error && error.message) || error))
    } finally {
      if ($.generateReportBtn) {
        $.generateReportBtn.disabled = false
      }
    }
  }

  async function onEvaluateProvince() {
    var oldPack = getPack('old')
    var newPack = getPack('new')
    var province = getSelectedProvince()
    var zoom = Math.min(MAX_PROVINCE_EVALUATION_ZOOM, Number($.compareZoom && $.compareZoom.value))

    if (!oldPack || !newPack) {
      setCompareResult('评估失败：需要同时加载旧版 zip 和新版目录。')
      return
    }
    if (!province) {
      setCompareResult('评估失败：请先选择省份。')
      return
    }
    if (!Number.isFinite(zoom)) {
      setCompareResult('评估失败：当前没有可用的共同缩放级别。')
      return
    }

    setCompareResult('正在评估 ' + province.name + ' 省内适飞区增减...')

    try {
      var result = await oldPack.compareColoredRegion(newPack, {
        zoom: zoom,
        regionShapes: province.shapes,
        regionBounds: province.bounds,
        alphaThreshold: 16,
        selectMode: 'colored',
        onProgress: function (payload) {
          var progress = payload && payload.progress
          if (!progress) {
            return
          }
          setCompareResult(
            '正在评估 ' + province.name + '（Z' + zoom + '）\n' +
            '阶段：' + (payload.stage === 'old' ? '旧版' : '新版') + '\n' +
            '进度：' + progress.tileDone + '/' + progress.tileTotal + ' 张瓦片\n' +
            '命中省域瓦片：' + progress.matchedTiles + '\n' +
            '已识别适飞像素：' + progress.selectedPixels
          )
        },
      })

      var deltaText =
        province.name + ' | Z' + zoom + '\n' +
        '旧版适飞区：' + result.oldPixels + ' 像素，约 ' + formatArea(result.approxArea.oldSqMeters) + '\n' +
        '新版适飞区：' + result.newPixels + ' 像素，约 ' + formatArea(result.approxArea.newSqMeters) + '\n' +
        '新增适飞：' + result.addedPixels + ' 像素，约 ' + formatArea(result.approxArea.addedSqMeters) + '\n' +
        '减少适飞：' + result.removedPixels + ' 像素，约 ' + formatArea(result.approxArea.removedSqMeters) + '\n' +
        '重合适飞：' + result.sharedPixels + ' 像素，约 ' + formatArea(result.approxArea.sharedSqMeters) + '\n' +
        '适飞区变化率：' + formatCoverageChangeRate(result.oldPixels, result.newPixels) + '\n' +
        '说明：有像素即视为适飞区，面积按当前缩放级别的像素分辨率近似换算；当新旧像素量都小于 ' + MIN_MEANINGFUL_COVERAGE_PIXELS + ' 时，不显示变化率。'

      setCompareResult(deltaText)
    } catch (error) {
      setCompareResult('评估失败：' + ((error && error.message) || error))
    }
  }

  function bindEvents() {
    $.loadPacksBtn.addEventListener('click', function () {
      onLoadPacks().catch(function (error) {
        setCompareResult('加载失败：' + ((error && error.message) || error))
      })
    })
    $.clearPacksBtn.addEventListener('click', onClearPacks)
    $.showOldBtn.addEventListener('click', function () {
      setActivePack('old')
    })
    $.showNewBtn.addEventListener('click', function () {
      setActivePack('new')
    })
    $.applyProvinceBtn.addEventListener('click', onApplyProvince)
    $.clearProvinceBtn.addEventListener('click', onClearProvince)
    $.evaluateBtn.addEventListener('click', function () {
      onEvaluateProvince().catch(function (error) {
        setCompareResult('评估失败：' + ((error && error.message) || error))
      })
    })
    if ($.selectAllReportProvincesBtn) {
      $.selectAllReportProvincesBtn.addEventListener('click', selectAllReportProvinces)
    }
    if ($.clearReportProvincesBtn) {
      $.clearReportProvincesBtn.addEventListener('click', clearReportProvinceSelection)
    }
    if ($.generateReportBtn) {
      $.generateReportBtn.addEventListener('click', function () {
        onGenerateProvinceReport().catch(function (error) {
          setReportStatus('生成失败：' + ((error && error.message) || error))
        })
      })
    }

    if ($.enableProvinceMask) {
      $.enableProvinceMask.addEventListener('change', function () {
        if ($.enableProvinceMask.checked) {
          onApplyProvince()
        } else {
          clearProvinceOverlays()
          var province = getSelectedProvince()
          setProvinceSummary(province ? ('已选择 ' + province.name + '，但未启用省域遮罩') : '未加载')
        }
      })
    }

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

    if ($.startBboxSelectBtn) {
      $.startBboxSelectBtn.addEventListener('click', toggleBboxSelection)
    }
    if ($.clearBboxSelectionBtn) {
      $.clearBboxSelectionBtn.addEventListener('click', function () {
        setBboxSelectionActive(false)
        clearBboxSelection()
      })
    }
    if ($.copyBboxBtn) {
      $.copyBboxBtn.addEventListener('click', function () {
        copyBboxToClipboard().catch(function (error) {
          setBboxSummary('复制失败：' + ((error && error.message) || error))
        })
      })
    }

    if ($.exportUomBtn) {
      $.exportUomBtn.addEventListener('click', function () {
        onExportCurrentZoom().catch(function (error) {
          setClickResult('导出失败：' + ((error && error.message) || error))
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
    ensureBboxSelectionLayer()
    state.provinceCatalog = buildProvinceCatalog()
    populateProvinceSelect()
    populateReportProvinceSelect()
    bindEvents()

    setPackSummary('old', '未加载')
    setPackSummary('new', '未加载')
    $.activeLayerSummary.textContent = '未显示'
    setProvinceSummary('未加载')
    setClickResult('未加载')
    setSearchSummary('未搜索')
    setReportStatus('未生成')
    renderSearchResultsEmpty('输入关键词后可搜索地点并定位')
    setCompareResult('加载旧版 zip、新版目录并应用省域后，可评估省内适飞区增减。')
    setBboxOutput('')
    setBboxSummary('未框选')
    syncCompareZoomOptions()
    updateLayerToggleButtons()
    syncBboxSelectionButtons()
  }

  bootstrap()
})()
