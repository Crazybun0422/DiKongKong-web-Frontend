<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  visible: { type: Boolean, default: false },
  src: { type: String, default: '' },
})

const emit = defineEmits(['confirm', 'cancel', 'clear'])
const { t } = useI18n()

const containerSize = 300
const imageRef = ref(null)
const imageLoaded = ref(false)
const previewData = ref('')

const state = reactive({
  baseWidth: 0,
  baseHeight: 0,
  minZoom: 1,
  maxZoom: 3,
  zoom: 1,
  x: 0,
  y: 0,
})

const sliderValue = ref(0)

const dragging = ref(false)
let dragOrigin = { x: 0, y: 0 }

const imgStyle = computed(() => ({
  width: `${state.baseWidth}px`,
  height: `${state.baseHeight}px`,
  transform: `translate(${state.x}px, ${state.y}px) scale(${state.zoom})`,
  transformOrigin: '0 0',
  cursor: dragging.value ? 'grabbing' : 'grab',
}))

const resetAll = () => {
  state.baseWidth = 0
  state.baseHeight = 0
  state.minZoom = 1
  state.maxZoom = 3
  state.zoom = 1
  state.x = 0
  state.y = 0
  sliderValue.value = 0
  previewData.value = ''
  imageLoaded.value = false
}

const clampPosition = () => {
  const displayWidth = state.baseWidth * state.zoom
  const displayHeight = state.baseHeight * state.zoom
  const minX = Math.min(0, containerSize - displayWidth)
  const minY = Math.min(0, containerSize - displayHeight)
  const maxX = displayWidth <= containerSize ? (containerSize - displayWidth) / 2 : 0
  const maxY = displayHeight <= containerSize ? (containerSize - displayHeight) / 2 : 0

  if (displayWidth <= containerSize) {
    state.x = (containerSize - displayWidth) / 2
  } else {
    state.x = Math.max(minX, Math.min(maxX, state.x))
  }
  if (displayHeight <= containerSize) {
    state.y = (containerSize - displayHeight) / 2
  } else {
    state.y = Math.max(minY, Math.min(maxY, state.y))
  }
}

const updatePreview = () => {
  if (!imageLoaded.value || !imageRef.value) {
    previewData.value = ''
    return
  }
  const imgEl = imageRef.value
  const canvas = document.createElement('canvas')
  canvas.width = containerSize
  canvas.height = containerSize
  const ctx = canvas.getContext('2d')
  const ratio = imgEl.naturalWidth / state.baseWidth
  const sx = (-state.x / state.zoom) * ratio
  const sy = (-state.y / state.zoom) * ratio
  const sSize = (containerSize / state.zoom) * ratio
  ctx.beginPath()
  ctx.arc(containerSize / 2, containerSize / 2, containerSize / 2, 0, Math.PI * 2, true)
  ctx.closePath()
  ctx.clip()
  ctx.drawImage(imgEl, sx, sy, sSize, sSize, 0, 0, containerSize, containerSize)
  previewData.value = canvas.toDataURL('image/png')
}

const loadImage = (el, src) =>
  new Promise((resolve) => {
    const cleanup = () => {
      el.removeEventListener('load', onLoad)
      el.removeEventListener('error', onLoad)
    }
    const onLoad = () => {
      cleanup()
      resolve()
    }
    el.addEventListener('load', onLoad, { once: true })
    el.addEventListener('error', onLoad, { once: true })
    el.src = ''
    el.src = src
  })

const initializeImage = () => {
  const imgEl = imageRef.value
  if (!imgEl) return

  const naturalWidth = imgEl.naturalWidth || imgEl.width || containerSize
  const naturalHeight = imgEl.naturalHeight || imgEl.height || containerSize

  state.baseWidth = naturalWidth
  state.baseHeight = naturalHeight

  const coverZoom = Math.max(
    containerSize / state.baseWidth,
    containerSize / state.baseHeight,
  )
  state.minZoom = Math.max(coverZoom, 0.1)
  state.maxZoom = Math.max(3, state.minZoom * 2.5)
  state.zoom = state.minZoom
  sliderValue.value = 0

  state.x = (containerSize - state.baseWidth * state.zoom) / 2
  state.y = (containerSize - state.baseHeight * state.zoom) / 2
  clampPosition()
  imageLoaded.value = true
  updatePreview()
}

