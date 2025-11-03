<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { EditOutlined, DeleteOutlined, EnvironmentOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { useI18n } from 'vue-i18n'
import { MARKER_REVIEW_STATUS, fetchMarkers } from '../../services/markers'
import {
  createNoFlyZone,
  deleteNoFlyZone,
  listNoFlyZones,
  updateNoFlyZone,
} from '../../services/noFlyZones'

const TENCENT_MAP_KEY = 'GEDBZ-R36KT-S52XJ-LTI4K-WWZK7-USFNP'
const QQMAP_SCRIPT_ID = 'qqmaps-2d-script'
const MAP_DEFAULT_CENTER = { latitude: 26.074508, longitude: 119.296494 }
const MAP_DEFAULT_ZOOM = 11
const POLYGON_MIN_POINTS = 3
const CIRCLE_MIN_RADIUS = 50

const { t } = useI18n()

const mapContainer = ref(null)
const mapInstance = ref(null)
const drawingPolyline = ref(null)
const drawingPolygon = ref(null)
const drawingCircle = ref(null)
const drawingMarkerLayer = ref(null)
// 2D API additional refs
const qqListeners = ref([]) // qq.maps.event listener tokens
const searchMarker = ref(null) // qq.maps.Marker
const zonePolygonOverlays = ref([]) // qq.maps.Polygon[]
const zoneCircleOverlays = ref([]) // qq.maps.Circle[]
const zonePolylineOverlays = ref([]) // qq.maps.Polyline[]
const merchantMarkers = ref([]) // qq.maps.Marker[]
// kept for backward compatibility (GL path, no longer used after 2D switch)
const merchantMarkerLayer = ref(null)
const zonePolygonLayer = ref(null)
const zoneCircleLayer = ref(null)
const zonePolylineLayer = ref(null)
const currentDrawingMode = ref('POLYGON')
const isDrawing = ref(false)
const drawingPoints = ref([])
const drawingStartPoint = ref(null)
const drawingCenter = ref(null)
const drawingRadius = ref(500)
const mapClickHandler = ref(null)
const mapMouseMoveHandler = ref(null)
const mapMouseUpHandler = ref(null)
const mapDblClickHandler = ref(null)
const searchMarkerLayer = ref(null)
const searchQuery = ref('')
const searchLoading = ref(false)

const zoneList = ref([])
const listLoading = ref(false)
const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
})

const formState = reactive({
  id: null,
  name: '',
  type: 'POLYGON',
  wechatLink: '',
  timeRange: [],
  coordinates: [],
  circle: null,
})

const formSubmitting = ref(false)

const typeOptions = computed(() => [
  { label: t('noFlyZone.types.polygon'), value: 'POLYGON' },
  { label: t('noFlyZone.types.polyline'), value: 'POLYLINE' },
  { label: t('noFlyZone.types.rectangle'), value: 'RECTANGLE' },
  { label: t('noFlyZone.types.circle'), value: 'CIRCLE' },
])

const mapReady = computed(() => !!mapInstance.value)

const hasDrawnGeometry = computed(() => {
  if (formState.type === 'CIRCLE') {
    return !!formState.circle
  }
  if (!Array.isArray(formState.coordinates)) {
    return false
  }
  if (formState.type === 'POLYLINE') {
    return formState.coordinates.length >= 2
  }
  if (formState.type === 'RECTANGLE') {
    return formState.coordinates.length >= 4
  }
  return formState.coordinates.length >= POLYGON_MIN_POINTS
})

const isCircleMode = computed(() => formState.type === 'CIRCLE')

const drawButtonDisabled = computed(() => !mapReady.value || isDrawing.value)

const disableFormDuringDrawing = computed(() => isDrawing.value)

const canSearch = computed(
  () =>
    !searchLoading.value &&
    typeof searchQuery.value === 'string' &&
    searchQuery.value.trim().length > 0,
)

const disableSubmit = computed(() => !hasDrawnGeometry.value || !formState.name.trim() || !formState.wechatLink.trim())

const highlightStyle = {
  polygon: {
    fillColor: 'rgba(255, 77, 79, 0.25)',
    strokeColor: '#ff4d4f',
    strokeWidth: 2,
  },
  circle: {
    fillColor: 'rgba(255, 77, 79, 0.25)',
    strokeColor: '#ff4d4f',
    strokeWidth: 2,
  },
  polyline: {
    color: '#ff4d4f',
    width: 2,
  },
  dashed: {
    color: '#ff4d4f',
    width: 2,
    dashArray: [10, 6],
  },
}

// Helper: convert css color + alpha to qq.maps.Color when available
const normalizeHex = (h) => {
  const s = String(h || '').trim()
  if (!s) return '#000000'
  return s.startsWith('#') ? s : `#${s}`
}

const toRgb = (color) => {
  if (!color) return { r: 255, g: 0, b: 0 }
  const s = String(color).trim()
  const m = s.match(/^rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
  if (m) {
    const r = Math.max(0, Math.min(255, parseInt(m[1], 10) || 0))
    const g = Math.max(0, Math.min(255, parseInt(m[2], 10) || 0))
    const b = Math.max(0, Math.min(255, parseInt(m[3], 10) || 0))
    return { r, g, b }
  }
  const hex = normalizeHex(s).replace('#', '')
  const r = Math.max(0, Math.min(255, parseInt(hex.slice(0, 2), 16) || 0))
  const g = Math.max(0, Math.min(255, parseInt(hex.slice(2, 4), 16) || 0))
  const b = Math.max(0, Math.min(255, parseInt(hex.slice(4, 6), 16) || 0))
  return { r, g, b }
}

const toQqColor = (color, alpha = 1) => {
  try {
    if (window.qq && window.qq.maps && typeof window.qq.maps.Color === 'function') {
      const { r, g, b } = toRgb(color)
      return new window.qq.maps.Color(r, g, b, alpha)
    }
  } catch (_) {}
  return normalizeHex(color)
}

const formatCoordinatePoint = (point) => {
  if (!point) return null
  if (typeof point.getLat === 'function' && typeof point.getLng === 'function') {
    return { latitude: point.getLat(), longitude: point.getLng() }
  }
  const latitude = Number(point.latitude ?? point.lat)
  const longitude = Number(point.longitude ?? point.lng)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null
  }
  return { latitude, longitude }
}

const formatCoordinateValue = (value) =>
  Number.isFinite(value) ? Number(value).toFixed(6) : '-'

const coordinateColumns = computed(() => [
  {
    title: t('noFlyZone.form.coordinateLabel'),
    dataIndex: 'label',
    key: 'label',
    width: 140,
  },
  {
    title: t('noFlyZone.form.latitude'),
    dataIndex: 'latitude',
    key: 'latitude',
  },
  {
    title: t('noFlyZone.form.longitude'),
    dataIndex: 'longitude',
    key: 'longitude',
  },
])

const displayedCoordinates = computed(() => {
  if (formState.type === 'CIRCLE') {
    const centerSource =
      formState.circle ??
      (drawingCenter.value
        ? { latitude: drawingCenter.value.getLat(), longitude: drawingCenter.value.getLng() }
        : null)
    const center = formatCoordinatePoint(centerSource)
    if (!center) return []
    return [
      {
        key: 'center',
        label: t('noFlyZone.form.circleCenter'),
        latitude: formatCoordinateValue(center.latitude),
        longitude: formatCoordinateValue(center.longitude),
      },
    ]
  }

  const sourcePoints =
    isDrawing.value && drawingPoints.value.length
      ? drawingPoints.value
      : formState.coordinates ?? []

  if (!Array.isArray(sourcePoints)) {
    return []
  }

  return sourcePoints
    .map((point, index) => {
      const coordinate = formatCoordinatePoint(point)
      if (!coordinate) return null
      return {
        key: `${index}`,
        label: t('noFlyZone.form.vertexLabel', { index: index + 1 }),
        latitude: formatCoordinateValue(coordinate.latitude),
        longitude: formatCoordinateValue(coordinate.longitude),
      }
    })
    .filter((item) => item !== null)
})

