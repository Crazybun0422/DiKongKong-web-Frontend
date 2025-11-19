<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { EditOutlined, DeleteOutlined, EnvironmentOutlined } from '@ant-design/icons-vue'
import { useI18n } from 'vue-i18n'
import { MARKER_REVIEW_STATUS, fetchMarkers } from '../../services/markers'
import { wgs84ToGcj02 } from '../../utils/coords'
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
const PATH_TYPE = 'PATH'
const LEGACY_CORRIDOR_TYPE = 'CORRIDOR'
const LEGACY_POLYLINE_TYPE = 'POLYLINE'
const PATH_DEFAULT_DISTANCE = 200
const POLYGON_CLOSE_HITBOX_PX = 28
const DEFAULT_CLOSE_HIT_METERS = 30
const LATITUDE_MIN = -90
const LATITUDE_MAX = 90
const LONGITUDE_MIN = -180
const LONGITUDE_MAX = 180

const { t } = useI18n()

const mapContainer = ref(null)
const mapInstance = ref(null)
const drawingPolyline = ref(null)
const drawingPolygon = ref(null)
const drawingCircle = ref(null)
const drawingMarkerLayer = ref(null)
const polygonCloseHintCircle = ref(null)
const polygonCloseHintRadar = ref(null)
const polygonCloseHintLayer = ref(null)
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
const mapRightClickHandler = ref(null)
const mapZoomChangedHandler = ref(null)
const searchMarkerLayer = ref(null)
const searchQuery = ref('')
const searchLoading = ref(false)
const searchResults = ref([])
let searchDebounceTimer = null

const isPathType = (type) =>
  type === PATH_TYPE || type === LEGACY_CORRIDOR_TYPE || type === LEGACY_POLYLINE_TYPE
const normalizeZoneType = (type) => {
  if (type === LEGACY_POLYLINE_TYPE || type === LEGACY_CORRIDOR_TYPE) {
    return PATH_TYPE
  }
  return type
}

const qqSuggest = ({
  key,
  keyword,
  region,
  location,
  page_size = 20,
  policy = 1,
  timeout = 10000,
}) => {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      reject(new Error('JSONP is only supported in browser environments'))
      return
    }

    const callbackName = `qqmap_cb_${Date.now()}_${Math.random().toString(36).slice(2)}`
    let timeoutId = null
    const script = document.createElement('script')

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      if (callbackName in window) {
        delete window[callbackName]
      }
      if (script.parentNode) {
        script.parentNode.removeChild(script)
      }
    }

    window[callbackName] = (data) => {
      resolve(data)
      cleanup()
    }

    const url = new URL('https://apis.map.qq.com/ws/place/v1/suggestion')
    const params = {
      key,
      keyword,
      region,
      location,
      page_size,
      policy,
      output: 'jsonp',
      callback: callbackName,
    }

    Object.entries(params).forEach(([paramKey, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(paramKey, value)
      }
    })

    script.src = url.toString()
    script.onerror = (error) => {
      cleanup()
      reject(error instanceof Error ? error : Object.assign(new Error('JSONP request failed'), { cause: error }))
    }

    if (Number.isFinite(timeout) && timeout > 0) {
      timeoutId = setTimeout(() => {
        cleanup()
        reject(Object.assign(new Error('JSONP request timed out'), { code: 'TIMEOUT' }))
      }, timeout)
    }

    document.body.appendChild(script)
  })
}

const searchPlaces = async (keyword, location) => {
  const trimmed = typeof keyword === 'string' ? keyword.trim() : ''
  if (!trimmed) return []
  if (!TENCENT_MAP_KEY) {
    throw Object.assign(new Error('Missing Tencent Map key'), { code: 'MISSING_KEY' })
  }
  let locationParam
  if (location) {
    const lat = Number(location.lat ?? location.latitude)
    const lng = Number(location.lng ?? location.longitude)
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const gcj = wgs84ToGcj02(lng, lat)
      locationParam = `${gcj.lat},${gcj.lng}`
    }
  }
  const data = await qqSuggest({
    key: TENCENT_MAP_KEY,
    keyword: trimmed,
    region: 'nationwide',
    location: locationParam,
    page_size: 20,
    policy: 1,
  })
  if (data?.status !== 0) {
    throw Object.assign(new Error('Search API returned error'), { code: 'API_ERROR', data })
  }
  return Array.isArray(data?.data) ? data.data : []
}

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
  pathDistanceMeters: PATH_DEFAULT_DISTANCE,
})

const formSubmitting = ref(false)

const typeOptions = computed(() => [
  { label: t('noFlyZone.types.polygon'), value: 'POLYGON' },
  { label: t('noFlyZone.types.path'), value: PATH_TYPE },
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
  if (isPathType(formState.type)) {
    return formState.coordinates.length >= 2
  }
  if (formState.type === 'RECTANGLE') {
    return formState.coordinates.length >= 4
  }
  return formState.coordinates.length >= POLYGON_MIN_POINTS
})

const isCircleMode = computed(() => formState.type === 'CIRCLE')
const isPathMode = computed(() => formState.type === PATH_TYPE)
const circleCenterLatitude = computed({
  get: () => (formState.circle?.latitude ?? null),
  set: (value) => updateCircleCenterField('latitude', value),
})
const circleCenterLongitude = computed({
  get: () => (formState.circle?.longitude ?? null),
  set: (value) => updateCircleCenterField('longitude', value),
})
const manualCoordinateEditingEnabled = computed(
  () => formState.type !== 'CIRCLE' && !isDrawing.value,
)

const drawButtonDisabled = computed(() => !mapReady.value || isDrawing.value)

const disableFormDuringDrawing = computed(() => isDrawing.value)

const disableSubmit = computed(() => {
  if (!hasDrawnGeometry.value) return true
  if (!formState.name.trim()) return true
  if (isPathMode.value) {
    const distance = Number(formState.pathDistanceMeters)
    if (!Number.isFinite(distance) || distance <= 0) {
      return true
    }
  }
  return false
})

const searchOptions = computed(() =>
  searchResults.value.map((item) => ({ value: item.key, label: item.label })),
)

const highlightStyle = {
  polygon: {
    fillColor: 'rgba(255, 77, 79, 0.12)',
    fillOpacity: 0.12,
    strokeColor: '#ff4d4f',
    strokeWidth: 1,
  },
  circle: {
    fillColor: 'rgba(255, 77, 79, 0.12)',
    fillOpacity: 0.12,
    strokeColor: '#ff4d4f',
    strokeWidth: 1,
  },
  polyline: {
    color: '#ff4d4f',
    width: 1,
  },
  dashed: {
    color: '#ff4d4f',
    width: 1,
    dashArray: [10, 6],
  },
}

const polygonCloseHintStyle = {
  strokeColor: '#00c853',
  strokeWeight: 2,
  strokeDashStyle: 'dash',
  fillColor: 'rgba(76, 175, 80, 0.18)',
  fillOpacity: 0.18,
}

const POLYGON_CLOSE_RADAR_SIZE_PX = 48
const POLYGON_CLOSE_RADAR_CORE_PX = 12

const POLYGON_CLOSE_HINT_RADAR_HTML = `
  <div
    class="polygon-close-radar"
    style="--polygon-close-radar-size: ${POLYGON_CLOSE_RADAR_SIZE_PX}px; --polygon-close-radar-core-size: ${POLYGON_CLOSE_RADAR_CORE_PX}px;"
    aria-hidden="true"
  >
    <span class="polygon-close-radar__ring"></span>
    <span class="polygon-close-radar__core"></span>
  </div>
`

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

const clampAlpha = (value, fallback = 1) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  if (num <= 0) return 0
  if (num >= 1) return 1
  return num
}

