<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { EditOutlined, DeleteOutlined, EnvironmentOutlined } from '@ant-design/icons-vue'
import { useI18n } from 'vue-i18n'
import { MARKER_REVIEW_STATUS, fetchMarkers } from '../../services/markers'
import {
  createNoFlyZone,
  deleteNoFlyZone,
  listNoFlyZones,
  updateNoFlyZone,
} from '../../services/noFlyZones'

const TENCENT_MAP_KEY = 'GEDBZ-R36KT-S52XJ-LTI4K-WWZK7-USFNP'
const TENCENT_MAP_CITY_ID = '350100'
const TMAP_SCRIPT_ID = 'tmap-gl-script'
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
  { label: t('noFlyZone.types.rectangle'), value: 'RECTANGLE' },
  { label: t('noFlyZone.types.polyline'), value: 'POLYLINE' },
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
  return Array.isArray(formState.coordinates) && formState.coordinates.length > 0
})

const isCircleMode = computed(() => formState.type === 'CIRCLE')

const isPolygonMode = computed(() => formState.type === 'POLYGON' || formState.type === 'RECTANGLE')

const drawButtonDisabled = computed(() => !mapReady.value || isDrawing.value)

const disableSubmit = computed(() => !hasDrawnGeometry.value || !formState.name.trim() || !formState.wechatLink.trim())

const disableFormDuringDrawing = computed(() => isDrawing.value)

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
    width: 3,
  },
  dashed: {
    color: '#ff4d4f',
    width: 2,
    dashArray: [10, 6],
  },
}

const formatDecimalCoordinate = (value) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return ''
  return num.toFixed(6)
}

const normalizePoint = (point) => {
  if (!point) return null
  if (typeof point.getLat === 'function' && typeof point.getLng === 'function') {
    return {
      latitude: point.getLat(),
      longitude: point.getLng(),
    }
  }
  const latitude = point.latitude ?? point.lat
  const longitude = point.longitude ?? point.lng
  if (latitude == null || longitude == null) {
    return null
  }
  return {
    latitude: Number(latitude),
    longitude: Number(longitude),
  }
}

const coordinateColumns = computed(() => [
  {
    title: t('noFlyZone.form.coordinatesIndex'),
    dataIndex: 'label',
    key: 'label',
    width: 100,
  },
  {
    title: t('noFlyZone.form.coordinatesValue'),
    dataIndex: 'value',
    key: 'value',
  },
])

const displayedCoordinates = computed(() => {
  if (isCircleMode.value) {
    const centerPoint = isDrawing.value && currentDrawingMode.value === 'CIRCLE'
      ? normalizePoint(drawingCenter.value)
      : normalizePoint(formState.circle)
    if (!centerPoint) return []
    return [
      {
        key: 'center',
        label: t('noFlyZone.form.coordinatesCenter'),
        value: `${formatDecimalCoordinate(centerPoint.longitude)}, ${formatDecimalCoordinate(centerPoint.latitude)}`,
      },
    ]
  }

  const sourcePoints = []
  if (isDrawing.value && drawingPoints.value.length) {
    drawingPoints.value.forEach((point, index) => {
      const normalized = normalizePoint(point)
      if (normalized) {
        sourcePoints.push({ ...normalized, index })
      }
    })
  } else if (Array.isArray(formState.coordinates) && formState.coordinates.length) {
    formState.coordinates.forEach((coord, index) => {
      const normalized = normalizePoint(coord)
      if (normalized) {
        sourcePoints.push({ ...normalized, index })
      }
    })
  }

  return sourcePoints.map((point, index) => ({
    key: `${index}`,
    label: `${index + 1}`,
    value: `${formatDecimalCoordinate(point.longitude)}, ${formatDecimalCoordinate(point.latitude)}`,
  }))
})