const displayedCircleRadius = computed(() => {
  if (formState.type !== 'CIRCLE') return null
  if (formState.circle?.radiusMeters) {
    return Math.round(formState.circle.radiusMeters)
  }
  if (drawingCenter.value && drawingRadius.value) {
    return Math.round(drawingRadius.value)
  }
  return null
})

const createSvgDataUrl = (svg) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`

const DRAW_VERTEX_ICON = createSvgDataUrl(
  "<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'><circle cx='8' cy='8' r='5' fill='%23ff4d4f' stroke='%23ffffff' stroke-width='2'/></svg>",
)

const SEARCH_MARKER_ICON = createSvgDataUrl(
  "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='32' viewBox='0 0 24 32'><path d='M12 0C5.372 0 0 5.372 0 12c0 8.25 10.218 18.922 10.651 19.357a1.88 1.88 0 0 0 2.698 0C13.782 30.922 24 20.25 24 12 24 5.372 18.628 0 12 0zm0 17.5a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z' fill='%23256BEB'/></svg>",
)

let tmapReloadedOnce = false

const patchTMapEnvForCompatibility = () => {
  // 预创建 TMap 命名空间，并准备 SDK 可能依赖的占位对象
  window.TMap = window.TMap || {}
  try {
    // SDK 的鉴权 JSONP 会写入 TMap._svcb.cb<rand>
    window.TMap._svcb = window.TMap._svcb || {}
  } catch (_) {}
  // 标记：即便 window.TMap 存在，也要继续加载脚本
  try {
    window.TMap.__forceReload = true
  } catch (_) {}
  // 开启 lite 模式（SDK 内部会读取该标志以走兼容路径）
  try {
    window.TMap._isLiteMode = true
  } catch (_) {}
  // 在部分内核上禁用 OffscreenCanvas（保留 Worker 不动，避免 “Worker is not a constructor”）
  try {
    if (typeof window.OffscreenCanvas !== 'undefined') {
      try {
        Object.defineProperty(window, 'OffscreenCanvas', { configurable: true, writable: true, value: undefined })
      } catch (_) {
        try {
          window.OffscreenCanvas = undefined
        } catch (_) {}
      }
    }
  } catch (_) {}
}

const removeTencentMapScript = () => {
  try {
    const old = document.getElementById(TMAP_SCRIPT_ID)
    if (old && old.parentNode) old.parentNode.removeChild(old)
  } catch (_) {}
  // 不要把 window.TMap 置为 undefined，避免 JSONP 回调找不到命名空间
  try {
    window.TMap = window.TMap || {}
    window.TMap._svcb = window.TMap._svcb || {}
    window.TMap.__forceReload = true
  } catch (_) {}
}

const loadTencentMapScript = () => {
  const shouldEnableLiteMode = () => {
    try {
      const ua = navigator.userAgent || ''
      const isWeChat = /MicroMessenger/i.test(ua)
      const isWxWork = /wxwork|WeCom/i.test(ua)
      const isQQ = /QQ\//i.test(ua)
      const isIOS = /iPhone|iPad|iPod/i.test(ua)
      const noOffscreenCanvas = typeof window.OffscreenCanvas === 'undefined'
      const notIsolated = !('crossOriginIsolated' in window) || !window.crossOriginIsolated
      return isWeChat || isWxWork || isQQ || isIOS || noOffscreenCanvas || notIsolated
    } catch (_) {
      return true
    }
  }

  // If SDK 已加载且无需强制重载，直接返回
  if (window.TMap && !window.TMap.__forceReload) return Promise.resolve(window.TMap)

  // 如果已有 script 节点但还未就绪，确保在脚本真正执行前设置 lite 模式标志
  if (document.getElementById(TMAP_SCRIPT_ID)) {
    if (shouldEnableLiteMode()) {
      patchTMapEnvForCompatibility()
    } else {
      window.TMap = window.TMap || {}
    }
    return new Promise((resolve, reject) => {
      const checkReady = () => {
        if (window.TMap) {
          resolve(window.TMap)
        } else {
          requestAnimationFrame(checkReady)
        }
      }
      checkReady()
      setTimeout(() => {
        if (!window.TMap) {
          reject(new Error('Tencent Map script failed to load'))
        }
      }, 15000)
    })
  }

  // 首次加载脚本：在插入脚本前开启 lite 模式开关，规避某些内核 Web Worker DataCloneError
  return new Promise((resolve, reject) => {
    try {
      if (shouldEnableLiteMode()) {
        patchTMapEnvForCompatibility()
      } else {
        window.TMap = window.TMap || {}
      }
    } catch (_) {
      // 忽略环境判断异常
    }

    const script = document.createElement('script')
    script.id = TMAP_SCRIPT_ID
    const callbackName = '__tmap_init_callback__'
    // 移除 id=city 参数，减少初始化阶段的额外数据传输
    script.src = `https://map.qq.com/api/gljs?v=1.exp&libraries=tools,geometry&key=${TENCENT_MAP_KEY}&callback=${callbackName}`
    script.async = true
    script.onerror = () => reject(new Error('Failed to load Tencent Map script'))
    window[callbackName] = () => {
      try {
        if (window.TMap) window.TMap.__forceReload = false
      } catch (_) {}
      resolve(window.TMap)
      delete window[callbackName]
    }
    document.head.appendChild(script)
  })
}

// 2D qq.maps loader (prefer script included in index.html, fallback to dynamic)
const loadQqMapScript = () => {
  const ready = () =>
    typeof window !== 'undefined' &&
    window.qq &&
    window.qq.maps &&
    typeof window.qq.maps.Map === 'function' &&
    typeof window.qq.maps.LatLng === 'function'

  if (ready()) return Promise.resolve(window.qq.maps)

  return new Promise((resolve, reject) => {
    const waitReady = () => {
      if (ready()) return resolve(window.qq.maps)
      requestAnimationFrame(waitReady)
    }
    // 仅等待现有静态脚本就绪，避免异步注入触发 document.write 错误
    const existed = document.getElementById(QQMAP_SCRIPT_ID) || document.querySelector('script[src*="map.qq.com/api/js"]')
    if (!existed) {
      reject(new Error('qq.maps script not found. Please include it in index.html without async/defer.'))
      return
    }
    waitReady()
    setTimeout(() => { if (!ready()) reject(new Error('qq.maps load timeout')) }, 20000)
  })
}

const createPolygonLayer = (TMap) =>
  new TMap.MultiPolygon({
    map: mapInstance.value,
    styles: {
      zone: new TMap.PolygonStyle({
        color: highlightStyle.polygon.fillColor,
        borderColor: highlightStyle.polygon.strokeColor,
        borderWidth: highlightStyle.polygon.strokeWidth,
      }),
    },
    geometries: [],
  })

const createCircleLayer = (TMap) =>
  new TMap.MultiCircle({
    map: mapInstance.value,
    styles: {
      zone: new TMap.CircleStyle({
        color: highlightStyle.circle.fillColor,
        borderColor: highlightStyle.circle.strokeColor,
        borderWidth: highlightStyle.circle.strokeWidth,
      }),
    },
    geometries: [],
  })

const createZonePolylineLayer = (TMap) =>
  new TMap.MultiPolyline({
    map: mapInstance.value,
    styles: {
      zone: new TMap.PolylineStyle({
        color: highlightStyle.polyline.color,
        width: highlightStyle.polyline.width,
      }),
    },
    geometries: [],
  })

const createPolylineLayer = (TMap) =>
  new TMap.MultiPolyline({
    map: mapInstance.value,
    styles: {
      dashed: new TMap.PolylineStyle({
        color: highlightStyle.dashed.color,
        width: highlightStyle.dashed.width,
        dashArray: highlightStyle.dashed.dashArray,
      }),
      solid: new TMap.PolylineStyle({
        color: highlightStyle.polyline.color,
        width: highlightStyle.polyline.width,
      }),
    },
    geometries: [],
  })

const createDrawingMarkerLayer = (TMap) =>
  new TMap.MultiMarker({
    map: mapInstance.value,
    styles: {
      vertex: new TMap.MarkerStyle({
        width: 16,
        height: 16,
        anchor: { x: 8, y: 8 },
        src: DRAW_VERTEX_ICON,
      }),
    },
    geometries: [],
  })