const startDrag = (event) => {
  if (!imageLoaded.value) return
  dragging.value = true
  dragOrigin = {
    x: event.clientX - state.x,
    y: event.clientY - state.y,
  }
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}

const onDrag = (event) => {
  if (!dragging.value) return
  state.x = event.clientX - dragOrigin.x
  state.y = event.clientY - dragOrigin.y
  clampPosition()
  updatePreview()
}

const stopDrag = () => {
  dragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

const handleWheel = (event) => {
  if (!imageLoaded.value) return
  event.preventDefault()
  const delta = event.deltaY < 0 ? 0.1 : -0.1
  const nextZoom = Math.min(
    state.maxZoom,
    Math.max(state.minZoom, state.zoom + delta),
  )
  if (nextZoom === state.zoom) return
  const rect = event.currentTarget.getBoundingClientRect()
  const offsetX = event.clientX - rect.left - state.x
  const offsetY = event.clientY - rect.top - state.y
  const ratio = nextZoom / state.zoom
  state.x -= offsetX * (ratio - 1)
  state.y -= offsetY * (ratio - 1)
  state.zoom = nextZoom
  clampPosition()
  sliderValue.value = Math.round(
    ((state.zoom - state.minZoom) / (state.maxZoom - state.minZoom || 1)) * 100,
  )
  updatePreview()
}

const handleSlider = (value) => {
  if (!imageLoaded.value) return
  sliderValue.value = value
  const ratio = state.minZoom + ((state.maxZoom - state.minZoom) * value) / 100
  const centerX = containerSize / 2 - state.x
  const centerY = containerSize / 2 - state.y
  const scaleRatio = ratio / state.zoom
  state.x -= centerX * (scaleRatio - 1)
  state.y -= centerY * (scaleRatio - 1)
  state.zoom = ratio
  clampPosition()
  updatePreview()
}

const createCroppedBlob = () =>
  new Promise((resolve, reject) => {
    if (!imageLoaded.value || !imageRef.value) {
      resolve(null)
      return
    }
    const imgEl = imageRef.value
    const canvas = document.createElement('canvas')
    canvas.width = containerSize
    canvas.height = containerSize
    const ctx = canvas.getContext('2d')
    const ratio = imgEl.naturalWidth / state.baseWidth
    const sx = (-state.x / state.zoom) * ratio
    const sy = (-state.y / state.zoom) * ratio
    const sSize = (containerSize / state.zoom) * ratio
    ctx.beginPath()
    ctx.arc(containerSize / 2, containerSize / 2, containerSize / 2, 0, Math.PI * 2, true)
    ctx.closePath()
    ctx.clip()
    ctx.drawImage(imgEl, sx, sy, sSize, sSize, 0, 0, containerSize, containerSize)
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Failed to generate avatar'))
    }, 'image/png')
  })

const handleConfirm = async () => {
  try {
    const blob = await createCroppedBlob()
    emit('confirm', blob)
  } catch (error) {
    emit('confirm', null)
  }
}

const handleCancel = () => {
  stopDrag()
  resetAll()
  emit('cancel')
}

const handleClear = () => {
  stopDrag()
  resetAll()
  emit('clear')
}

watch(
  () => props.visible,
  async (visible) => {
    if (visible && props.src) {
      await nextTick()
      const imgEl = imageRef.value
      if (imgEl) {
        stopDrag()
        await loadImage(imgEl, props.src)
        initializeImage()
      }
    } else if (!visible) {
      stopDrag()
      resetAll()
    }
  },
)