const toQqColor = (color, alpha = 1) => {
  const { r, g, b } = toRgb(color)
  const resolvedAlpha = clampAlpha(alpha, 1)
  try {
    if (window.qq && window.qq.maps && typeof window.qq.maps.Color === 'function') {
      return new window.qq.maps.Color(r, g, b, resolvedAlpha)
    }
  } catch (_) { }
  if (resolvedAlpha < 1) {
    return `rgba(${r}, ${g}, ${b}, ${resolvedAlpha})`
  }
  const raw = String(color || '').trim()
  if (!raw) return `rgb(${r}, ${g}, ${b})`
  if (/^rgba?\(/i.test(raw)) return raw
  return normalizeHex(raw)
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

const clampLatitude = (value) => {
  if (!Number.isFinite(value)) return null
  return Math.min(Math.max(value, LATITUDE_MIN), LATITUDE_MAX)
}

const clampLongitude = (value) => {
  if (!Number.isFinite(value)) return null
  return Math.min(Math.max(value, LONGITUDE_MIN), LONGITUDE_MAX)
}

const EARTH_RADIUS_METERS = 6378137
const toRadians = (degrees) => (degrees * Math.PI) / 180
const toDegrees = (radians) => (radians * 180) / Math.PI

const projectToMercator = ({ lat, lng }) => ({
  x: EARTH_RADIUS_METERS * toRadians(lng),
  y: EARTH_RADIUS_METERS * Math.log(Math.tan(Math.PI / 4 + toRadians(lat) / 2)),
})

const unprojectFromMercator = ({ x, y }) => ({
  lat: toDegrees(2 * Math.atan(Math.exp(y / EARTH_RADIUS_METERS)) - Math.PI / 2),
  lng: toDegrees(x / EARTH_RADIUS_METERS),
})

const metersPerPixelAtLatitude = (latitude, zoom) => {
  const lat = Number(latitude)
  const level = Number(zoom)
  if (!Number.isFinite(lat) || !Number.isFinite(level)) return null
  const latRad = toRadians(lat)
  const scale = Math.pow(2, level)
  if (!Number.isFinite(scale) || scale <= 0) return null
  return (Math.cos(latRad) * 2 * Math.PI * EARTH_RADIUS_METERS) / (256 * scale)
}

const pixelsToMetersAtLatitude = (latitude, zoom, pixels) => {
  const px = Number(pixels)
  if (!Number.isFinite(px) || px <= 0) return null
  const metersPerPixel = metersPerPixelAtLatitude(latitude, zoom)
  if (!Number.isFinite(metersPerPixel)) return null
  return metersPerPixel * px
}

const toPlainCoordinate = (point) => {
  if (!point) return null
  if (typeof point.getLat === 'function' && typeof point.getLng === 'function') {
    return { lat: Number(point.getLat()), lng: Number(point.getLng()) }
  }
  const latitude = Number(point.latitude ?? point.lat)
  const longitude = Number(point.longitude ?? point.lng)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  return { lat: latitude, lng: longitude }
}

const normalizeVector = ({ x, y }) => {
  const length = Math.hypot(x, y)
  if (!length) {
    return { x: 0, y: 0, length: 0 }
  }
  return { x: x / length, y: y / length, length }
}

const segmentNormal = (start, end) => {
  const { x, y, length } = normalizeVector({ x: end.x - start.x, y: end.y - start.y })
  if (!length) return null
  return { x: -y, y: x }
}

const computePathBufferPolygon = (points, distanceMeters) => {
  const distance = Number(distanceMeters)
  if (!Array.isArray(points) || points.length < 2 || !Number.isFinite(distance) || distance <= 0) {
    return []
  }
  const plain = points.map((point) => toPlainCoordinate(point)).filter(Boolean)
  if (plain.length < 2) return []
  const projected = plain.map((coord) => projectToMercator(coord))
  const leftSide = []
  const rightSide = []

  for (let i = 0; i < projected.length; i += 1) {
    const current = projected[i]
    if (!current) continue
    let normal = null
    if (i === 0 && projected[i + 1]) {
      normal = segmentNormal(current, projected[i + 1])
    } else if (i === projected.length - 1 && projected[i - 1]) {
      normal = segmentNormal(projected[i - 1], current)
    } else if (projected[i - 1] && projected[i + 1]) {
      const prevNormal = segmentNormal(projected[i - 1], current)
      const nextNormal = segmentNormal(current, projected[i + 1])
      if (prevNormal && nextNormal) {
        const combined = { x: prevNormal.x + nextNormal.x, y: prevNormal.y + nextNormal.y }
        const { x: nx, y: ny, length } = normalizeVector(combined)
        if (length > 1e-6) {
          normal = { x: nx, y: ny }
        } else {
          normal = prevNormal || nextNormal
        }
        const reference = prevNormal || nextNormal
        if (reference) {
          const dot = Math.abs(normal.x * reference.x + normal.y * reference.y)
          const scale = distance / Math.max(dot, 0.2)
          leftSide.push({ x: current.x + normal.x * scale, y: current.y + normal.y * scale })
          rightSide.push({ x: current.x - normal.x * scale, y: current.y - normal.y * scale })
          continue
        }
      }
      normal = prevNormal || nextNormal
    }
    if (!normal) continue
    const { x: nx, y: ny, length } = normalizeVector(normal)
    if (length <= 0) continue
    leftSide.push({ x: current.x + nx * distance, y: current.y + ny * distance })
    rightSide.push({ x: current.x - nx * distance, y: current.y - ny * distance })
  }

  if (leftSide.length < 2 || rightSide.length < 2) {
    return []
  }
  const polygon = [...leftSide, ...rightSide.reverse()]
  if (polygon.length) {
    polygon.push({ ...polygon[0] })
  }
  return polygon.map((point) => {
    const unprojected = unprojectFromMercator(point)
    return { latitude: unprojected.lat, longitude: unprojected.lng }
  })
}

const updatePathPreview = (points = drawingPoints.value) => {
  if (!mapInstance.value) return
  const pathPolygon = computePathBufferPolygon(points, formState.pathDistanceMeters)
  if (!pathPolygon.length) {
    if (window.qq && window.qq.maps) {
      if (drawingPolygon.value && typeof drawingPolygon.value.setMap === 'function') {
        drawingPolygon.value.setMap(null)
      }
    } else if (drawingPolygon.value && typeof drawingPolygon.value.setGeometries === 'function') {
      try {
        drawingPolygon.value.setGeometries([])
      } catch (_) { }
    }
    return
  }

  if (window.qq && window.qq.maps) {
    const latLngs = pathPolygon.map(
      (coord) => new window.qq.maps.LatLng(coord.latitude, coord.longitude),
    )
    if (!drawingPolygon.value || typeof drawingPolygon.value.setPath !== 'function') {
      drawingPolygon.value = new window.qq.maps.Polygon({
        map: mapInstance.value,
        path: latLngs,
        strokeWeight: highlightStyle.polygon.strokeWidth,
        strokeColor: '#ff4d4f',
        fillColor: toQqColor(
          highlightStyle.polygon.fillColor,
          highlightStyle.polygon.fillOpacity ?? 1,
        ),
        clickable: false,
      })
    } else {
      drawingPolygon.value.setPath(latLngs)
      drawingPolygon.value.setMap(mapInstance.value)
    }
    return
  }

  if (typeof window !== 'undefined' && window.TMap) {
    ensureDrawingLayers(window.TMap)
    const latLngs = pathPolygon.map(
      (coord) => new window.TMap.LatLng(coord.latitude, coord.longitude),
    )
    try {
      drawingPolygon.value.setGeometries([
        { id: 'drawing', styleId: 'zone', paths: latLngs },
      ])
    } catch (_) { }
  }
}

const coordinateColumns = computed(() => [
  {
    title: t('noFlyZone.form.coordinateLabel'),
    dataIndex: 'label',
    key: 'label',
    width: 70,
  },
  {
    title: t('noFlyZone.form.coordinateValueColumn'),
    key: 'values',
  },
  {
    title: t('noFlyZone.form.coordinateActions'),
    key: 'actions',
    width: 72,
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
        latitude: center.latitude,
        longitude: center.longitude,
        editable: false,
      },
    ]
  }

  const usingDrawingPoints = isDrawing.value && drawingPoints.value.length
  const sourcePoints = usingDrawingPoints ? drawingPoints.value : formState.coordinates ?? []

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
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        editable: !usingDrawingPoints,
        index,
      }
    })
    .filter((item) => item !== null)
})

const coordinateManualHintText = computed(() =>
  manualCoordinateEditingEnabled.value
    ? t('noFlyZone.form.coordinateManualHint')
    : t('noFlyZone.form.coordinateManualHintDisabled'),
)

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