const createSearchMarkerLayer = (TMap) =>
  new TMap.MultiMarker({
    map: mapInstance.value,
    styles: {
      result: new TMap.MarkerStyle({
        width: 24,
        height: 32,
        anchor: { x: 12, y: 32 },
        src: SEARCH_MARKER_ICON,
      }),
    },
    geometries: [],
  })

const ensureDrawingLayers = (TMap) => {
  if (!drawingPolyline.value) {
    drawingPolyline.value = createPolylineLayer(TMap)
  }
  if (!drawingPolygon.value) {
    drawingPolygon.value = createPolygonLayer(TMap)
  }
  if (!drawingCircle.value) {
    drawingCircle.value = createCircleLayer(TMap)
  }
  if (!drawingMarkerLayer.value) {
    drawingMarkerLayer.value = createDrawingMarkerLayer(TMap)
  }
}

const ensureZoneLayers = (TMap) => {
  if (!zonePolygonLayer.value) {
    zonePolygonLayer.value = createPolygonLayer(TMap)
  }
  if (!zoneCircleLayer.value) {
    zoneCircleLayer.value = createCircleLayer(TMap)
  }
  if (!zonePolylineLayer.value) {
    zonePolylineLayer.value = createZonePolylineLayer(TMap)
  }
}

const ensureSearchLayer = (TMap) => {
  if (!searchMarkerLayer.value) {
    searchMarkerLayer.value = createSearchMarkerLayer(TMap)
  }
}

const clearDrawingOverlays = () => {
  try {
    if (drawingPolyline.value && drawingPolyline.value.setMap) drawingPolyline.value.setMap(null)
  } catch (_) {}
  try {
    if (drawingPolygon.value && drawingPolygon.value.setMap) drawingPolygon.value.setMap(null)
  } catch (_) {}
  try {
    if (drawingCircle.value && drawingCircle.value.setMap) drawingCircle.value.setMap(null)
  } catch (_) {}
  drawingPolyline.value = null
  drawingPolygon.value = null
  drawingCircle.value = null
  if (Array.isArray(drawingMarkerLayer.value)) {
    drawingMarkerLayer.value.forEach((m) => m.setMap && m.setMap(null))
  } else if (drawingMarkerLayer.value && drawingMarkerLayer.value.setGeometries) {
    // GL path fallback
    try { drawingMarkerLayer.value.setGeometries([]) } catch (_) {}
  }
  drawingMarkerLayer.value = []
  drawingPoints.value = []
  drawingStartPoint.value = null
  drawingCenter.value = null
}

const stopDrawing = () => {
  detachMapListeners()
  isDrawing.value = false
  currentDrawingMode.value = formState.type
}

const resetFormGeometry = () => {
  formState.coordinates = []
  formState.circle = null
}

const detachMapListeners = () => {
  // GL path
  try {
    if (mapInstance.value && mapClickHandler.value) mapInstance.value.off('click', mapClickHandler.value)
    if (mapInstance.value && mapMouseMoveHandler.value) mapInstance.value.off('mousemove', mapMouseMoveHandler.value)
    if (mapInstance.value && mapMouseUpHandler.value) mapInstance.value.off('mouseup', mapMouseUpHandler.value)
    if (mapInstance.value && mapDblClickHandler.value) mapInstance.value.off('dblclick', mapDblClickHandler.value)
  } catch (_) {}
  mapClickHandler.value = null
  mapMouseMoveHandler.value = null
  mapMouseUpHandler.value = null
  mapDblClickHandler.value = null
  // 2D path
  if (Array.isArray(qqListeners.value)) {
    qqListeners.value.forEach((token) => {
      try { window.qq && window.qq.maps && window.qq.maps.event.removeListener(token) } catch (_) {}
    })
  }
  qqListeners.value = []
}

const normalizeLatLngPoint = (point) => {
  if (!point) return null
  if (typeof point.getLat === 'function' && typeof point.getLng === 'function') return point
  if (typeof window !== 'undefined') {
    if (window.qq && window.qq.maps) {
      const latitude = Number(point.latitude ?? point.lat)
      const longitude = Number(point.longitude ?? point.lng)
      if (!Number.isNaN(latitude) && !Number.isNaN(longitude)) {
        return new window.qq.maps.LatLng(latitude, longitude)
      }
    } else if (window.TMap) {
      const latitude = Number(point.latitude ?? point.lat)
      const longitude = Number(point.longitude ?? point.lng)
      if (!Number.isNaN(latitude) && !Number.isNaN(longitude)) {
        return new window.TMap.LatLng(latitude, longitude)
      }
    }
  }
  return null
}

const updateVertexMarkers = (points = drawingPoints.value) => {
  if (!Array.isArray(points)) return
  // try 2D path
  if (window.qq && window.qq.maps) {
    if (!Array.isArray(drawingMarkerLayer.value)) drawingMarkerLayer.value = []
    drawingMarkerLayer.value.forEach((m) => m.setMap && m.setMap(null))
    drawingMarkerLayer.value = []
    const seen = new Set()
    points.forEach((point) => {
      const latLng = normalizeLatLngPoint(point)
      if (!latLng) return
      const key = `${latLng.getLat()}_${latLng.getLng()}`
      if (seen.has(key)) return
      seen.add(key)
      const marker = new window.qq.maps.Marker({ map: mapInstance.value, position: latLng })
      try { marker.setIcon(DRAW_VERTEX_ICON) } catch (_) {}
      drawingMarkerLayer.value.push(marker)
    })
    return
  }
  // fallback GL path
  if (drawingMarkerLayer.value && drawingMarkerLayer.value.setGeometries) {
    const seen = new Set()
    const geometries = []
    points.forEach((point, index) => {
      const latLng = normalizeLatLngPoint(point)
      if (!latLng) return
      const key = `${latLng.getLat()}_${latLng.getLng()}`
      if (seen.has(key)) return
      seen.add(key)
      geometries.push({ id: `vertex-${index}`, styleId: 'vertex', position: latLng })
    })
    drawingMarkerLayer.value.setGeometries(geometries)
  }
}

const setupPolygonDrawing = () => {
  clearDrawingOverlays()
  resetFormGeometry()
  isDrawing.value = true
  drawingPoints.value = []
  currentDrawingMode.value = 'POLYGON'

  if (window.qq && window.qq.maps) {
    const clickListener = window.qq.maps.event.addListener(mapInstance.value, 'click', (event) => {
      if (!event?.latLng) return
      const point = event.latLng
      if (drawingPoints.value.length === 0) {
        drawingStartPoint.value = point
        drawingPoints.value.push(point)
        if (drawingPolyline.value && drawingPolyline.value.setMap) drawingPolyline.value.setMap(null)
        updateVertexMarkers()
        return
      }
      if (drawingPoints.value.length >= POLYGON_MIN_POINTS) {
        const firstPoint = drawingPoints.value[0]
        const distanceToStart = calculateDistanceMeters(firstPoint, point)
        if (distanceToStart < 20) {
          finalizePolygonDrawing()
          return
        }
      }
      drawingPoints.value.push(point)
      updatePathPreview()
      updateVertexMarkers()
    })
    qqListeners.value.push(clickListener)
    const moveListener = window.qq.maps.event.addListener(mapInstance.value, 'mousemove', (event) => {
      if (!event?.latLng || !drawingPoints.value.length) return
      updatePathPreview(event.latLng)
    })
    qqListeners.value.push(moveListener)
    const dblListener = window.qq.maps.event.addListener(mapInstance.value, 'dblclick', () => finalizePolygonDrawing())
    qqListeners.value.push(dblListener)
    return
  }

  mapClickHandler.value = (event) => {
    if (!event?.latLng) return
    const point = event.latLng
    if (drawingPoints.value.length === 0) {
      drawingStartPoint.value = point
      drawingPoints.value.push(point)
      drawingPolyline.value.setGeometries([])
      updateVertexMarkers()
      return
    }
    if (drawingPoints.value.length >= POLYGON_MIN_POINTS) {
      const firstPoint = drawingPoints.value[0]
      const distanceToStart = calculateDistanceMeters(firstPoint, point)
      if (distanceToStart < 20) {
        finalizePolygonDrawing(TMap)
        return
      }
    }
    drawingPoints.value.push(point)
    updatePathPreview()
    updateVertexMarkers()
  }

  mapInstance.value.on('click', mapClickHandler.value)
  mapMouseMoveHandler.value = (event) => {
    if (!event?.latLng || !drawingPoints.value.length) return
    updatePathPreview(event.latLng)
  }
  mapDblClickHandler.value = (event) => {
    event?.originalEvent?.preventDefault?.()
    finalizePolygonDrawing()
  }
  mapInstance.value.on('mousemove', mapMouseMoveHandler.value)
  mapInstance.value.on('dblclick', mapDblClickHandler.value)
}

