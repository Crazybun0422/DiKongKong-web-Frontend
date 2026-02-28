<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  map: { type: Object, default: null },
  mapReady: { type: Boolean, default: false },
})
const emit = defineEmits(['anchors-change'])

const ANCHOR_COLOR = '#1f7aff'
const STROKE_OPACITY = 0.95
const FILL_OPACITY = 0.3

const drawing = ref(false)
const points = ref([])
const mapClickListener = ref(null)
const polygonOverlay = ref(null)

const canUseMap = computed(() => props.mapReady && !!props.map && !!window.qq?.maps?.event)

const clearPolygonOverlay = () => {
  if (!polygonOverlay.value) return
  try {
    polygonOverlay.value.setMap(null)
  } catch (error) {
    // ignore
  }
  polygonOverlay.value = null
}

const clearAnchors = () => {
  points.value = []
  clearPolygonOverlay()
}

const toLatLng = (point) => new window.qq.maps.LatLng(point.latitude, point.longitude)

const toQqColor = (value, opacity = 1) => {
  const toRgb = (input) => {
    if (typeof input !== 'string') return null
    const hex = input.trim().replace('#', '')
    if (/^[0-9a-fA-F]{6}$/.test(hex)) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      }
    }
    const m = input.match(/^rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
    if (m) {
      return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) }
    }
    return null
  }

  const rgb = toRgb(value)
  if (window.qq?.maps?.Color && rgb) {
    const clamp = (v) => Math.max(0, Math.min(255, Number.isFinite(v) ? v : 0))
    const a = Math.max(0, Math.min(1, Number(opacity)))
    return new window.qq.maps.Color(clamp(rgb.r), clamp(rgb.g), clamp(rgb.b), a)
  }
  return value
}

const syncPolygon = () => {
  if (!props.map || !window.qq?.maps?.Polygon || !window.qq?.maps?.LatLng) return
  if (points.value.length < 3) {
    clearPolygonOverlay()
    return
  }
  const path = points.value.map((point) => toLatLng(point))
  if (polygonOverlay.value && typeof polygonOverlay.value.setPath === 'function') {
    polygonOverlay.value.setPath(path)
    polygonOverlay.value.setMap(props.map)
    return
  }
  clearPolygonOverlay()
  polygonOverlay.value = new window.qq.maps.Polygon({
    map: props.map,
    path,
    strokeColor: toQqColor(ANCHOR_COLOR, STROKE_OPACITY),
    strokeWeight: 2,
    strokeOpacity: STROKE_OPACITY,
    fillColor: toQqColor(ANCHOR_COLOR, FILL_OPACITY),
    fillOpacity: FILL_OPACITY,
    zIndex: 2,
  })
}

const detachMapClick = () => {
  if (!mapClickListener.value) return
  try {
    window.qq?.maps?.event?.removeListener?.(mapClickListener.value)
  } catch (error) {
    // ignore
  }
  mapClickListener.value = null
}

const addAnchorPoint = (event) => {
  if (!drawing.value) return
  const latLng = event?.latLng
  const latitude = Number(latLng?.getLat?.())
  const longitude = Number(latLng?.getLng?.())
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return
  points.value.push({ latitude, longitude })
}

const attachMapClick = () => {
  if (!drawing.value || !canUseMap.value || mapClickListener.value) return
  mapClickListener.value = window.qq.maps.event.addListener(props.map, 'click', addAnchorPoint)
}

const toggleDrawing = () => {
  if (!canUseMap.value) return
  drawing.value = !drawing.value
}

watch(
  () => props.map,
  (nextMap, prevMap) => {
    if (prevMap && prevMap !== nextMap) {
      clearPolygonOverlay()
      detachMapClick()
    }
    if (nextMap) {
      syncPolygon()
      if (drawing.value && canUseMap.value) {
        attachMapClick()
      }
    }
  },
)

watch(
  () => [props.mapReady, drawing.value],
  () => {
    if (drawing.value && canUseMap.value) {
      attachMapClick()
      return
    }
    detachMapClick()
  },
)

watch(
  () => points.value.length,
  () => syncPolygon(),
)

watch(
  () => points.value.map((point) => `${point.latitude},${point.longitude}`).join('|'),
  () => {
    emit(
      'anchors-change',
      points.value.map((point) => ({ ...point })),
    )
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  detachMapClick()
  clearAnchors()
  emit('anchors-change', [])
})
</script>

<template>
  <div class="anchor-draw-control">
    <button class="anchor-btn" type="button" :disabled="!canUseMap" @click="toggleDrawing">
      {{ drawing ? '结束锚点' : '锚点绘制' }}
    </button>
    <button class="anchor-btn anchor-btn--clear" type="button" :disabled="!points.length" @click="clearAnchors">
      清除锚点
    </button>
  </div>
</template>

<style scoped>
.anchor-draw-control {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 12px;
  background: rgba(12, 18, 32, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(8px);
}

.anchor-btn {
  border: none;
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 700;
  color: #f8fbff;
  background: rgba(31, 122, 255, 0.92);
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
}

.anchor-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 16px rgba(31, 122, 255, 0.35);
}

.anchor-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.anchor-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.anchor-btn--clear {
  background: rgba(17, 24, 39, 0.9);
}
</style>