const displayedCircleRadius = computed(() => {
  if (!isCircleMode.value) return null
  if (isDrawing.value && currentDrawingMode.value === 'CIRCLE') {
    return drawingRadius.value
  }
  if (formState.circle?.radiusMeters != null) {
    return Number(formState.circle.radiusMeters)
  }
  return null
})

const loadTencentMapScript = () => {
  if (window.TMap) return Promise.resolve(window.TMap)
  if (document.getElementById(TMAP_SCRIPT_ID)) {
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
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.id = TMAP_SCRIPT_ID
    const callbackName = '__tmap_init_callback__'
    script.src = `https://map.qq.com/api/gljs?v=1.exp&libraries=tools,geometry&key=${TENCENT_MAP_KEY}&id=${TENCENT_MAP_CITY_ID}&callback=${callbackName}`
    script.async = true
    script.onerror = () => reject(new Error('Failed to load Tencent Map script'))
    window[callbackName] = () => {
      resolve(window.TMap)
      delete window[callbackName]
    }
    document.head.appendChild(script)
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

const clearDrawingOverlays = () => {
  if (drawingPolyline.value) {
    drawingPolyline.value.setGeometries([])
  }
  if (drawingPolygon.value) {
    drawingPolygon.value.setGeometries([])
  }
  if (drawingCircle.value) {
    drawingCircle.value.setGeometries([])
  }
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
  if (!mapInstance.value) return
  if (mapClickHandler.value) {
    mapInstance.value.off('click', mapClickHandler.value)
    mapClickHandler.value = null
  }
  if (mapMouseMoveHandler.value) {
    mapInstance.value.off('mousemove', mapMouseMoveHandler.value)
    mapMouseMoveHandler.value = null
  }
  if (mapMouseUpHandler.value) {
    mapInstance.value.off('mouseup', mapMouseUpHandler.value)
    mapMouseUpHandler.value = null
  }
  if (mapDblClickHandler.value) {
    mapInstance.value.off('dblclick', mapDblClickHandler.value)
    mapDblClickHandler.value = null
  }
}

const setupPolygonDrawing = (TMap) => {
  clearDrawingOverlays()
  resetFormGeometry()
  isDrawing.value = true
  drawingPoints.value = []
  currentDrawingMode.value = 'POLYGON'

  mapClickHandler.value = (event) => {
    if (!event?.latLng) return
    const point = event.latLng
    if (drawingPoints.value.length === 0) {
      drawingStartPoint.value = point
      drawingPoints.value.push(point)
      drawingPolyline.value.setGeometries([])
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
  }

  mapInstance.value.on('click', mapClickHandler.value)
  mapMouseMoveHandler.value = (event) => {
    if (!event?.latLng || !drawingPoints.value.length) return
    updatePathPreview(event.latLng)
  }
  mapDblClickHandler.value = (event) => {
    event?.originalEvent?.preventDefault?.()
    finalizePolygonDrawing(TMap)
  }
  mapInstance.value.on('mousemove', mapMouseMoveHandler.value)
  mapInstance.value.on('dblclick', mapDblClickHandler.value)
}

const setupPolylineDrawing = (TMap) => {
  clearDrawingOverlays()
  resetFormGeometry()
  isDrawing.value = true
  drawingPoints.value = []
  currentDrawingMode.value = 'POLYLINE'

  mapClickHandler.value = (event) => {
    if (!event?.latLng) return
    drawingPoints.value.push(event.latLng)
    updatePathPreview()
  }

  mapMouseMoveHandler.value = (event) => {
    if (!event?.latLng || !drawingPoints.value.length) return
    updatePathPreview(event.latLng)
  }

  mapDblClickHandler.value = (event) => {
    event?.originalEvent?.preventDefault?.()
    finalizePolylineDrawing(TMap)
  }

  mapInstance.value.on('click', mapClickHandler.value)
  mapInstance.value.on('mousemove', mapMouseMoveHandler.value)
  mapInstance.value.on('dblclick', mapDblClickHandler.value)
    updatePolygonPreview()
  }

  mapInstance.value.on('click', mapClickHandler.value)
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
  drawingPolygon.value.setGeometries([
    {
      id: 'drawing',
      styleId: 'zone',
      paths: drawingPoints.value,
    },
  ])
  drawingPolyline.value.setGeometries([])
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
  drawingPolyline.value.setGeometries([
    {
      id: 'drawing',
      styleId: 'solid',
      paths: drawingPoints.value,
    },
  ])
  stopDrawing()
}

const updatePathPreview = (cursorPoint = null) => {
  if (!drawingPolyline.value) return
  const points = [...drawingPoints.value]
  if (cursorPoint) {
    points.push(cursorPoint)
  }
  if (points.length < 2) {
const updatePolygonPreview = () => {
  if (!drawingPolyline.value) return
  if (drawingPoints.value.length < 2) {
    drawingPolyline.value.setGeometries([])
    return
  }
  drawingPolyline.value.setGeometries([
    {
      id: 'preview',
      styleId: 'dashed',
      paths: points,
      paths: drawingPoints.value,
    },
  ])
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
    drawingPolygon.value.setGeometries([
      {
        id: 'drawing',
        styleId: 'zone',
        paths: bounds,
      },
    ])
  }

  mapClickHandler.value = (event) => {
    if (!event?.latLng) return
    if (!drawingStartPoint.value) {
      drawingStartPoint.value = event.latLng
      isMouseDown = true
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
    stopDrawing()
    isMouseDown = false
  }

  mapInstance.value.on('click', mapClickHandler.value)
  mapInstance.value.on('mousemove', mapMouseMoveHandler.value)
  mapInstance.value.on('mouseup', mapMouseUpHandler.value)
}

const setupCircleDrawing = (TMap) => {
  clearDrawingOverlays()
  resetFormGeometry()
  isDrawing.value = true
  currentDrawingMode.value = 'CIRCLE'
  drawingRadius.value = Math.max(drawingRadius.value || CIRCLE_MIN_RADIUS, CIRCLE_MIN_RADIUS)

  mapClickHandler.value = (event) => {
    if (!event?.latLng) return
    drawingCenter.value = event.latLng
    updateCirclePreview(TMap)
  }

  mapInstance.value.on('click', mapClickHandler.value)
}

const updateCirclePreview = (TMap) => {
  if (!drawingCenter.value) return
  ensureDrawingLayers(TMap)
  drawingCircle.value.setGeometries([
    {
      id: 'drawing',
      styleId: 'zone',
      center: drawingCenter.value,
      radius: drawingRadius.value,
    },
  ])
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
  stopDrawing()
}

const startDrawing = async () => {
  if (!mapReady.value) return
  const TMap = window.TMap
  ensureDrawingLayers(TMap)
  detachMapListeners()
  clearDrawingOverlays()
  resetFormGeometry()

  if (formState.type === 'CIRCLE') {
    setupCircleDrawing(TMap)
  } else if (formState.type === 'RECTANGLE') {
    setupRectangleDrawing(TMap)
  } else if (formState.type === 'POLYLINE') {
    setupPolylineDrawing(TMap)
  } else {
    setupPolygonDrawing(TMap)
  }
}

const finishDrawingManually = () => {
const finishPolygonManually = () => {
  if (currentDrawingMode.value === 'RECTANGLE') {
    if (!drawingPoints.value.length) {
      message.warning(t('noFlyZone.messages.rectangleIncomplete'))
      return
    }
    formState.coordinates = drawingPoints.value.map((point) => ({
      latitude: point.getLat(),
      longitude: point.getLng(),
    }))
    stopDrawing()
    return
  }
  if (currentDrawingMode.value === 'POLYLINE') {
    finalizePolylineDrawing(window.TMap)
    return
  }
  const TMap = window.TMap
  finalizePolygonDrawing(TMap)
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
    drawingCenter.value = new window.TMap.LatLng(zone.circle.latitude, zone.circle.longitude)
    drawingRadius.value = zone.circle.radiusMeters
    ensureDrawingLayers(window.TMap)
    drawingCircle.value.setGeometries([
      {
        id: 'drawing',
        styleId: 'zone',
        center: drawingCenter.value,
        radius: drawingRadius.value,
      },
    ])
  } else if (Array.isArray(zone.coordinates) && zone.coordinates.length) {
    formState.coordinates = zone.coordinates.map((coord) => ({ ...coord }))
    ensureDrawingLayers(window.TMap)
    const paths = zone.coordinates.map((coord) => new window.TMap.LatLng(coord.latitude, coord.longitude))
    if (zone.type === 'POLYLINE') {
      drawingPolyline.value.setGeometries([
        {
          id: 'drawing',
          styleId: 'solid',
          paths,
        },
      ])
    } else {
      drawingPolygon.value.setGeometries([
        {
          id: 'drawing',
          styleId: 'zone',
          paths,
        },
      ])
    }
    drawingPolygon.value.setGeometries([
      {
        id: 'drawing',
        styleId: 'zone',
        paths: zone.coordinates.map((coord) => new window.TMap.LatLng(coord.latitude, coord.longitude)),
      },
    ])
  }
  focusZoneOnMap(zone)
}

const focusZoneOnMap = (zone) => {
  if (!mapInstance.value || !zone) return
  if (zone.type === 'CIRCLE' && zone.circle) {
    const center = new window.TMap.LatLng(zone.circle.latitude, zone.circle.longitude)
    mapInstance.value.setCenter(center)
    mapInstance.value.setZoom(Math.max(Math.min(Math.round(18 - Math.log2(zone.circle.radiusMeters / 100)), 17), 12))
  } else if (Array.isArray(zone.coordinates) && zone.coordinates.length) {
    const bounds = new window.TMap.LatLngBounds()
    zone.coordinates.forEach((coord) => {
      bounds.extend(new window.TMap.LatLng(coord.latitude, coord.longitude))
    })
    mapInstance.value.fitBounds(bounds)
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
  if (!mapInstance.value || !window.TMap) return
  ensureZoneLayers(window.TMap)
  const polygonGeometries = []
  const circleGeometries = []
  const polylineGeometries = []
  zoneList.value.forEach((zone) => {
    if (zone.type === 'CIRCLE' && zone.circle) {
      circleGeometries.push({
        id: zone.id,
        styleId: 'zone',
        center: new window.TMap.LatLng(zone.circle.latitude, zone.circle.longitude),
        radius: zone.circle.radiusMeters,
      })
    } else if (zone.type === 'POLYLINE' && Array.isArray(zone.coordinates) && zone.coordinates.length) {
      polylineGeometries.push({
        id: zone.id,
        styleId: 'zone',
        paths: zone.coordinates.map(
          (coord) => new window.TMap.LatLng(coord.latitude, coord.longitude),
        ),
      })
    } else if (Array.isArray(zone.coordinates) && zone.coordinates.length) {
      polygonGeometries.push({
        id: zone.id,
        styleId: 'zone',
        paths: zone.coordinates.map(
          (coord) => new window.TMap.LatLng(coord.latitude, coord.longitude),
        ),
      })
    }
  })
  zonePolygonLayer.value.setGeometries(polygonGeometries)
  zoneCircleLayer.value.setGeometries(circleGeometries)
  if (zonePolylineLayer.value) {
    zonePolylineLayer.value.setGeometries(polylineGeometries)
  }
}

const loadMerchantMarkers = async () => {
  if (!mapInstance.value) return
  try {
    const { content } = await fetchMarkers({
      page: 1,
      size: 100,
      status: MARKER_REVIEW_STATUS.APPROVED,
    })
    const geometries = []
    content.forEach((marker, index) => {
      const latitude = marker?.location?.latitude
      const longitude = marker?.location?.longitude
      if (typeof latitude === 'number' && typeof longitude === 'number') {
        geometries.push({
          id: marker.id || `marker-${index}`,
          position: new window.TMap.LatLng(latitude, longitude),
        })
      }
    })
    if (!merchantMarkerLayer.value) {
      merchantMarkerLayer.value = new window.TMap.MultiMarker({
        map: mapInstance.value,
        styles: {
          merchant: new window.TMap.MarkerStyle({
            width: 18,
            height: 18,
            src: 'https://mapapi.qq.com/web/lbs/javascriptGL/demo/img/markerDefault.png',
          }),
        },
        geometries,
      })
    } else {
      merchantMarkerLayer.value.setGeometries(geometries)
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
    mapInstance.value = new TMap.Map(container, {
      zoom: MAP_DEFAULT_ZOOM,
      center: new TMap.LatLng(MAP_DEFAULT_CENTER.latitude, MAP_DEFAULT_CENTER.longitude),
    })
    ensureDrawingLayers(TMap)
    ensureZoneLayers(TMap)
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

watch(
  () => drawingRadius.value,
  () => {
    if (isDrawing.value && currentDrawingMode.value === 'CIRCLE' && window.TMap) {
      updateCirclePreview(window.TMap)
    }
  },
)

onMounted(() => {
  initializeMap()
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
</script>

<template>
  <div class="no-fly-zone-manager">
    <div class="manager-content">
      <a-card class="control-panel" :bordered="false">
        <a-form layout="vertical" class="zone-form">
          <a-form-item :label="t('noFlyZone.form.name')">
            <a-input
              v-model:value="formState.name"
              :placeholder="t('noFlyZone.form.namePlaceholder')"
              :disabled="disableFormDuringDrawing"
            />
          </a-form-item>
          <a-form-item :label="t('noFlyZone.form.type')">
            <a-radio-group v-model:value="formState.type" :disabled="disableFormDuringDrawing">
            <a-input v-model:value="formState.name" :placeholder="t('noFlyZone.form.namePlaceholder')" />
          </a-form-item>
          <a-form-item :label="t('noFlyZone.form.type')">
            <a-radio-group v-model:value="formState.type">
              <a-radio-button v-for="option in typeOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </a-radio-button>
            </a-radio-group>
          </a-form-item>
          <a-form-item v-if="isCircleMode" :label="t('noFlyZone.form.circleRadius')">
            <a-input-number
              v-model:value="drawingRadius"
              :min="CIRCLE_MIN_RADIUS"
              :step="50"
              class="radius-input"
              :addon-after="t('noFlyZone.form.radiusUnit')"
              :disabled="disableFormDuringDrawing"
            />
            <a-input-number v-model:value="drawingRadius" :min="CIRCLE_MIN_RADIUS" :step="50" class="radius-input"
              :addon-after="t('noFlyZone.form.radiusUnit')" />
            <p class="form-hint">{{ t('noFlyZone.form.circleHint') }}</p>
          </a-form-item>
          <div class="drawing-actions">
            <a-space>
              <a-button type="primary" :disabled="drawButtonDisabled" @click="startDrawing">
                {{ isDrawing ? t('noFlyZone.actions.drawing') : t('noFlyZone.actions.startDrawing') }}
              </a-button>
              <a-button :disabled="!isDrawing" @click="finishDrawingManually">
              <a-button :disabled="!isDrawing" @click="finishPolygonManually">
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
            <a-table
              class="coordinate-table"
              size="small"
              :columns="coordinateColumns"
              :data-source="displayedCoordinates"
              :pagination="false"
              :row-key="(record) => record.key"
              :locale="{ emptyText: t('noFlyZone.form.coordinatesEmpty') }"
            />
            <div v-if="isCircleMode && displayedCircleRadius !== null" class="radius-display">
              {{ t('noFlyZone.form.radiusDisplay', { radius: displayedCircleRadius }) }}
            </div>
          </a-form-item>
          <a-form-item :label="t('noFlyZone.form.timeRange')">
            <a-range-picker
              v-model:value="formState.timeRange"
              format="YYYY-MM-DD HH:mm:ss"
              value-format="YYYY-MM-DD HH:mm:ss"
              show-time
              allow-clear
              :disabled="disableFormDuringDrawing"
            />
          </a-form-item>
          <a-form-item :label="t('noFlyZone.form.wechatLink')">
            <a-input
              v-model:value="formState.wechatLink"
              :placeholder="t('noFlyZone.form.wechatPlaceholder')"
              :disabled="disableFormDuringDrawing"
            />
          </a-form-item>
          <a-space class="form-actions">
            <a-button
              type="primary"
              :loading="formSubmitting"
              :disabled="disableFormDuringDrawing || disableSubmit"
              @click="handleSubmit"
            >
              {{ formState.id ? t('noFlyZone.actions.update') : t('noFlyZone.actions.create') }}
            </a-button>
            <a-button :disabled="formSubmitting || disableFormDuringDrawing" @click="resetToCreateMode">
          <a-form-item :label="t('noFlyZone.form.timeRange')">
            <a-range-picker v-model:value="formState.timeRange" format="YYYY-MM-DD HH:mm:ss"
              value-format="YYYY-MM-DD HH:mm:ss" show-time allow-clear />
          </a-form-item>
          <a-form-item :label="t('noFlyZone.form.wechatLink')">
            <a-input v-model:value="formState.wechatLink" :placeholder="t('noFlyZone.form.wechatPlaceholder')" />
          </a-form-item>
          <a-space class="form-actions">
            <a-button type="primary" :loading="formSubmitting" :disabled="disableSubmit" @click="handleSubmit">
              {{ formState.id ? t('noFlyZone.actions.update') : t('noFlyZone.actions.create') }}
            </a-button>
            <a-button :disabled="formSubmitting" @click="resetToCreateMode">
              {{ t('noFlyZone.actions.reset') }}
            </a-button>
          </a-space>
        </a-form>
      </a-card>
      <a-card class="map-panel" :bordered="false">
        <div ref="mapContainer" class="map-container">
          <div v-if="!mapReady" class="map-placeholder">
            <a-spin :spinning="true" />
            <span>{{ t('noFlyZone.messages.mapLoading') }}</span>
          </div>
        </div>
      </a-card>
    </div>

    <a-card class="zone-table-card" :bordered="false">
      <a-table :columns="tableColumns" :data-source="zoneList" :row-key="(record) => record.id"
        :loading="listLoading" :pagination="{
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
                <a-button shape="circle" type="text" @click="highlightZone(record)">
                  <EnvironmentOutlined />
                </a-button>
              </a-tooltip>
              <a-tooltip :title="t('noFlyZone.actions.edit')">
                <a-button shape="circle" type="text" :disabled="isDrawing" @click="editZone(record)">
                <a-button shape="circle" type="text" @click="editZone(record)">
                  <EditOutlined />
                </a-button>
              </a-tooltip>
              <a-tooltip :title="t('noFlyZone.actions.delete')">
                <a-button shape="circle" danger type="text" :disabled="isDrawing" @click="deleteZone(record)">
                <a-button shape="circle" danger type="text" @click="deleteZone(record)">
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

.coordinate-alert {
  margin-bottom: 8px;
}

.coordinate-table {
  margin-top: 8px;
}

.coordinate-table :deep(.ant-table-body) {
  max-height: 200px;
  overflow-y: auto;
}

.radius-display {
  margin-top: 6px;
  font-size: 13px;
  color: #ef4444;
}

.map-container {
  position: relative;
  width: 100%;
  height: 460px;
  border-radius: 12px;
  overflow: hidden;
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