const setupPolylineDrawing = () => {
  clearDrawingOverlays()
  resetFormGeometry()
  isDrawing.value = true
  drawingPoints.value = []
  currentDrawingMode.value = 'POLYLINE'

  if (window.qq && window.qq.maps) {
    const clickListener = window.qq.maps.event.addListener(mapInstance.value, 'click', (event) => {
      if (!event?.latLng) return
      drawingPoints.value.push(event.latLng)
      updatePathPreview()
      updateVertexMarkers()
    })
    qqListeners.value.push(clickListener)
    const moveListener = window.qq.maps.event.addListener(mapInstance.value, 'mousemove', (event) => {
      if (!event?.latLng || !drawingPoints.value.length) return
      updatePathPreview(event.latLng)
    })
    qqListeners.value.push(moveListener)
    const dblListener = window.qq.maps.event.addListener(mapInstance.value, 'dblclick', () => finalizePolylineDrawing())
    qqListeners.value.push(dblListener)
    return
  }

  mapClickHandler.value = (event) => {
    if (!event?.latLng) return
    drawingPoints.value.push(event.latLng)
    updatePathPreview()
    updateVertexMarkers()
  }

  mapMouseMoveHandler.value = (event) => {
    if (!event?.latLng || !drawingPoints.value.length) return
    updatePathPreview(event.latLng)
  }

  mapDblClickHandler.value = (event) => {
    event?.originalEvent?.preventDefault?.()
    finalizePolylineDrawing()
  }

  mapInstance.value.on('click', mapClickHandler.value)
  mapInstance.value.on('mousemove', mapMouseMoveHandler.value)
  mapInstance.value.on('dblclick', mapDblClickHandler.value)
}

const finalizePolygonDrawing = (TMap) => {
  if (drawingPoints.value.length < POLYGON_MIN_POINTS) {
    message.warning(t('noFlyZone.messages.polygonTooSmall'))
    return
  }
  const paths = drawingPoints.value.map((point) => ({
    latitude: point.getLat(),
    longitude: point.getLng(),
  }))
  if (formState.type === 'RECTANGLE' && !isRectangleShape(paths)) {
    message.warning(t('noFlyZone.messages.rectangleInvalid'))
    return
  }
  formState.coordinates = paths
  if (window.qq && window.qq.maps) {
    if (!drawingPolygon.value || !drawingPolygon.value.setPath) {
      drawingPolygon.value = new window.qq.maps.Polygon({
        map: mapInstance.value,
        path: drawingPoints.value,
        strokeWeight: highlightStyle.polygon.strokeWidth,
        strokeColor: '#ff4d4f',
        fillColor: toQqColor(highlightStyle.polygon.fillColor, 1),
        clickable: false,
      })
    } else {
      drawingPolygon.value.setPath(drawingPoints.value)
      drawingPolygon.value.setMap(mapInstance.value)
    }
    if (drawingPolyline.value && drawingPolyline.value.setMap) drawingPolyline.value.setMap(null)
  } else if (drawingPolygon.value && drawingPolygon.value.setGeometries) {
    drawingPolygon.value.setGeometries([
      { id: 'drawing', styleId: 'zone', paths: drawingPoints.value },
    ])
    if (drawingPolyline.value && drawingPolyline.value.setGeometries) drawingPolyline.value.setGeometries([])
  }
  updateVertexMarkers()
  stopDrawing()
}

const finalizePolylineDrawing = (TMap) => {
  if (drawingPoints.value.length < 2) {
    message.warning(t('noFlyZone.messages.polylineTooShort'))
    return
  }
  formState.coordinates = drawingPoints.value.map((point) => ({
    latitude: point.getLat(),
    longitude: point.getLng(),
  }))
  if (window.qq && window.qq.maps) {
    if (!drawingPolyline.value || !drawingPolyline.value.setPath) {
      drawingPolyline.value = new window.qq.maps.Polyline({
        map: mapInstance.value,
        path: drawingPoints.value,
        strokeColor: '#ff4d4f',
        strokeWeight: highlightStyle.polyline.width,
        clickable: false,
      })
    } else {
      drawingPolyline.value.setPath(drawingPoints.value)
      drawingPolyline.value.setMap(mapInstance.value)
    }
  } else if (drawingPolyline.value && drawingPolyline.value.setGeometries) {
    drawingPolyline.value.setGeometries([
      { id: 'drawing', styleId: 'solid', paths: drawingPoints.value },
    ])
  }
  updateVertexMarkers()
  stopDrawing()
}

const updatePathPreview = (cursorPoint = null) => {
  const points = [...drawingPoints.value]
  if (cursorPoint) points.push(cursorPoint)
  if (points.length < 2) {
    if (drawingPolyline.value && drawingPolyline.value.setMap) drawingPolyline.value.setMap(null)
    else if (drawingPolyline.value && drawingPolyline.value.setGeometries) drawingPolyline.value.setGeometries([])
    return
  }
  if (window.qq && window.qq.maps) {
    if (!drawingPolyline.value || !drawingPolyline.value.setPath) {
      drawingPolyline.value = new window.qq.maps.Polyline({
        map: mapInstance.value,
        path: points,
        strokeColor: '#ff4d4f',
        strokeWeight: highlightStyle.dashed.width,
        clickable: false,
      })
    } else {
      drawingPolyline.value.setPath(points)
      drawingPolyline.value.setMap(mapInstance.value)
    }
  } else if (drawingPolyline.value && drawingPolyline.value.setGeometries) {
    drawingPolyline.value.setGeometries([{ id: 'preview', styleId: 'dashed', paths: points }])
  }
  updateVertexMarkers()
}