watch(
  () => props.src,
  async (src) => {
    if (props.visible && src) {
      await nextTick()
      const imgEl = imageRef.value
      if (imgEl) {
        stopDrag()
        await loadImage(imgEl, src)
        initializeImage()
      }
    } else if (!src) {
      resetAll()
    }
  },
)

onBeforeUnmount(() => {
  stopDrag()
})
</script>

<template>
  <a-modal
    :open="visible"
    :footer="null"
    width="720"
    centered
    class="avatar-cropper-modal"
    @cancel="handleCancel"
  >
    <div class="modal-header">
      <h3>{{ t('profile.cropTitle') }}</h3>
      <p>{{ t('profile.cropSubTitle') }}</p>
    </div>
    <div class="modal-body">
      <div class="stage" @wheel.prevent="handleWheel">
        <div class="stage-inner">
          <img
            v-if="visible && src"
            ref="imageRef"
            :src="src"
            :style="imgStyle"
            alt="avatar source"
            @mousedown.prevent="startDrag"
            @dragstart.prevent
          />
          <div class="stage-mask"></div>
        </div>
      </div>
      <div class="sidebar">
        <div class="preview-card">
          <span class="preview-title">{{ t('profile.previewTitle') }}</span>
          <div class="preview-circle">
            <img v-if="previewData" :src="previewData" alt="avatar preview" />
          </div>
          <span class="preview-desc">{{ t('profile.previewSubtitle') }}</span>
        </div>
        <div class="slider-card">
          <label>{{ t('profile.zoomLabel') }}</label>
          <a-slider
            v-model:value="sliderValue"
            :min="0"
            :max="100"
            :tooltip-open="false"
            @change="handleSlider"
            @input="handleSlider"
          />
        </div>
        <div class="actions">
          <a-button type="default" @click="handleClear">
            {{ t('profile.reset') }}
          </a-button>
          <a-button type="primary" @click="handleConfirm">
            {{ t('profile.confirmCrop') }}
          </a-button>
        </div>
      </div>
    </div>
  </a-modal>
</template>

<style scoped>
.avatar-cropper-modal :deep(.ant-modal-content) {
  border-radius: 24px;
  padding: 24px 32px;
}

.modal-header {
  text-align: center;
}

.modal-header h3 {
  margin: 0;
  font-weight: 600;
  font-size: 18px;
  color: #0f172a;
}

.modal-header p {
  margin: 6px 0 0;
  font-size: 14px;
  color: #64748b;
}

.modal-body {
  margin-top: 24px;
  display: flex;
  gap: 24px;
}

.stage {
  width: 340px;
  height: 340px;
  border-radius: 26px;
  background: #0f172a;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stage-inner {
  position: relative;
  width: 300px;
  height: 300px;
  border-radius: 50%;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.stage-inner img {
  position: absolute;
  top: 0;
  left: 0;
  user-select: none;
}

.stage-mask {
  position: absolute;
  inset: -1px;
  border-radius: 50%;
  box-shadow: 0 0 0 9999px rgba(11, 18, 33, 0.7);
  pointer-events: none;
}

.sidebar {
  width: 220px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.preview-card,
.slider-card {
  padding: 18px;
  border-radius: 16px;
  background: linear-gradient(160deg, rgba(229, 244, 255, 0.65), rgba(228, 237, 255, 0.4));
  border: 1px solid rgba(145, 196, 255, 0.32);
  box-shadow: 0 16px 30px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(6px);
}

.preview-title {
  display: block;
  font-weight: 600;
  color: #0f172a;
  margin-bottom: 12px;
}

.preview-circle {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: #ffffff;
  margin: 0 auto;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.preview-circle img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-desc {
  display: block;
  text-align: center;
  font-size: 13px;
  color: #64748b;
}

.slider-card label {
  display: block;
  font-weight: 600;
  margin-bottom: 12px;
  color: #0f172a;
}

.actions {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: auto;
}
</style>