const getDefaultCoordinate = () => {
  if (mapInstance.value && typeof mapInstance.value.getCenter === 'function') {
    try {
      const center = mapInstance.value.getCenter()
      const formatted = formatCoordinatePoint(center)
      if (formatted) {
        return formatted
      }
    } catch (_) { }
  }
  return { latitude: MAP_DEFAULT_CENTER.latitude, longitude: MAP_DEFAULT_CENTER.longitude }
}

const updateCircleCenterField = (field, rawValue) => {
  if (formState.type !== 'CIRCLE') return
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    if (formState.circle) {
      formState.circle[field] = null
    }
    return
  }
  const numeric = Number(rawValue)
  if (!Number.isFinite(numeric)) return
  const clamped = field === 'latitude' ? clampLatitude(numeric) : clampLongitude(numeric)
  if (clamped == null) return
  if (!formState.circle) {
    const fallback = getDefaultCoordinate()
    formState.circle = {
      latitude: field === 'latitude' ? clamped : fallback.latitude,
      longitude: field === 'longitude' ? clamped : fallback.longitude,
      radiusMeters: drawingRadius.value || CIRCLE_MIN_RADIUS,
    }
  } else {
    formState.circle[field] = clamped
    if (!Number.isFinite(formState.circle.radiusMeters)) {
      formState.circle.radiusMeters = drawingRadius.value || CIRCLE_MIN_RADIUS
    }
  }
  syncCirclePreviewFromForm()
}

const handleManualCoordinateChange = (index, field, rawValue) => {
  if (!manualCoordinateEditingEnabled.value) return
  if (!Array.isArray(formState.coordinates) || !formState.coordinates[index]) return
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    formState.coordinates[index][field] = null
    return
  }
  const numeric = Number(rawValue)
  if (!Number.isFinite(numeric)) return
  const clamped = field === 'latitude' ? clampLatitude(numeric) : clampLongitude(numeric)
  if (clamped == null) return
  formState.coordinates[index][field] = clamped
  renderFormGeometryOnMap()
}

const addManualCoordinate = () => {
  if (!manualCoordinateEditingEnabled.value) return
  if (!Array.isArray(formState.coordinates)) {
    formState.coordinates = []
  }
  const center = getDefaultCoordinate()
  formState.coordinates.push({ latitude: center.latitude, longitude: center.longitude })
  renderFormGeometryOnMap()
}

const removeManualCoordinate = (index) => {
  if (!manualCoordinateEditingEnabled.value) return
  if (!Array.isArray(formState.coordinates)) return
  if (index < 0 || index >= formState.coordinates.length) return
  formState.coordinates.splice(index, 1)
  renderFormGeometryOnMap()
}

const syncCirclePreviewFromForm = () => {
  if (
    !mapReady.value ||
    formState.type !== 'CIRCLE' ||
    !formState.circle ||
    isDrawing.value
  ) {
    return
  }
  const { latitude, longitude } = formState.circle
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return
  }
  const resolvedRadius = Math.max(
    Number(formState.circle.radiusMeters) || drawingRadius.value || CIRCLE_MIN_RADIUS,
    CIRCLE_MIN_RADIUS,
  )
  drawingRadius.value = resolvedRadius
  if (window.qq && window.qq.maps) {
    drawingCenter.value = new window.qq.maps.LatLng(latitude, longitude)
    updateCirclePreview()
  } else if (window.TMap) {
    ensureDrawingLayers(window.TMap)
    drawingCenter.value = new window.TMap.LatLng(latitude, longitude)
    updateCirclePreview(window.TMap)
  }
  updateVertexMarkers([drawingCenter.value])
}

const renderFormGeometryOnMap = () => {
  if (!mapReady.value || isDrawing.value) return
  if (formState.type === 'CIRCLE') {
    syncCirclePreviewFromForm()
    return
  }
  if (!Array.isArray(formState.coordinates) || !formState.coordinates.length) {
    drawingPoints.value = []
    if (window.qq && window.qq.maps) {
      try {
        if (drawingPolygon.value && drawingPolygon.value.setMap) drawingPolygon.value.setMap(null)
      } catch (_) { }
      try {
        if (drawingPolyline.value && drawingPolyline.value.setMap) drawingPolyline.value.setMap(null)
      } catch (_) { }
    } else if (drawingPolygon.value && drawingPolygon.value.setGeometries) {
      try { drawingPolygon.value.setGeometries([]) } catch (_) { }
      if (drawingPolyline.value && drawingPolyline.value.setGeometries) {
        try { drawingPolyline.value.setGeometries([]) } catch (_) { }
      }
    }
    updateVertexMarkers([])
    if (formState.type === PATH_TYPE) {
      updatePathPreview([])
    }
    return
  }
  const paths = formState.coordinates
    .map((coord) => normalizeLatLngPoint(coord))
    .filter((point) => point)
  if (!paths.length) {
    drawingPoints.value = []
    if (window.qq && window.qq.maps) {
      try {
        if (drawingPolygon.value && drawingPolygon.value.setMap) drawingPolygon.value.setMap(null)
      } catch (_) { }
      try {
        if (drawingPolyline.value && drawingPolyline.value.setMap) drawingPolyline.value.setMap(null)
      } catch (_) { }
    } else if (drawingPolygon.value && drawingPolygon.value.setGeometries) {
      try { drawingPolygon.value.setGeometries([]) } catch (_) { }
      if (drawingPolyline.value && drawingPolyline.value.setGeometries) {
        try { drawingPolyline.value.setGeometries([]) } catch (_) { }
      }
    }
    updateVertexMarkers([])
    if (formState.type === PATH_TYPE) {
      updatePathPreview([])
    }
    return
  }
  drawingPoints.value = paths
  if (window.qq && window.qq.maps) {
    if (formState.type === PATH_TYPE) {
      if (!drawingPolyline.value) {
        drawingPolyline.value = new window.qq.maps.Polyline({
          map: mapInstance.value,
          path: paths,
          strokeColor: '#ff4d4f',
          strokeWeight: highlightStyle.dashed.width,
          strokeDashStyle: 'dash',
        })
      } else {
        drawingPolyline.value.setPath(paths)
        drawingPolyline.value.setMap(mapInstance.value)
        try {
          if (typeof drawingPolyline.value.setOptions === 'function') {
            drawingPolyline.value.setOptions({
              strokeColor: '#ff4d4f',
              strokeWeight: highlightStyle.dashed.width,
              strokeDashStyle: 'dash',
            })
          }
        } catch (_) { }
      }
      updatePathPreview(paths)
    } else {
      if (!drawingPolygon.value) {
        drawingPolygon.value = new window.qq.maps.Polygon({
          map: mapInstance.value,
          path: paths,
          strokeColor: '#ff4d4f',
          strokeWeight: highlightStyle.polygon.strokeWidth,
          fillColor: toQqColor(
            highlightStyle.polygon.fillColor,
            highlightStyle.polygon.fillOpacity ?? 1,
          ),
        })
      } else {
        drawingPolygon.value.setPath(paths)
        drawingPolygon.value.setMap(mapInstance.value)
      }
    }
  } else if (window.TMap) {
    ensureDrawingLayers(window.TMap)
    if (formState.type === PATH_TYPE) {
      drawingPolyline.value.setGeometries([{ id: 'drawing', styleId: 'dashed', paths }])
      updatePathPreview(paths)
    } else {
      drawingPolygon.value.setGeometries([{ id: 'drawing', styleId: 'zone', paths }])
    }
  }
  updateVertexMarkers(paths)
}