const setupRectangleDrawing = (TMap) => {
  clearDrawingOverlays()
  resetFormGeometry()
  isDrawing.value = true
  drawingPoints.value = []
  currentDrawingMode.value = 'RECTANGLE'
  let isMouseDown = false

  const updateRectanglePreview = (endPoint) => {
    if (!drawingStartPoint.value || !endPoint) return
    const bounds = createRectangleBounds(drawingStartPoint.value, endPoint)
    drawingPoints.value = bounds
    if (window.qq && window.qq.maps) {
      if (!drawingPolygon.value || !drawingPolygon.value.setPath) {
        drawingPolygon.value = new window.qq.maps.Polygon({
          map: mapInstance.value,
          path: bounds,
          strokeColor: '#ff4d4f',
          strokeWeight: highlightStyle.polygon.strokeWidth,
          fillColor: toQqColor(highlightStyle.polygon.fillColor, 1),
          clickable: false,
        })
      } else {
        drawingPolygon.value.setPath(bounds)
        drawingPolygon.value.setMap(mapInstance.value)
      }
    } else if (drawingPolygon.value && drawingPolygon.value.setGeometries) {
      drawingPolygon.value.setGeometries([{ id: 'drawing', styleId: 'zone', paths: bounds }])
    }
    updateVertexMarkers(bounds)
  }

  mapClickHandler.value = (event) => {
    if (!event?.latLng) return
    if (!drawingStartPoint.value) {
      drawingStartPoint.value = event.latLng
      isMouseDown = true
      updateVertexMarkers([event.latLng])
      return
    }
    if (drawingPoints.value.length >= 4) {
      formState.coordinates = drawingPoints.value.map((point) => ({
        latitude: point.getLat(),
        longitude: point.getLng(),
      }))
      stopDrawing()
    }
  }

  mapMouseMoveHandler.value = (event) => {
    if (!isMouseDown || !drawingStartPoint.value) return
    updateRectanglePreview(event.latLng)
  }

  mapMouseUpHandler.value = () => {
    if (!drawingStartPoint.value || drawingPoints.value.length < 4) return
    formState.coordinates = drawingPoints.value.map((point) => ({
      latitude: point.getLat(),
      longitude: point.getLng(),
    }))
    updateVertexMarkers(drawingPoints.value)
    stopDrawing()
    isMouseDown = false
  }

  if (window.qq && window.qq.maps) {
    const clickListener = window.qq.maps.event.addListener(mapInstance.value, 'click', (event) => {
      if (!event?.latLng) return
      if (!drawingStartPoint.value) {
        drawingStartPoint.value = event.latLng
        isMouseDown = true
        updateVertexMarkers([event.latLng])
        return
      }
      if (drawingPoints.value.length >= 4) {
        formState.coordinates = drawingPoints.value.map((point) => ({ latitude: point.getLat(), longitude: point.getLng() }))
        stopDrawing()
      }
    })
    const moveListener = window.qq.maps.event.addListener(mapInstance.value, 'mousemove', (event) => {
      if (!isMouseDown || !drawingStartPoint.value) return
      updateRectanglePreview(event.latLng)
    })
    const upListener = window.qq.maps.event.addListener(mapInstance.value, 'mouseup', () => {
      if (!drawingStartPoint.value || drawingPoints.value.length < 4) return
      formState.coordinates = drawingPoints.value.map((point) => ({ latitude: point.getLat(), longitude: point.getLng() }))
      updateVertexMarkers(drawingPoints.value)
      stopDrawing()
      isMouseDown = false
    })
    qqListeners.value.push(clickListener, moveListener, upListener)
  } else {
    mapInstance.value.on('click', mapClickHandler.value)
    mapInstance.value.on('mousemove', mapMouseMoveHandler.value)
    mapInstance.value.on('mouseup', mapMouseUpHandler.value)
  }
}

const setupCircleDrawing = (TMap) => {
  clearDrawingOverlays()
  resetFormGeometry()
  isDrawing.value = true
  currentDrawingMode.value = 'CIRCLE'
  drawingRadius.value = Math.max(drawingRadius.value || CIRCLE_MIN_RADIUS, CIRCLE_MIN_RADIUS)

  if (window.qq && window.qq.maps) {
    const clickListener = window.qq.maps.event.addListener(mapInstance.value, 'click', (event) => {
      if (!event?.latLng) return
      drawingCenter.value = event.latLng
      updateCirclePreview()
    })
    qqListeners.value.push(clickListener)
  } else {
    mapClickHandler.value = (event) => {
      if (!event?.latLng) return
      drawingCenter.value = event.latLng
      updateCirclePreview(TMap)
    }
    mapInstance.value.on('click', mapClickHandler.value)
  }
}

const updateCirclePreview = (TMap = window.TMap) => {
  if (!drawingCenter.value) return
  if (window.qq && window.qq.maps) {
    if (!drawingCircle.value || !drawingCircle.value.setCenter) {
      drawingCircle.value = new window.qq.maps.Circle({
        map: mapInstance.value,
        center: drawingCenter.value,
        radius: drawingRadius.value,
        strokeColor: '#ff4d4f',
        strokeWeight: highlightStyle.circle.strokeWidth,
        fillColor: toQqColor(highlightStyle.circle.fillColor, 1),
        clickable: false,
      })
    } else {
      drawingCircle.value.setCenter(drawingCenter.value)
      drawingCircle.value.setRadius(drawingRadius.value)
      drawingCircle.value.setMap(mapInstance.value)
    }
  } else if (TMap && drawingCircle.value && drawingCircle.value.setGeometries) {
    drawingCircle.value.setGeometries([
      { id: 'drawing', styleId: 'zone', center: drawingCenter.value, radius: drawingRadius.value },
    ])
  }
  updateVertexMarkers([drawingCenter.value])
}

const applyCircleDrawing = () => {
  if (!drawingCenter.value) {
    message.warning(t('noFlyZone.messages.circleCenterMissing'))
    return
  }
  if (!drawingRadius.value || drawingRadius.value < CIRCLE_MIN_RADIUS) {
    message.warning(t('noFlyZone.messages.circleRadiusTooSmall', { radius: CIRCLE_MIN_RADIUS }))
    return
  }
  formState.circle = {
    latitude: drawingCenter.value.getLat(),
    longitude: drawingCenter.value.getLng(),
    radiusMeters: drawingRadius.value,
  }
  updateVertexMarkers([drawingCenter.value])
  stopDrawing()
}

const startDrawing = async () => {
  if (!mapReady.value) return
  detachMapListeners()
  clearDrawingOverlays()
  resetFormGeometry()

  if (formState.type === 'CIRCLE') {
    setupCircleDrawing()
  } else if (formState.type === 'POLYLINE') {
    setupPolylineDrawing()
  } else if (formState.type === 'RECTANGLE') {
    setupRectangleDrawing()
  } else {
    setupPolygonDrawing()
  }
}

const finishDrawingManually = () => {
  if (currentDrawingMode.value === 'RECTANGLE') {
    if (!drawingPoints.value.length) {
      message.warning(t('noFlyZone.messages.rectangleIncomplete'))
      return
    }
    formState.coordinates = drawingPoints.value.map((point) => ({
      latitude: point.getLat(),
      longitude: point.getLng(),
    }))
    updateVertexMarkers(drawingPoints.value)
    stopDrawing()
    return
  }
  if (currentDrawingMode.value === 'POLYLINE') {
    finalizePolylineDrawing()
    return
  }
  finalizePolygonDrawing()
}

const clearDrawing = () => {
  detachMapListeners()
  clearDrawingOverlays()
  resetFormGeometry()
  drawingRadius.value = CIRCLE_MIN_RADIUS
  drawingCenter.value = null
  isDrawing.value = false
}

const convertTimeRangeToSeconds = () => {
  const [start, end] = formState.timeRange || []
  const parseTime = (value) => {
    if (!value) return null
    const normalized = typeof value === 'string' ? value.replace(' ', 'T') : value
    const date = new Date(normalized)
    if (Number.isNaN(date.getTime())) return null
    return Math.floor(date.getTime() / 1000)
  }
  return [parseTime(start), parseTime(end)]
}

const validateWechatLink = (link) => {
  if (!link) return false
  try {
    const url = new URL(link)
    return url.hostname.endsWith('mp.weixin.qq.com')
  } catch (error) {
    return false
  }
}

const buildZonePayload = () => {
  if (!formState.name.trim()) {
    message.warning(t('noFlyZone.messages.nameRequired'))
    return null
  }
  if (!validateWechatLink(formState.wechatLink)) {
    message.warning(t('noFlyZone.messages.invalidWechatLink'))
    return null
  }
  let coordinatesPayload = []
  let circlePayload = null
  if (formState.type === 'CIRCLE') {
    if (!formState.circle) {
      message.warning(t('noFlyZone.messages.circleMissing'))
      return null
    }
    circlePayload = { ...formState.circle }
  } else {
    if (!formState.coordinates?.length) {
      message.warning(t('noFlyZone.messages.geometryMissing'))
      return null
    }
    coordinatesPayload = formState.coordinates.map((coord) => ({
      latitude: coord.latitude,
      longitude: coord.longitude,
    }))
  }
  const [effectiveFrom, effectiveTo] = convertTimeRangeToSeconds()
  return {
    name: formState.name.trim(),
    type: formState.type,
    coordinates: coordinatesPayload,
    circle: circlePayload,
    effectiveFrom: effectiveFrom ?? undefined,
    effectiveTo: effectiveTo ?? undefined,
    wechatLink: formState.wechatLink.trim(),
  }
}

const loadZoneList = async () => {
  listLoading.value = true
  try {
    const { content, totalElements, page, size } = await listNoFlyZones({
      page: pagination.current,
      size: pagination.pageSize,
    })
    zoneList.value = content
    pagination.total = totalElements
    pagination.current = page
    pagination.pageSize = size
    renderZonesOnMap()
  } catch (error) {
    console.error('Failed to load no-fly zones', error)
    message.error(t('noFlyZone.messages.loadFailed'))
  } finally {
    listLoading.value = false
  }
}

const handleSubmit = async () => {
  const payload = buildZonePayload()
  if (!payload) return
  formSubmitting.value = true
  try {
    if (formState.id) {
      await updateNoFlyZone(formState.id, payload)
      message.success(t('noFlyZone.messages.updateSuccess'))
    } else {
      await createNoFlyZone(payload)
      message.success(t('noFlyZone.messages.createSuccess'))
    }
    await loadZoneList()
    resetForm()
  } catch (error) {
    console.error('Failed to submit no-fly zone', error)
    message.error(t('noFlyZone.messages.submitFailed'))
  } finally {
    formSubmitting.value = false
  }
}

const resetForm = () => {
  formState.id = null
  formState.name = ''
  formState.type = 'POLYGON'
  formState.wechatLink = ''
  formState.timeRange = []
  resetFormGeometry()
  clearDrawing()
}

const editZone = (zone) => {
  if (!zone) return
  resetForm()
  formState.id = zone.id
  formState.name = zone.name || ''
  formState.type = zone.type || 'POLYGON'
  formState.wechatLink = zone.wechatLink || ''
  const range = formatRangeFromZone(zone)
  formState.timeRange = range.every((value) => value === null) ? [] : range
  if (zone.type === 'CIRCLE' && zone.circle) {
    formState.circle = { ...zone.circle }
    if (window.qq && window.qq.maps) {
      drawingCenter.value = new window.qq.maps.LatLng(zone.circle.latitude, zone.circle.longitude)
      drawingRadius.value = zone.circle.radiusMeters
      updateCirclePreview()
    } else {
      drawingCenter.value = new window.TMap.LatLng(zone.circle.latitude, zone.circle.longitude)
      drawingRadius.value = zone.circle.radiusMeters
      ensureDrawingLayers(window.TMap)
      drawingCircle.value.setGeometries([
        { id: 'drawing', styleId: 'zone', center: drawingCenter.value, radius: drawingRadius.value },
      ])
    }
    drawingPoints.value = []
    updateVertexMarkers([drawingCenter.value])
  } else if (Array.isArray(zone.coordinates) && zone.coordinates.length) {
    formState.coordinates = zone.coordinates.map((coord) => ({ ...coord }))
    const paths = zone.coordinates.map((coord) => normalizeLatLngPoint(coord)).filter(Boolean)
    drawingPoints.value = paths
    if (window.qq && window.qq.maps) {
      if (zone.type === 'POLYLINE') {
        if (!drawingPolyline.value) drawingPolyline.value = new window.qq.maps.Polyline({ map: mapInstance.value, path: paths, strokeColor: '#ff4d4f', strokeWeight: highlightStyle.polyline.width })
        else { drawingPolyline.value.setPath(paths); drawingPolyline.value.setMap(mapInstance.value) }
      } else {
        if (!drawingPolygon.value) drawingPolygon.value = new window.qq.maps.Polygon({ map: mapInstance.value, path: paths, strokeColor: '#ff4d4f', strokeWeight: highlightStyle.polygon.strokeWidth, fillColor: toQqColor(highlightStyle.polygon.fillColor, 1) })
        else { drawingPolygon.value.setPath(paths); drawingPolygon.value.setMap(mapInstance.value) }
      }
    } else {
      ensureDrawingLayers(window.TMap)
      if (zone.type === 'POLYLINE') {
        drawingPolyline.value.setGeometries([{ id: 'drawing', styleId: 'solid', paths }])
      } else {
        drawingPolygon.value.setGeometries([{ id: 'drawing', styleId: 'zone', paths }])
      }
    }
    updateVertexMarkers(paths)
  }
  focusZoneOnMap(zone)
}

const focusZoneOnMap = (zone) => {
  if (!mapInstance.value || !zone) return
  if (zone.type === 'CIRCLE' && zone.circle) {
    const center = (window.qq && window.qq.maps)
      ? new window.qq.maps.LatLng(zone.circle.latitude, zone.circle.longitude)
      : new window.TMap.LatLng(zone.circle.latitude, zone.circle.longitude)
    mapInstance.value.setCenter(center)
    mapInstance.value.setZoom(Math.max(Math.min(Math.round(18 - Math.log2(zone.circle.radiusMeters / 100)), 17), 12))
  } else if (Array.isArray(zone.coordinates) && zone.coordinates.length) {
    if (window.qq && window.qq.maps) {
      const bounds = new window.qq.maps.LatLngBounds()
      zone.coordinates.forEach((coord) => bounds.extend(new window.qq.maps.LatLng(coord.latitude, coord.longitude)))
      mapInstance.value.fitBounds(bounds)
    } else {
      const bounds = new window.TMap.LatLngBounds()
      zone.coordinates.forEach((coord) => bounds.extend(new window.TMap.LatLng(coord.latitude, coord.longitude)))
      mapInstance.value.fitBounds(bounds)
    }
  }
}