const createSvgDataUrl = (svg) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`

const DRAW_VERTEX_ICON = createSvgDataUrl(
  "<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'><circle cx='8' cy='8' r='5' fill='%23000000' stroke='%23ffffff' stroke-width='2'/></svg>",
)

const SEARCH_MARKER_ICON = createSvgDataUrl(
  "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='32' viewBox='0 0 24 32'><path d='M12 0C5.372 0 0 5.372 0 12c0 8.25 10.218 18.922 10.651 19.357a1.88 1.88 0 0 0 2.698 0C13.782 30.922 24 20.25 24 12 24 5.372 18.628 0 12 0zm0 17.5a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z' fill='%23256BEB'/></svg>",
)

let cachedVertexMarkerImage = null
let cachedSearchMarkerImage = null

const getQqMarkerImage = (src, width, height, anchorX, anchorY) => {
  try {
    if (
      window.qq &&
      window.qq.maps &&
      typeof window.qq.maps.MarkerImage === 'function' &&
      typeof window.qq.maps.Size === 'function' &&
      typeof window.qq.maps.Point === 'function'
    ) {
      return new window.qq.maps.MarkerImage(
        src,
        new window.qq.maps.Size(width, height),
        new window.qq.maps.Point(0, 0),
        new window.qq.maps.Point(anchorX, anchorY),
        new window.qq.maps.Size(width, height),
      )
    }
  } catch (_) { }
  return src
}

const getVertexMarkerIcon = () => {
  if (!cachedVertexMarkerImage && window.qq && window.qq.maps) {
    cachedVertexMarkerImage = getQqMarkerImage(DRAW_VERTEX_ICON, 16, 16, 8, 8)
  }
  return cachedVertexMarkerImage || DRAW_VERTEX_ICON
}

const getSearchMarkerIcon = () => {
  if (!cachedSearchMarkerImage && window.qq && window.qq.maps) {
    cachedSearchMarkerImage = getQqMarkerImage(SEARCH_MARKER_ICON, 24, 32, 12, 32)
  }
  return cachedSearchMarkerImage || SEARCH_MARKER_ICON
}

let tmapReloadedOnce = false

const patchTMapEnvForCompatibility = () => {
  // 预创建 TMap 命名空间，并准备 SDK 可能依赖的占位对象
  window.TMap = window.TMap || {}
  try {
    // SDK 的鉴权 JSONP 会写入 TMap._svcb.cb<rand>
    window.TMap._svcb = window.TMap._svcb || {}
  } catch (_) { }
  // 标记：即便 window.TMap 存在，也要继续加载脚本
  try {
    window.TMap.__forceReload = true
  } catch (_) { }
  // 开启 lite 模式（SDK 内部会读取该标志以走兼容路径）
  try {
    window.TMap._isLiteMode = true
  } catch (_) { }
  // 在部分内核上禁用 OffscreenCanvas（保留 Worker 不动，避免 “Worker is not a constructor”）
  try {
    if (typeof window.OffscreenCanvas !== 'undefined') {
      try {
        Object.defineProperty(window, 'OffscreenCanvas', { configurable: true, writable: true, value: undefined })
      } catch (_) {
        try {
          window.OffscreenCanvas = undefined
        } catch (_) { }
      }
    }
  } catch (_) { }
}

const removeTencentMapScript = () => {
  try {
    const old = document.getElementById(TMAP_SCRIPT_ID)
    if (old && old.parentNode) old.parentNode.removeChild(old)
  } catch (_) { }
  // 不要把 window.TMap 置为 undefined，避免 JSONP 回调找不到命名空间
  try {
    window.TMap = window.TMap || {}
    window.TMap._svcb = window.TMap._svcb || {}
    window.TMap.__forceReload = true
  } catch (_) { }
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
      } catch (_) { }
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

const createPolygonCloseHintLayer = (TMap) =>
  new TMap.MultiCircle({
    map: mapInstance.value,
    styles: {
      hint: new TMap.CircleStyle({
        color: polygonCloseHintStyle.fillColor,
        borderColor: polygonCloseHintStyle.strokeColor,
        borderWidth: polygonCloseHintStyle.strokeWeight,
        dashArray: [6, 6],
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

const ensurePolygonCloseHintLayer = (TMap) => {
  if (!polygonCloseHintLayer.value) {
    polygonCloseHintLayer.value = createPolygonCloseHintLayer(TMap)
  }
}

const hidePolygonCloseHint = () => {
  try {
    if (polygonCloseHintCircle.value && typeof polygonCloseHintCircle.value.setMap === 'function') {
      polygonCloseHintCircle.value.setMap(null)
    }
  } catch (_) { }
  polygonCloseHintCircle.value = null
  try {
    if (polygonCloseHintRadar.value && typeof polygonCloseHintRadar.value.setMap === 'function') {
      polygonCloseHintRadar.value.setMap(null)
    }
  } catch (_) { }
  polygonCloseHintRadar.value = null
  if (polygonCloseHintLayer.value && typeof polygonCloseHintLayer.value.setGeometries === 'function') {
    try {
      polygonCloseHintLayer.value.setGeometries([])
    } catch (_) { }
  }
}

const clearDrawingOverlays = () => {
  try {
    if (drawingPolyline.value && drawingPolyline.value.setMap) drawingPolyline.value.setMap(null)
  } catch (_) { }
  try {
    if (drawingPolygon.value && drawingPolygon.value.setMap) drawingPolygon.value.setMap(null)
  } catch (_) { }
  try {
    if (drawingCircle.value && drawingCircle.value.setMap) drawingCircle.value.setMap(null)
  } catch (_) { }
  drawingPolyline.value = null
  drawingPolygon.value = null
  drawingCircle.value = null
  if (Array.isArray(drawingMarkerLayer.value)) {
    drawingMarkerLayer.value.forEach((m) => m.setMap && m.setMap(null))
  } else if (drawingMarkerLayer.value && drawingMarkerLayer.value.setGeometries) {
    // GL path fallback
    try { drawingMarkerLayer.value.setGeometries([]) } catch (_) { }
  }
  drawingMarkerLayer.value = []
  drawingPoints.value = []
  drawingStartPoint.value = null
  drawingCenter.value = null
  hidePolygonCloseHint()
}

const stopDrawing = () => {
  detachMapListeners()
  isDrawing.value = false
  currentDrawingMode.value = formState.type
  hidePolygonCloseHint()
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
    if (mapInstance.value && mapRightClickHandler.value) mapInstance.value.off('rightclick', mapRightClickHandler.value)
    if (mapInstance.value && mapZoomChangedHandler.value) mapInstance.value.off('zoom_changed', mapZoomChangedHandler.value)
  } catch (_) { }
  mapClickHandler.value = null
  mapMouseMoveHandler.value = null
  mapMouseUpHandler.value = null
  mapDblClickHandler.value = null
  mapRightClickHandler.value = null
  mapZoomChangedHandler.value = null
  // 2D path
  if (Array.isArray(qqListeners.value)) {
    qqListeners.value.forEach((token) => {
      try { window.qq && window.qq.maps && window.qq.maps.event.removeListener(token) } catch (_) { }
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

const syncPolygonCloseHintOverlay = () => {
  if (!mapInstance.value || drawingPoints.value.length === 0) return
  const firstPoint = drawingPoints.value[0]
  const latLng = normalizeLatLngPoint(firstPoint)
  if (!latLng) return
  const radius = Math.max(getPolygonCloseHitRadiusMeters(firstPoint), 1)
  if (window.qq && window.qq.maps) {
    const { maps } = window.qq
    if (!polygonCloseHintCircle.value) {
      polygonCloseHintCircle.value = new window.qq.maps.Circle({
        map: mapInstance.value,
        center: latLng,
        radius,
        strokeColor: polygonCloseHintStyle.strokeColor,
        strokeWeight: polygonCloseHintStyle.strokeWeight,
        strokeDashStyle: polygonCloseHintStyle.strokeDashStyle,
        fillColor: toQqColor(polygonCloseHintStyle.fillColor, polygonCloseHintStyle.fillOpacity ?? 1),
        fillOpacity: polygonCloseHintStyle.fillOpacity ?? 0.18,
        clickable: false,
      })
    } else {
      try { polygonCloseHintCircle.value.setCenter(latLng) } catch (_) { }
      try { polygonCloseHintCircle.value.setRadius(radius) } catch (_) { }
      try { polygonCloseHintCircle.value.setMap(mapInstance.value) } catch (_) { }
    }
    if (!polygonCloseHintRadar.value) {
      const labelOptions = {
        map: mapInstance.value,
        position: latLng,
        clickable: false,
        zIndex: 999,
        content: POLYGON_CLOSE_HINT_RADAR_HTML,
      }
      if (typeof maps.Size === 'function') {
        const offset = Math.round(POLYGON_CLOSE_RADAR_SIZE_PX / 2)
        labelOptions.offset = new maps.Size(-offset, -offset)
      }
      polygonCloseHintRadar.value = new maps.Label(labelOptions)
      if (typeof polygonCloseHintRadar.value.setStyle === 'function') {
        polygonCloseHintRadar.value.setStyle({
          border: 'none',
          backgroundColor: 'transparent',
          boxShadow: 'none',
          pointerEvents: 'none',
        })
      }
    } else {
      if (typeof polygonCloseHintRadar.value.setPosition === 'function') {
        polygonCloseHintRadar.value.setPosition(latLng)
      }
      if (typeof polygonCloseHintRadar.value.setContent === 'function') {
        polygonCloseHintRadar.value.setContent(POLYGON_CLOSE_HINT_RADAR_HTML)
      }
      if (typeof polygonCloseHintRadar.value.setMap === 'function') {
        polygonCloseHintRadar.value.setMap(mapInstance.value)
      }
    }
    return
  }
  if (typeof window !== 'undefined' && window.TMap) {
    ensurePolygonCloseHintLayer(window.TMap)
    try {
      polygonCloseHintLayer.value.setGeometries([
        { id: 'polygon-close-hint', styleId: 'hint', center: latLng, radius },
      ])
    } catch (_) { }
  }
}

const showPolygonCloseHint = () => {
  syncPolygonCloseHintOverlay()
}

const updateVertexMarkers = (points = drawingPoints.value) => {
  if (!Array.isArray(points)) return
  // try 2D path
  if (window.qq && window.qq.maps) {
    if (!Array.isArray(drawingMarkerLayer.value)) drawingMarkerLayer.value = []
    drawingMarkerLayer.value.forEach((m) => m.setMap && m.setMap(null))
    drawingMarkerLayer.value = []
    const seen = new Set()
    const vertexIcon = getVertexMarkerIcon()
    points.forEach((point) => {
      const latLng = normalizeLatLngPoint(point)
      if (!latLng) return
      const key = `${latLng.getLat()}_${latLng.getLng()}`
      if (seen.has(key)) return
      seen.add(key)
      const markerOptions = { map: mapInstance.value, position: latLng }
      if (vertexIcon) markerOptions.icon = vertexIcon
      const marker = new window.qq.maps.Marker(markerOptions)
      try { marker.setClickable(false) } catch (_) { }
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
  message.info({ content: t('noFlyZone.messages.polygonFinishHint'), key: 'polygon-finish-hint', duration: 3 })

  if (window.qq && window.qq.maps) {
    const clickListener = window.qq.maps.event.addListener(mapInstance.value, 'click', (event) => {
      if (!event?.latLng) return
      const point = event.latLng
      if (drawingPoints.value.length === 0) {
        drawingStartPoint.value = point
        drawingPoints.value.push(point)
        if (drawingPolyline.value && drawingPolyline.value.setMap) drawingPolyline.value.setMap(null)
        updateVertexMarkers()
        showPolygonCloseHint()
        return
      }
      if (shouldClosePolygon(point)) {
        finalizePolygonDrawing()
        return
      }
      drawingPoints.value.push(point)
      updatePolylinePreview()
      updateVertexMarkers()
    })
    qqListeners.value.push(clickListener)
    const moveListener = window.qq.maps.event.addListener(mapInstance.value, 'mousemove', (event) => {
      if (!event?.latLng || !drawingPoints.value.length) return
      updatePolylinePreview(event.latLng)
    })
    qqListeners.value.push(moveListener)
    const dblListener = window.qq.maps.event.addListener(mapInstance.value, 'dblclick', () => finalizePolygonDrawing())
    qqListeners.value.push(dblListener)
    const zoomListener = window.qq.maps.event.addListener(mapInstance.value, 'zoom_changed', () =>
      syncPolygonCloseHintOverlay(),
    )
    qqListeners.value.push(zoomListener)
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
      showPolygonCloseHint()
      return
    }
    if (shouldClosePolygon(point)) {
      finalizePolygonDrawing(TMap)
      return
    }
    drawingPoints.value.push(point)
    updatePolylinePreview()
    updateVertexMarkers()
  }

  mapInstance.value.on('click', mapClickHandler.value)
  mapMouseMoveHandler.value = (event) => {
    if (!event?.latLng || !drawingPoints.value.length) return
    updatePolylinePreview(event.latLng)
  }
  mapDblClickHandler.value = (event) => {
    event?.originalEvent?.preventDefault?.()
    finalizePolygonDrawing()
  }
  mapInstance.value.on('mousemove', mapMouseMoveHandler.value)
  mapInstance.value.on('dblclick', mapDblClickHandler.value)
  mapZoomChangedHandler.value = () => {
    syncPolygonCloseHintOverlay()
  }
  mapInstance.value.on('zoom_changed', mapZoomChangedHandler.value)
}

const setupPathDrawing = () => {
  clearDrawingOverlays()
  resetFormGeometry()
  isDrawing.value = true
  drawingPoints.value = []
  currentDrawingMode.value = PATH_TYPE
  message.info({
    content: t('noFlyZone.messages.pathRightClickHint'),
    key: 'path-finish-hint',
    duration: 3,
  })

  if (window.qq && window.qq.maps) {
    const clickListener = window.qq.maps.event.addListener(mapInstance.value, 'click', (event) => {
      if (!event?.latLng) return
      drawingPoints.value.push(event.latLng)
      updatePolylinePreview()
      updateVertexMarkers()
    })
    qqListeners.value.push(clickListener)
    const moveListener = window.qq.maps.event.addListener(mapInstance.value, 'mousemove', (event) => {
      if (!event?.latLng || !drawingPoints.value.length) return
      updatePolylinePreview(event.latLng)
    })
    qqListeners.value.push(moveListener)
    const dblListener = window.qq.maps.event.addListener(mapInstance.value, 'dblclick', () => finalizePathDrawing())
    qqListeners.value.push(dblListener)
    const rightClickListener = window.qq.maps.event.addListener(mapInstance.value, 'rightclick', (event) => {
      try {
        if (event?.event && typeof event.event.preventDefault === 'function') event.event.preventDefault()
      } catch (_) { }
      try {
        if (event?.domEvent && typeof event.domEvent.preventDefault === 'function') event.domEvent.preventDefault()
      } catch (_) { }
      finalizePathDrawing()
    })
    qqListeners.value.push(rightClickListener)
    return
  }

  mapClickHandler.value = (event) => {
    if (!event?.latLng) return
    drawingPoints.value.push(event.latLng)
    updatePolylinePreview()
    updateVertexMarkers()
  }

  mapMouseMoveHandler.value = (event) => {
    if (!event?.latLng || !drawingPoints.value.length) return
    updatePolylinePreview(event.latLng)
  }

  mapDblClickHandler.value = (event) => {
    event?.originalEvent?.preventDefault?.()
    finalizePathDrawing()
  }

  mapRightClickHandler.value = (event) => {
    event?.originalEvent?.preventDefault?.()
    finalizePathDrawing()
  }

  mapInstance.value.on('click', mapClickHandler.value)
  mapInstance.value.on('mousemove', mapMouseMoveHandler.value)
  mapInstance.value.on('dblclick', mapDblClickHandler.value)
  mapInstance.value.on('rightclick', mapRightClickHandler.value)
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
        fillColor: toQqColor(
          highlightStyle.polygon.fillColor,
          highlightStyle.polygon.fillOpacity ?? 1,
        ),
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

const finalizePathDrawing = (TMap) => {
  if (drawingPoints.value.length < 2) {
    message.warning(t('noFlyZone.messages.pathTooShort'))
    return
  }
  formState.coordinates = drawingPoints.value.map((point) => ({
    latitude: point.getLat(),
    longitude: point.getLng(),
  }))
  updatePathPreview(drawingPoints.value)
  if (window.qq && window.qq.maps) {
    if (!drawingPolyline.value || !drawingPolyline.value.setPath) {
      drawingPolyline.value = new window.qq.maps.Polyline({
        map: mapInstance.value,
        path: drawingPoints.value,
        strokeColor: '#ff4d4f',
        strokeWeight: highlightStyle.dashed.width,
        strokeDashStyle: 'dash',
        clickable: false,
      })
    } else {
      drawingPolyline.value.setPath(drawingPoints.value)
      drawingPolyline.value.setMap(mapInstance.value)
      try {
        if (typeof drawingPolyline.value.setOptions === 'function') {
          drawingPolyline.value.setOptions({
            strokeColor: '#ff4d4f',
            strokeWeight: highlightStyle.dashed.width,
            strokeDashStyle: 'dash',
          })
        }
      } catch (_) { }
    }
  } else if (drawingPolyline.value && drawingPolyline.value.setGeometries) {
    drawingPolyline.value.setGeometries([
      { id: 'drawing', styleId: 'dashed', paths: drawingPoints.value },
    ])
  }
  updateVertexMarkers()
  stopDrawing()
}

const updatePolylinePreview = (cursorPoint = null) => {
  const points = [...drawingPoints.value]
  if (cursorPoint) points.push(cursorPoint)
  if (points.length < 2) {
    if (isPathType(currentDrawingMode.value)) {
      updatePathPreview([])
    }
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
        strokeDashStyle: 'dash',
        clickable: false,
      })
    } else {
      drawingPolyline.value.setPath(points)
      drawingPolyline.value.setMap(mapInstance.value)
      try {
        if (typeof drawingPolyline.value.setOptions === 'function') {
          drawingPolyline.value.setOptions({
            strokeColor: '#ff4d4f',
            strokeWeight: highlightStyle.dashed.width,
            strokeDashStyle: 'dash',
          })
        }
      } catch (_) { }
    }
  } else if (drawingPolyline.value && drawingPolyline.value.setGeometries) {
    drawingPolyline.value.setGeometries([{ id: 'preview', styleId: 'dashed', paths: points }])
  }
  if (isPathType(currentDrawingMode.value)) {
    updatePathPreview(points)
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
          fillColor: toQqColor(
            highlightStyle.polygon.fillColor,
            highlightStyle.polygon.fillOpacity ?? 1,
          ),
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
        fillColor: toQqColor(
          highlightStyle.circle.fillColor,
          highlightStyle.circle.fillOpacity ?? 1,
        ),
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
  } else if (isPathType(formState.type)) {
    setupPathDrawing()
  } else if (formState.type === 'RECTANGLE') {
    setupRectangleDrawing()
  } else {
    setupPolygonDrawing()
  }
}

const finishDrawingManually = () => {
  if (currentDrawingMode.value === 'CIRCLE') {
    applyCircleDrawing()
    return
  }
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
  if (currentDrawingMode.value === PATH_TYPE) {
    finalizePathDrawing()
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
  const payload = {
    name: formState.name.trim(),
    type: formState.type,
    circle: circlePayload,
    effectiveFrom: effectiveFrom ?? undefined,
    effectiveTo: effectiveTo ?? undefined,
  }

  const trimmedWechatLink = formState.wechatLink.trim()
  if (trimmedWechatLink) {
    if (!validateWechatLink(trimmedWechatLink)) {
      message.warning(t('noFlyZone.messages.invalidWechatLink'))
      return null
    }
    payload.wechatLink = trimmedWechatLink
  }

  if (formState.type === PATH_TYPE) {
    const distance = Number(formState.pathDistanceMeters)
    if (!Number.isFinite(distance) || distance <= 0) {
      message.warning(t('noFlyZone.messages.pathDistanceInvalid'))
      return null
    }
    payload.coordinates = coordinatesPayload
    payload.pathDistanceMeters = distance
  } else if (coordinatesPayload.length) {
    payload.coordinates = coordinatesPayload
  } else {
    payload.coordinates = []
  }

  return payload
}

const resolvePathDistance = (zone) => {
  if (!zone) return null
  const direct = Number(zone.pathDistanceMeters)
  if (Number.isFinite(direct) && direct > 0) {
    return direct
  }
  if (Array.isArray(zone.coordinates)) {
    for (const coord of zone.coordinates) {
      const distance = Number(coord?.distanceMeters)
      if (Number.isFinite(distance) && distance > 0) {
        return distance
      }
    }
  }
  return null
}

const loadZoneList = async () => {
  listLoading.value = true
  try {
    const { content, totalElements, page, size } = await listNoFlyZones({
      page: pagination.current,
      size: pagination.pageSize,
    })
    zoneList.value = content.map((item) => ({
      ...item,
      type: normalizeZoneType(item.type),
      pathDistanceMeters: resolvePathDistance(item),
    }))
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
  formState.pathDistanceMeters = PATH_DEFAULT_DISTANCE
  resetFormGeometry()
  clearDrawing()
}

const editZone = (zone) => {
  if (!zone) return
  resetForm()
  formState.id = zone.id
  formState.name = zone.name || ''
  const zoneType = normalizeZoneType(zone.type) || 'POLYGON'
  formState.type = zoneType
  formState.wechatLink = zone.wechatLink || ''
  const pathDistance = resolvePathDistance(zone)
  formState.pathDistanceMeters =
    pathDistance != null ? pathDistance : PATH_DEFAULT_DISTANCE
  const range = formatRangeFromZone(zone)
  formState.timeRange = range.every((value) => value === null) ? [] : range
  if (zoneType === 'CIRCLE' && zone.circle) {
    formState.circle = { ...zone.circle }
  } else if (Array.isArray(zone.coordinates) && zone.coordinates.length) {
    formState.coordinates = zone.coordinates.map((coord) => ({ ...coord }))
  }
  renderFormGeometryOnMap()
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
    const zoneType = normalizeZoneType(zone.type)
    const targetCoordinates =
      zoneType === PATH_TYPE
        ? computePathBufferPolygon(zone.coordinates, zone.pathDistanceMeters)
        : zone.coordinates
    if (!Array.isArray(targetCoordinates) || !targetCoordinates.length) return
    if (window.qq && window.qq.maps) {
      const bounds = new window.qq.maps.LatLngBounds()
      targetCoordinates.forEach((coord) =>
        bounds.extend(new window.qq.maps.LatLng(coord.latitude, coord.longitude)),
      )
      mapInstance.value.fitBounds(bounds)
    } else {
      const bounds = new window.TMap.LatLngBounds()
      targetCoordinates.forEach((coord) =>
        bounds.extend(new window.TMap.LatLng(coord.latitude, coord.longitude)),
      )
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
          fillColor: toQqColor(
            highlightStyle.circle.fillColor,
            highlightStyle.circle.fillOpacity ?? 1,
          ),
          clickable: false,
        })
        zoneCircleOverlays.value.push(circle)
      }
    } else if (zone.type === PATH_TYPE && Array.isArray(zone.coordinates) && zone.coordinates.length) {
      const pathPolygon = computePathBufferPolygon(zone.coordinates, zone.pathDistanceMeters)
      if (window.qq && window.qq.maps && pathPolygon.length) {
        const polygon = new window.qq.maps.Polygon({
          map: mapInstance.value,
          path: pathPolygon.map((coord) => new window.qq.maps.LatLng(coord.latitude, coord.longitude)),
          strokeColor: '#ff4d4f',
          strokeWeight: highlightStyle.polygon.strokeWidth,
          fillColor: toQqColor(
            highlightStyle.polygon.fillColor,
            highlightStyle.polygon.fillOpacity ?? 1,
          ),
          clickable: false,
        })
        zonePolygonOverlays.value.push(polygon)
      }
    } else if (Array.isArray(zone.coordinates) && zone.coordinates.length) {
      if (window.qq && window.qq.maps) {
        const polygon = new window.qq.maps.Polygon({
          map: mapInstance.value,
          path: zone.coordinates.map((coord) => new window.qq.maps.LatLng(coord.latitude, coord.longitude)),
          strokeColor: '#ff4d4f',
          strokeWeight: highlightStyle.polygon.strokeWidth,
          fillColor: toQqColor(
            highlightStyle.polygon.fillColor,
            highlightStyle.polygon.fillOpacity ?? 1,
          ),
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

const getPolygonCloseHitRadiusMeters = (referencePoint = drawingPoints.value[0]) => {
  const fallback = DEFAULT_CLOSE_HIT_METERS
  if (!referencePoint) return fallback
  const latLng = formatCoordinatePoint(referencePoint)
  if (!latLng) return fallback
  const map = mapInstance.value
  if (!map || typeof map.getZoom !== 'function') return fallback
  const zoomLevel = Number(map.getZoom())
  if (!Number.isFinite(zoomLevel)) return fallback
  const meters = pixelsToMetersAtLatitude(latLng.latitude, zoomLevel, POLYGON_CLOSE_HITBOX_PX)
  if (!Number.isFinite(meters) || meters <= 0) {
    return fallback
  }
  return meters
}

const shouldClosePolygon = (point) => {
  if (!point || drawingPoints.value.length < POLYGON_MIN_POINTS) return false
  const threshold = getPolygonCloseHitRadiusMeters()
  if (!Number.isFinite(threshold) || threshold <= 0) return false
  const firstPoint = drawingPoints.value[0]
  return calculateDistanceMeters(firstPoint, point) <= threshold
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
  const normalized = normalizeZoneType(type)
  const option = typeOptions.value.find((item) => item.value === normalized)
  return option?.label || normalized
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
    if (formState.type === PATH_TYPE) {
      const distance = Number(formState.pathDistanceMeters)
      if (!Number.isFinite(distance) || distance <= 0) {
        formState.pathDistanceMeters = PATH_DEFAULT_DISTANCE
      }
    } else {
      updatePathPreview([])
    }
  },
  { flush: 'sync' },
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
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
    searchDebounceTimer = null
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

watch(drawingRadius, (radius) => {
  if (!mapReady.value || formState.type !== 'CIRCLE') return
  if (!isDrawing.value && formState.circle) {
    formState.circle.radiusMeters = radius
  }
  updateCirclePreview()
})

watch(
  () => formState.pathDistanceMeters,
  () => {
    if (!mapReady.value || formState.type !== PATH_TYPE) return
    updatePathPreview()
  },
)

watch(
  () => ({
    type: formState.type,
    coordinates: formState.coordinates,
    circle: formState.circle,
  }),
  () => {
    if (!mapReady.value || isDrawing.value) return
    renderFormGeometryOnMap()
  },
  { deep: true },
)

const clearSearchMarker = () => {
  try {
    if (searchMarker.value && typeof searchMarker.value.setMap === 'function') {
      searchMarker.value.setMap(null)
    }
  } catch (_) { }
  searchMarker.value = null
  if (searchMarkerLayer.value && typeof searchMarkerLayer.value.setGeometries === 'function') {
    try {
      searchMarkerLayer.value.setGeometries([])
    } catch (_) { }
  }
}

const centerMapOnResult = (result) => {
  if (!mapReady.value || !mapInstance.value) {
    message.warning(t('noFlyZone.search.mapNotReady'))
    return
  }
  const lat = Number(result?.location?.lat)
  const lng = Number(result?.location?.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    message.warning(t('noFlyZone.search.noResult'))
    return
  }
  const isQqMap = !!(window.qq && window.qq.maps)
  const hasTMap = typeof window !== 'undefined' && window.TMap && typeof window.TMap.LatLng === 'function'
  if (!isQqMap && !hasTMap) {
    message.warning(t('noFlyZone.search.mapNotReady'))
    return
  }
  const position = isQqMap
    ? new window.qq.maps.LatLng(lat, lng)
    : new window.TMap.LatLng(lat, lng)

  if (isQqMap) {
    if (searchMarker.value) {
      try { searchMarker.value.setMap(null) } catch (_) { }
    }
    const icon = getSearchMarkerIcon()
    const markerOptions = { map: mapInstance.value, position }
    if (icon) markerOptions.icon = icon
    searchMarker.value = new window.qq.maps.Marker(markerOptions)
  } else if (hasTMap) {
    ensureSearchLayer(window.TMap)
    try {
      searchMarkerLayer.value.setGeometries([{ id: 'search-result', styleId: 'result', position }])
    } catch (error) {
      console.error('Failed to render search marker', error)
    }
  }
  if (typeof mapInstance.value.setCenter === 'function') {
    mapInstance.value.setCenter(position)
  }
  if (typeof mapInstance.value.getZoom === 'function' && mapInstance.value.getZoom() < 14) {
    if (typeof mapInstance.value.setZoom === 'function') {
      mapInstance.value.setZoom(14)
    }
  }
}

const fetchSearchSuggestions = async (keyword) => {
  if (!mapReady.value || !mapInstance.value) {
    searchLoading.value = false
    return
  }
  try {
    let centerLocation = null
    if (typeof mapInstance.value.getCenter === 'function') {
      const center = mapInstance.value.getCenter()
      const lat = Number(center?.lat ?? center?.getLat?.())
      const lng = Number(center?.lng ?? center?.getLng?.())
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        centerLocation = { lat, lng }
      }
    }
    const results = await searchPlaces(keyword, centerLocation)
    searchResults.value = results
      .map((item, index) => {
        const location = item?.location
        const lat = Number(location?.lat)
        const lng = Number(location?.lng)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
        const title = item?.title || item?.name || keyword
        const address = item?.address || item?.district || item?.city || ''
        const key = item?.id || item?.uid || `${lat},${lng}-${index}`
        return {
          key,
          title,
          address,
          label: address ? `${title} · ${address}` : title,
          location: { lat, lng },
        }
      })
      .filter(Boolean)
  } catch (error) {
    console.error('Failed to search address', error)
    if (error?.code === 'NO_RESULT') {
      searchResults.value = []
    } else {
      message.error(t('noFlyZone.search.error'))
    }
  } finally {
    searchLoading.value = false
  }
}

const handleSearchInput = (value) => {
  const trimmed = (value ?? '').toString().trim()
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
    searchDebounceTimer = null
  }
  if (!trimmed) {
    searchResults.value = []
    searchLoading.value = false
    clearSearchMarker()
    return
  }
  if (!mapReady.value || !mapInstance.value) {
    message.warning(t('noFlyZone.search.mapNotReady'))
    return
  }
  searchLoading.value = true
  searchDebounceTimer = setTimeout(() => {
    fetchSearchSuggestions(trimmed)
    searchDebounceTimer = null
  }, 350)
}

const handleSelectSearchOption = (value) => {
  const result = searchResults.value.find((item) => item.key === value)
  if (!result) return
  searchQuery.value = result.title
  centerMapOnResult(result)
}

const handleSearchEnter = () => {
  const firstResult = searchResults.value[0]
  if (firstResult) {
    searchQuery.value = firstResult.title
    centerMapOnResult(firstResult)
  } else if (searchQuery.value.trim()) {
    message.warning(t('noFlyZone.search.noResult'))
  }
}

const handleSearchClear = () => {
  searchResults.value = []
  clearSearchMarker()
}
</script>

<template>
  <div class="no-fly-zone-manager">
    <div class="manager-content">
      <a-card class="control-panel" :bordered="false">
        <a-form layout="vertical" class="zone-form">
          <a-form-item>
            <template #label>
              <span class="form-item-label form-item-label--required">
                <span class="form-item-label__asterisk">*</span>
                {{ t('noFlyZone.form.type') }}
              </span>
            </template>
            <a-radio-group v-model:value="formState.type" :disabled="disableFormDuringDrawing">
              <a-radio-button v-for="option in typeOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </a-radio-button>
            </a-radio-group>
          </a-form-item>
          <a-form-item v-if="isPathMode">
            <template #label>
              <span class="form-item-label form-item-label--required">
                <span class="form-item-label__asterisk">*</span>
                {{ t('noFlyZone.form.edgeDistance') }}
              </span>
            </template>
            <a-input-number v-model:value="formState.pathDistanceMeters" :min="10" :step="10"
              :disabled="disableFormDuringDrawing" :addon-after="t('noFlyZone.form.radiusUnit')"
              :placeholder="t('noFlyZone.form.edgeDistancePlaceholder')" class="radius-input" />
            <p class="form-hint">{{ t('noFlyZone.form.edgeDistanceHint') }}</p>
          </a-form-item>
          <a-form-item v-if="isCircleMode">
            <template #label>
              <span class="form-item-label form-item-label--required">
                <span class="form-item-label__asterisk">*</span>
                {{ t('noFlyZone.form.circleRadius') }}
              </span>
            </template>
            <a-input-number v-model:value="drawingRadius" :min="CIRCLE_MIN_RADIUS" :step="50" class="radius-input"
              :addon-after="t('noFlyZone.form.radiusUnit')" :disabled="disableFormDuringDrawing && !isCircleMode" />
            <p class="form-hint">{{ t('noFlyZone.form.circleHint') }}</p>
          </a-form-item>
          <a-form-item v-if="isCircleMode">
            <template #label>
              <span class="form-item-label form-item-label--required">
                <span class="form-item-label__asterisk">*</span>
                {{ t('noFlyZone.form.circleCenter') }}
              </span>
            </template>
            <div class="circle-center-inputs">
              <a-input-number v-model:value="circleCenterLatitude" :min="LATITUDE_MIN" :max="LATITUDE_MAX"
                :precision="6" :step="0.000001" class="coordinate-input"
                :placeholder="t('noFlyZone.form.latitudePlaceholder')" :disabled="disableFormDuringDrawing" />
              <a-input-number v-model:value="circleCenterLongitude" :min="LONGITUDE_MIN" :max="LONGITUDE_MAX"
                :precision="6" :step="0.000001" class="coordinate-input"
                :placeholder="t('noFlyZone.form.longitudePlaceholder')" :disabled="disableFormDuringDrawing" />
            </div>
            <p class="form-hint">{{ t('noFlyZone.form.circleCenterHint') }}</p>
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
              <!-- <a-button v-if="isCircleMode" type="default" :disabled="!isDrawing" @click="applyCircleDrawing">
                {{ t('noFlyZone.actions.applyCircle') }}
              </a-button> -->
            </a-space>
          </div>
          <a-form-item>
            <template #label>
              <span class="form-item-label form-item-label--required">
                <span class="form-item-label__asterisk">*</span>
                {{ t('noFlyZone.form.coordinatesLabel') }}
              </span>
            </template>
            <a-alert :message="t('noFlyZone.form.coordinatesHint')" type="info" show-icon class="coordinate-alert" />
            <a-table class="coordinate-table" size="small" :columns="coordinateColumns"
              :data-source="displayedCoordinates" :pagination="false" :row-key="(record) => record.key"
              :locale="{ emptyText: t('noFlyZone.form.coordinatesEmpty') }">
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'values'">
                  <div class="coordinate-value">
                    <span class="coordinate-value__label">{{ t('noFlyZone.form.latitude') }}</span>
                    <div class="coordinate-value__control">
                      <template v-if="record.editable">
                        <a-input-number :value="record.latitude" :min="LATITUDE_MIN" :max="LATITUDE_MAX" :precision="6"
                          :step="0.000001" class="coordinate-input" :disabled="!manualCoordinateEditingEnabled"
                          @update:value="(value) => handleManualCoordinateChange(record.index, 'latitude', value)" />
                      </template>
                      <template v-else>
                        {{ formatCoordinateValue(record.latitude) }}
                      </template>
                    </div>
                  </div>
                  <div class="coordinate-value">
                    <span class="coordinate-value__label">{{ t('noFlyZone.form.longitude') }}</span>
                    <div class="coordinate-value__control">
                      <template v-if="record.editable">
                        <a-input-number :value="record.longitude" :min="LONGITUDE_MIN" :max="LONGITUDE_MAX"
                          :precision="6" :step="0.000001" class="coordinate-input"
                          :disabled="!manualCoordinateEditingEnabled"
                          @update:value="(value) => handleManualCoordinateChange(record.index, 'longitude', value)" />
                      </template>
                      <template v-else>
                        {{ formatCoordinateValue(record.longitude) }}
                      </template>
                    </div>
                  </div>
                </template>
                <template v-else-if="column.key === 'actions'">
                  <a-button v-if="record.editable" type="text" danger size="small"
                    :disabled="!manualCoordinateEditingEnabled" @click="removeManualCoordinate(record.index)">
                    {{ t('noFlyZone.form.removeCoordinate') }}
                  </a-button>
                </template>
              </template>
            </a-table>
            <div v-if="!isCircleMode" class="coordinate-actions">
              <a-button size="small" type="dashed" :disabled="!manualCoordinateEditingEnabled"
                @click="addManualCoordinate">
                {{ t('noFlyZone.form.addCoordinate') }}
              </a-button>
            </div>
            <p v-if="!isCircleMode" class="form-hint coordinate-hint">{{ coordinateManualHintText }}</p>
            <div v-if="isCircleMode && displayedCircleRadius !== null" class="radius-display">
              {{ t('noFlyZone.form.radiusDisplay', { radius: displayedCircleRadius }) }}
            </div>
          </a-form-item>
          <a-form-item :label="t('noFlyZone.form.timeRange')">
            <a-range-picker v-model:value="formState.timeRange" format="YYYY-MM-DD HH:mm:ss"
              value-format="YYYY-MM-DD HH:mm:ss" show-time allow-clear :disabled="disableFormDuringDrawing" />
          </a-form-item>
          <a-form-item>
            <template #label>
              <span class="form-item-label form-item-label--required">
                <span class="form-item-label__asterisk">*</span>
                {{ t('noFlyZone.form.name') }}
              </span>
            </template>
            <a-input v-model:value="formState.name" :placeholder="t('noFlyZone.form.namePlaceholder')"
              :disabled="disableFormDuringDrawing" />
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
            <a-auto-complete v-model:value="searchQuery" :options="searchOptions" :loading="searchLoading"
              :disabled="!mapReady" allow-clear class="map-search-input" @search="handleSearchInput"
              @select="handleSelectSearchOption" @clear="handleSearchClear">
              <template #default>
                <a-input :placeholder="t('noFlyZone.search.placeholder')" @pressEnter="handleSearchEnter" />
              </template>
              <template #notFoundContent>
                <div class="map-search-empty">
                  {{
                    searchLoading
                      ? t('noFlyZone.search.loading')
                      : searchQuery.trim()
                        ? t('noFlyZone.search.noResult')
                        : t('noFlyZone.search.inputHint')
                  }}
                </div>
              </template>
            </a-auto-complete>
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

.form-item-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.form-item-label__asterisk {
  color: #ff4d4f;
}

.radius-input {
  width: 100%;
}

.circle-center-inputs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.coordinate-input {
  width: 100%;
}

.coordinate-value {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.coordinate-value+.coordinate-value {
  margin-top: 4px;
}

.coordinate-value__label {
  flex: 0 0 auto;
  min-width: 25px;
  color: #6b7280;
  white-space: nowrap;
}

.coordinate-value__control {
  flex: 1 1 auto;
  min-width: 0;
}

:deep(.coordinate-table .ant-table-cell) {
  vertical-align: top;
}

.coordinate-actions {
  margin-top: 8px;
  display: flex;
  justify-content: flex-end;
}

.coordinate-hint {
  margin-top: 4px;
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
  height: 600px;
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

.map-search-input {
  width: 100%;
}

.map-search-empty {
  padding: 8px 12px;
  color: #6b7280;
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

/* radar animation styles moved to global block below */

:deep(.ant-table-tbody > tr > td) {
  vertical-align: middle;
}

@media (max-width: 1200px) {
  .manager-content {
    grid-template-columns: 1fr;
  }

  .map-container {
    height: 420px;
  }
}
</style>

<style>
.polygon-close-radar {
  position: absolute;
  left: 0;
  top: 0;
  width: var(--polygon-close-radar-size, 48px);
  height: var(--polygon-close-radar-size, 48px);
  pointer-events: none;
}

.polygon-close-radar__ring {
  position: absolute;
  left: 50%;
  top: 50%;
  width: calc(var(--polygon-close-radar-size, 48px) * 0.55);
  height: calc(var(--polygon-close-radar-size, 48px) * 0.55);
  border-radius: 50%;
  transform: translate(-50%, -50%) scale(0.35);
  background: radial-gradient(circle, rgba(76, 175, 80, 0.45) 0%, rgba(76, 175, 80, 0.05) 65%);
  border: 8px solid rgba(0, 200, 83, 0.9);
  box-shadow: 0 0 12px rgba(0, 200, 83, 0.35);
  opacity: 0;
  animation: polygon-close-radar-pulse 1.2s linear infinite;
}

.polygon-close-radar__ring--delay {
  animation-delay: 1.8s;
}

.polygon-close-radar__ring--delay2 {
  animation-delay: 3.6s;
}

.polygon-close-radar__core {
  position: absolute;
  left: 50%;
  top: 50%;
  width: var(--polygon-close-radar-core-size, 12px);
  height: var(--polygon-close-radar-core-size, 12px);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  background-color: #00c853;
  box-shadow: 0 0 16px rgba(0, 200, 83, 0.65);
}

@keyframes polygon-close-radar-pulse {
  0% {
    transform: translate(-50%, -50%) scale(0.35);
    opacity: 0.85;
  }

  70% {
    opacity: 0.3;
  }

  100% {
    transform: translate(-50%, -50%) scale(1.4);
    opacity: 0;
  }
}
</style>