const formatRangeFromZone = (zone) => {
  const formatTime = (seconds) => {
    if (!seconds) return null
    const date = new Date(seconds * 1000)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const secondsStr = String(date.getSeconds()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}:${secondsStr}`
  }
  const start = formatTime(zone.effectiveFrom)
  const end = formatTime(zone.effectiveTo)
  return [start ?? null, end ?? null]
}

const deleteZone = (zone) => {
  if (!zone?.id) return
  Modal.confirm({
    title: t('noFlyZone.messages.deleteConfirmTitle'),
    content: t('noFlyZone.messages.deleteConfirmContent', { name: zone.name || '' }),
    okText: t('noFlyZone.actions.confirmDelete'),
    cancelText: t('noFlyZone.actions.cancel'),
    okButtonProps: {
      danger: true,
      type: 'primary',
    },
    onOk: async () => {
      try {
        await deleteNoFlyZone(zone.id)
        message.success(t('noFlyZone.messages.deleteSuccess'))
        if (formState.id === zone.id) {
          resetForm()
        }
        loadZoneList()
      } catch (error) {
        console.error('Failed to delete no-fly zone', error)
        message.error(t('noFlyZone.messages.deleteFailed'))
      }
    },
  })
}

const renderZonesOnMap = () => {
  if (!mapInstance.value) return
  // clear old
  zonePolygonOverlays.value.forEach((o) => o.setMap && o.setMap(null))
  zoneCircleOverlays.value.forEach((o) => o.setMap && o.setMap(null))
  zonePolylineOverlays.value.forEach((o) => o.setMap && o.setMap(null))
  zonePolygonOverlays.value = []
  zoneCircleOverlays.value = []
  zonePolylineOverlays.value = []
  zoneList.value.forEach((zone) => {
    if (zone.type === 'CIRCLE' && zone.circle) {
      if (window.qq && window.qq.maps) {
        const circle = new window.qq.maps.Circle({
          map: mapInstance.value,
          center: new window.qq.maps.LatLng(zone.circle.latitude, zone.circle.longitude),
          radius: zone.circle.radiusMeters,
          strokeColor: '#ff4d4f',
          strokeWeight: highlightStyle.circle.strokeWidth,
          fillColor: toQqColor(highlightStyle.circle.fillColor, 1),
          clickable: false,
        })
        zoneCircleOverlays.value.push(circle)
      }
    } else if (zone.type === 'POLYLINE' && Array.isArray(zone.coordinates) && zone.coordinates.length) {
      if (window.qq && window.qq.maps) {
        const polyline = new window.qq.maps.Polyline({
          map: mapInstance.value,
          path: zone.coordinates.map((coord) => new window.qq.maps.LatLng(coord.latitude, coord.longitude)),
          strokeColor: '#ff4d4f',
          strokeWeight: highlightStyle.polyline.width,
          clickable: false,
        })
        zonePolylineOverlays.value.push(polyline)
      }
    } else if (Array.isArray(zone.coordinates) && zone.coordinates.length) {
      if (window.qq && window.qq.maps) {
        const polygon = new window.qq.maps.Polygon({
          map: mapInstance.value,
          path: zone.coordinates.map((coord) => new window.qq.maps.LatLng(coord.latitude, coord.longitude)),
          strokeColor: '#ff4d4f',
          strokeWeight: highlightStyle.polygon.strokeWidth,
          fillColor: toQqColor(highlightStyle.polygon.fillColor, 1),
          clickable: false,
        })
        zonePolygonOverlays.value.push(polygon)
      }
    }
  })
}

const loadMerchantMarkers = async () => {
  if (!mapInstance.value) return
  try {
    const { content } = await fetchMarkers({
      page: 1,
      size: 100,
      status: MARKER_REVIEW_STATUS.APPROVED,
    })
    merchantMarkers.value.forEach((m) => m.setMap && m.setMap(null))
    merchantMarkers.value = []
    if (window.qq && window.qq.maps) {
      content.forEach((mk) => {
        const latitude = mk?.location?.latitude
        const longitude = mk?.location?.longitude
        if (typeof latitude === 'number' && typeof longitude === 'number') {
          const marker = new window.qq.maps.Marker({
            map: mapInstance.value,
            position: new window.qq.maps.LatLng(latitude, longitude),
          })
          merchantMarkers.value.push(marker)
        }
      })
    }
  } catch (error) {
    console.error('Failed to load merchant markers', error)
  }
}

const calculateDistanceMeters = (pointA, pointB) => {
  if (!pointA || !pointB) return 0
  const toRad = (value) => (value * Math.PI) / 180
  const lat1 = pointA.getLat()
  const lon1 = pointA.getLng()
  const lat2 = pointB.getLat()
  const lon2 = pointB.getLng()
  const R = 6378137
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

const createRectangleBounds = (startPoint, endPoint) => {
  const northLat = Math.max(startPoint.getLat(), endPoint.getLat())
  const southLat = Math.min(startPoint.getLat(), endPoint.getLat())
  const eastLng = Math.max(startPoint.getLng(), endPoint.getLng())
  const westLng = Math.min(startPoint.getLng(), endPoint.getLng())
  if (window.qq && window.qq.maps) {
    return [
      new window.qq.maps.LatLng(northLat, westLng),
      new window.qq.maps.LatLng(northLat, eastLng),
      new window.qq.maps.LatLng(southLat, eastLng),
      new window.qq.maps.LatLng(southLat, westLng),
      new window.qq.maps.LatLng(northLat, westLng),
    ]
  }
  const TMap = window.TMap
  return [
    new TMap.LatLng(northLat, westLng),
    new TMap.LatLng(northLat, eastLng),
    new TMap.LatLng(southLat, eastLng),
    new TMap.LatLng(southLat, westLng),
    new TMap.LatLng(northLat, westLng),
  ]
}

const isRectangleShape = (paths) => {
  if (!Array.isArray(paths) || paths.length < 4) return false
  const latitudes = paths.map((point) => Number(point.latitude))
  const longitudes = paths.map((point) => Number(point.longitude))
  const uniqueLat = Array.from(new Set(latitudes.map((lat) => lat.toFixed(6))))
  const uniqueLng = Array.from(new Set(longitudes.map((lng) => lng.toFixed(6))))
  return uniqueLat.length === 2 && uniqueLng.length === 2
}

const typeLabel = (type) => {
  const option = typeOptions.value.find((item) => item.value === type)
  return option?.label || type
}

const effectiveTimeText = (zone) => {
  const format = (seconds) => {
    if (!seconds) return '-'
    const date = new Date(seconds * 1000)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}`
  }
  const start = format(zone.effectiveFrom)
  const end = format(zone.effectiveTo)
  if (start === '-' && end === '-') return '-'
  return `${start} ~ ${end}`
}

const tableColumns = computed(() => [
  {
    title: t('noFlyZone.table.columns.name'),
    dataIndex: 'name',
    key: 'name',
  },
  {
    title: t('noFlyZone.table.columns.type'),
    dataIndex: 'type',
    key: 'type',
    width: 140,
  },
  {
    title: t('noFlyZone.table.columns.effective'),
    dataIndex: 'effective',
    key: 'effective',
    width: 260,
  },
  {
    title: t('noFlyZone.table.columns.actions'),
    key: 'actions',
    width: 160,
  },
])

const handleTableChange = (pager) => {
  pagination.current = pager?.current ?? 1
  pagination.pageSize = pager?.pageSize ?? pagination.pageSize
  loadZoneList()
}

const highlightZone = (zone) => {
  focusZoneOnMap(zone)
}

const initializeMap = async () => {
  try {
    const TMap = await loadTencentMapScript()
    const container = mapContainer.value
    if (!container) return
    try {
      mapInstance.value = new TMap.Map(container, {
        zoom: MAP_DEFAULT_ZOOM,
        center: new TMap.LatLng(MAP_DEFAULT_CENTER.latitude, MAP_DEFAULT_CENTER.longitude),
      })
    } catch (err) {
      // 若首次创建地图失败，尝试重载 SDK 后重试一次
      if (!tmapReloadedOnce) {
        tmapReloadedOnce = true
        removeTencentMapScript()
        patchTMapEnvForCompatibility()
        const TMap2 = await loadTencentMapScript()
        mapInstance.value = new TMap2.Map(container, {
          zoom: MAP_DEFAULT_ZOOM,
          center: new TMap2.LatLng(MAP_DEFAULT_CENTER.latitude, MAP_DEFAULT_CENTER.longitude),
        })
      } else {
        throw err
      }
    }
    ensureDrawingLayers(TMap)
    ensureZoneLayers(TMap)
    ensureSearchLayer(TMap)
    await loadMerchantMarkers()
    await loadZoneList()
  } catch (error) {
    console.error('Failed to initialize map', error)
    message.error(t('noFlyZone.messages.mapLoadFailed'))
  }
}

const resetToCreateMode = () => {
  resetForm()
}

watch(
  () => formState.type,
  () => {
    if (!isDrawing.value) {
      clearDrawingOverlays()
      resetFormGeometry()
      if (formState.type === 'CIRCLE') {
        drawingRadius.value = CIRCLE_MIN_RADIUS
      }
    }
    currentDrawingMode.value = formState.type
  },
)

onMounted(() => {
  initializeMap2D()
})

onBeforeUnmount(() => {
  detachMapListeners()
  if (mapInstance.value) {
    if (typeof mapInstance.value.destroy === 'function') {
      mapInstance.value.destroy()
    }
    mapInstance.value = null
  }
})

const initializeMap2D = async () => {
  try {
    const maps = await loadQqMapScript()
    const container = mapContainer.value
    if (!container) return
    mapInstance.value = new maps.Map(container, {
      zoom: MAP_DEFAULT_ZOOM,
      center: new maps.LatLng(MAP_DEFAULT_CENTER.latitude, MAP_DEFAULT_CENTER.longitude),
      zoomControl: true,
      mapTypeControl: false,
    })
    await loadMerchantMarkers()
    await loadZoneList()
  } catch (error) {
    console.error('Failed to initialize 2D map', error)
    message.error(t('noFlyZone.messages.mapLoadFailed'))
  }
}

watch(drawingRadius, () => {
  if (!mapReady.value || formState.type !== 'CIRCLE') return
  updateCirclePreview()
})

const handleSearch = async () => {
  if (!canSearch.value) return
  if (!mapReady.value || !mapInstance.value) {
    message.warning(t('noFlyZone.search.mapNotReady'))
    return
  }
  const query = searchQuery.value.trim()
  if (!query) return
  searchLoading.value = true
  try {
    const response = await fetch(
      `https://apis.map.qq.com/ws/geocoder/v1/?address=${encodeURIComponent(query)}&key=${TENCENT_MAP_KEY}`,
    )
    if (!response.ok) {
      throw new Error(`Unexpected response status: ${response.status}`)
    }
    const data = await response.json()
    const location = data?.result?.location
    const lat = Number(location?.lat)
    const lng = Number(location?.lng)
    if (data?.status !== 0 || Number.isNaN(lat) || Number.isNaN(lng)) {
      message.warning(t('noFlyZone.search.noResult'))
      return
    }
    const position = (window.qq && window.qq.maps)
      ? new window.qq.maps.LatLng(lat, lng)
      : new window.TMap.LatLng(lat, lng)
    if (window.qq && window.qq.maps) {
      if (searchMarker.value) searchMarker.value.setMap(null)
      searchMarker.value = new window.qq.maps.Marker({ map: mapInstance.value, position })
    } else {
      ensureSearchLayer(window.TMap)
      searchMarkerLayer.value.setGeometries([{ id: 'search-result', styleId: 'result', position }])
    }
    mapInstance.value.setCenter(position)
    if (mapInstance.value.getZoom() < 14) {
      mapInstance.value.setZoom(14)
    }
  } catch (error) {
    console.error('Failed to search address', error)
    message.error(t('noFlyZone.search.error'))
  } finally {
    searchLoading.value = false
  }
}
</script>

<template>
  <div class="no-fly-zone-manager">
    <div class="manager-content">
      <a-card class="control-panel" :bordered="false">
        <a-form layout="vertical" class="zone-form">
          <a-form-item :label="t('noFlyZone.form.name')">
            <a-input v-model:value="formState.name" :placeholder="t('noFlyZone.form.namePlaceholder')"
              :disabled="disableFormDuringDrawing" />
          </a-form-item>
          <a-form-item :label="t('noFlyZone.form.type')">
            <a-radio-group v-model:value="formState.type" :disabled="disableFormDuringDrawing">
              <a-radio-button v-for="option in typeOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </a-radio-button>
            </a-radio-group>
          </a-form-item>
          <a-form-item v-if="isCircleMode" :label="t('noFlyZone.form.circleRadius')">
            <a-input-number v-model:value="drawingRadius" :min="CIRCLE_MIN_RADIUS" :step="50" class="radius-input"
              :addon-after="t('noFlyZone.form.radiusUnit')" :disabled="disableFormDuringDrawing && !isCircleMode" />
            <p class="form-hint">{{ t('noFlyZone.form.circleHint') }}</p>
          </a-form-item>
          <div class="drawing-actions">
            <a-space>
              <a-button type="primary" :disabled="drawButtonDisabled" @click="startDrawing">
                {{ isDrawing ? t('noFlyZone.actions.drawing') : t('noFlyZone.actions.startDrawing') }}
              </a-button>
              <a-button :disabled="!isDrawing" @click="finishDrawingManually">
                {{ t('noFlyZone.actions.finishDrawing') }}
              </a-button>
              <a-button danger :disabled="!isDrawing && !hasDrawnGeometry" @click="clearDrawing">
                {{ t('noFlyZone.actions.clearDrawing') }}
              </a-button>
              <a-button v-if="isCircleMode" type="default" :disabled="!isDrawing" @click="applyCircleDrawing">
                {{ t('noFlyZone.actions.applyCircle') }}
              </a-button>
            </a-space>
          </div>
          <a-form-item :label="t('noFlyZone.form.coordinatesLabel')">
            <a-alert :message="t('noFlyZone.form.coordinatesHint')" type="info" show-icon class="coordinate-alert" />
            <a-table class="coordinate-table" size="small" :columns="coordinateColumns"
              :data-source="displayedCoordinates" :pagination="false" :row-key="(record) => record.key"
              :locale="{ emptyText: t('noFlyZone.form.coordinatesEmpty') }" />
            <div v-if="isCircleMode && displayedCircleRadius !== null" class="radius-display">
              {{ t('noFlyZone.form.radiusDisplay', { radius: displayedCircleRadius }) }}
            </div>
          </a-form-item>
          <a-form-item :label="t('noFlyZone.form.timeRange')">
            <a-range-picker v-model:value="formState.timeRange" format="YYYY-MM-DD HH:mm:ss"
              value-format="YYYY-MM-DD HH:mm:ss" show-time allow-clear :disabled="disableFormDuringDrawing" />
          </a-form-item>
          <a-form-item :label="t('noFlyZone.form.wechatLink')">
            <a-input v-model:value="formState.wechatLink" :placeholder="t('noFlyZone.form.wechatPlaceholder')"
              :disabled="disableFormDuringDrawing" />
          </a-form-item>
          <a-space class="form-actions">
            <a-button type="primary" :loading="formSubmitting" :disabled="disableFormDuringDrawing || disableSubmit"
              @click="handleSubmit">
              {{ formState.id ? t('noFlyZone.actions.update') : t('noFlyZone.actions.create') }}
            </a-button>
            <a-button :disabled="formSubmitting || disableFormDuringDrawing" @click="resetToCreateMode">
              {{ t('noFlyZone.actions.reset') }}
            </a-button>
          </a-space>
        </a-form>
      </a-card>
      <a-card class="map-panel" :bordered="false">
        <div ref="mapContainer" class="map-container">
          <div class="map-search-bar" :class="{ 'map-search-bar--disabled': !mapReady }">
            <a-input-search v-model:value="searchQuery" :placeholder="t('noFlyZone.search.placeholder')" allow-clear
              :loading="searchLoading" @search="handleSearch">
              <template #enterButton>
                <a-button type="primary" :loading="searchLoading" :disabled="!canSearch" @click="handleSearch">
                  <SearchOutlined />
                </a-button>
              </template>
            </a-input-search>
          </div>
          <div v-if="!mapReady" class="map-placeholder">
            <a-spin :spinning="true" />
            <span>{{ t('noFlyZone.messages.mapLoading') }}</span>
          </div>
        </div>
      </a-card>
    </div>

    <a-card class="zone-table-card" :bordered="false">
      <a-table :columns="tableColumns" :data-source="zoneList" :row-key="(record) => record.id" :loading="listLoading"
        :pagination="{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: true,
        }" @change="handleTableChange">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'type'">
            {{ typeLabel(record.type) }}
          </template>
          <template v-else-if="column.key === 'effective'">
            {{ effectiveTimeText(record) }}
          </template>
          <template v-else-if="column.key === 'actions'">
            <a-space>
              <a-tooltip :title="t('noFlyZone.actions.focus')">
                <a-button shape="circle" type="text" :disabled="isDrawing" @click="highlightZone(record)">
                  <EnvironmentOutlined />
                </a-button>
              </a-tooltip>
              <a-tooltip :title="t('noFlyZone.actions.edit')">
                <a-button shape="circle" type="text" :disabled="isDrawing" @click="editZone(record)">
                  <EditOutlined />
                </a-button>
              </a-tooltip>
              <a-tooltip :title="t('noFlyZone.actions.delete')">
                <a-button shape="circle" danger type="text" :disabled="isDrawing" @click="deleteZone(record)">
                  <DeleteOutlined />
                </a-button>
              </a-tooltip>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<style scoped>
.no-fly-zone-manager {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.manager-content {
  display: grid;
  grid-template-columns: minmax(300px, 360px) 1fr;
  gap: 16px;
}

.control-panel,
.map-panel,
.zone-table-card {
  border-radius: 18px;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
}

.zone-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.radius-input {
  width: 100%;
}

.form-hint {
  margin: 4px 0 0;
  font-size: 12px;
  color: #6b7280;
}

.drawing-actions {
  margin-bottom: 8px;
}

.form-actions {
  margin-top: 8px;
}

.map-container {
  position: relative;
  width: 100%;
  height: 460px;
  border-radius: 12px;
  overflow: hidden;
}

.map-search-bar {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  width: min(360px, calc(100% - 32px));
  z-index: 2;
}

.map-search-bar--disabled {
  opacity: 0.85;
}

.map-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 12px;
  color: #6b7280;
  background: linear-gradient(135deg, rgba(219, 234, 254, 0.35), rgba(254, 243, 199, 0.35));
}

:deep(.ant-table-tbody > tr > td) {
  vertical-align: middle;
}

@media (max-width: 1200px) {
  .manager-content {
    grid-template-columns: 1fr;
  }

  .map-container {
    height: 360px;
  }
}
</style>
