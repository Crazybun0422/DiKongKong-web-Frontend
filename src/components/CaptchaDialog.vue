<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { message } from 'ant-design-vue'
import http from '../services/http'

const props = defineProps({
  visible: { type: Boolean, default: false },
  username: { type: String, default: '' },
  password: { type: String, default: '' },
})

const emit = defineEmits(['update:visible', 'login-success'])

const { t } = useI18n()

const captchaId = ref('')
const pieceY = ref(0)
const pieceWidth = ref(0)
const pieceHeight = ref(0)
const maxLeft = ref(0)
const currentX = ref(0)
const isVerifying = ref(false)

const bgDataUrl = ref('')
const pieceDataUrl = ref('')

const pieceImg = ref(null)
const slider = ref(null)
const captchaContainer = ref(null)

const showHint = computed(
  () => props.visible && !isVerifying.value && currentX.value === 0,
)

const extractErrorMessage = (error) => {
  const fallback = t('messages.requestFailed')
  const data = error?.response?.data
  if (!data) {
    return error?.message || fallback
  }
  if (typeof data === 'string') {
    return data
  }
  if (data.msg) {
    return data.msg
  }
  if (typeof data.message === 'string') {
    return data.message
  }
  if (data.message && typeof data.message === 'object') {
    return Object.values(data.message).join('、')
  }
  return fallback
}

const resetSliderBackground = () => {
  if (slider.value) {
    slider.value.style.backgroundPosition = '0% 0'
  }
}

const updateSliderBackground = (value) => {
  if (!slider.value || maxLeft.value <= 0) return
  const percent = value / maxLeft.value
  const posX = -percent * 100
  slider.value.style.backgroundPosition = `${posX}% 0`
}

const computeMaxLeft = () => {
  const containerW = captchaContainer.value?.clientWidth || 0
  const pieceW = pieceImg.value?.clientWidth || pieceWidth.value || 0
  maxLeft.value = Math.max(0, containerW - pieceW)
  if (slider.value) {
    slider.value.min = 0
    slider.value.max = maxLeft.value
    slider.value.step = 1
    slider.value.value = 0
  }
  currentX.value = 0
  updateSliderBackground(0)
}

const positionPiece = () => {
  if (pieceImg.value) {
    pieceImg.value.style.top = `${pieceY.value}px`
    pieceImg.value.style.left = '0px'
  }
}

const loadCaptcha = async () => {
  isVerifying.value = false
  currentX.value = 0
  resetSliderBackground()
  try {
    const { data } = await http.get('/captcha/init')
    const json = data?.data || data
    captchaId.value = json?.captchaId || ''
    pieceY.value = (json?.pieceY || 0) - 1
    pieceWidth.value = json?.pieceWidth || 0
    pieceHeight.value = json?.pieceHeight || 0
    const bg = json?.bgImage
    const piece = json?.pieceImage
    bgDataUrl.value = bg ? `data:image/png;base64,${bg}` : ''
    pieceDataUrl.value = piece ? `data:image/png;base64,${piece}` : ''
    await nextTick()
    positionPiece()
    computeMaxLeft()
  } catch (error) {
    console.error('Captcha init failed', error)
    message.error(extractErrorMessage(error))
  }
}

const updatePieceDimensions = () => {
  if (pieceImg.value) {
    if (pieceWidth.value) {
      pieceImg.value.style.width = `${pieceWidth.value}px`
    }
    if (pieceHeight.value) {
      pieceImg.value.style.height = `${pieceHeight.value}px`
    }
  }
}

const onSliding = (event) => {
  const value = Number(event.target.value) || 0
  currentX.value = value
  if (pieceImg.value) {
    pieceImg.value.style.left = `${value}px`
  }
  updateSliderBackground(value)
}

const attemptAdminLogin = async () => {
  if (!props.username || !props.password) {
    message.error(t('auth.missingCredentials'))
    emit('update:visible', false)
    return
  }
  try {
    const { data } = await http.post('/auth/login', {
      username: props.username,
      password: props.password,
    })
    emit('login-success', data)
    emit('update:visible', false)
  } catch (error) {
    message.error(extractErrorMessage(error))
    await loadCaptcha()
  }
}

const onSlideChange = async () => {
  if (isVerifying.value || !captchaId.value) return
  isVerifying.value = true
  try {
    const payload = {
      captchaId: captchaId.value,
      userX: currentX.value,
    }
    if (props.username) {
      payload.username = props.username
    }
    const { data } = await http.post('/captcha/validate', payload)
    const res = data?.data || data
    if (res?.pass) {
      await attemptAdminLogin()
    } else {
      message.error(t('captcha.failed'))
      await loadCaptcha()
    }
  } catch (error) {
    message.error(extractErrorMessage(error))
    await loadCaptcha()
  } finally {
    isVerifying.value = false
  }
}

const abort = () => {
  emit('update:visible', false)
}

watch(
  () => props.visible,
  (val) => {
    if (val) {
      nextTick(loadCaptcha)
    }
  },
)

onMounted(() => {
  if (props.visible) {
    loadCaptcha()
  }
})
</script>

<template>
  <div v-if="visible" class="overlay">
    <div class="dialog">
      <h3 class="title">{{ t('captcha.title') }}</h3>
      <div class="captcha-container" ref="captchaContainer">
        <img
          v-if="bgDataUrl"
          class="bg"
          :src="bgDataUrl"
          alt="captcha background"
          @load="computeMaxLeft"
        />
        <img
          v-if="pieceDataUrl"
          ref="pieceImg"
          class="piece"
          :src="pieceDataUrl"
          alt="captcha piece"
          @load="
            updatePieceDimensions();
            positionPiece();
            computeMaxLeft();
          "
        />
        <div v-if="isVerifying" class="verifying-mask">{{ t('captcha.verifying') }}</div>
      </div>

      <div class="slider-wrapper" :class="{ hint: showHint }">
        <input
          ref="slider"
          class="slider"
          type="range"
          :min="0"
          :max="maxLeft"
          v-model.number="currentX"
          @input="onSliding"
          @change="onSlideChange"
        />
      </div>

      <button class="close-btn" type="button" @click="abort">
        {{ t('captcha.close') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.45);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.dialog {
  width: 340px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  padding: 16px;
  position: relative;
}

.title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  text-align: center;
  margin-bottom: 12px;
}

.captcha-container {
  position: relative;
  width: 300px;
  height: 75px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  overflow: hidden;
  user-select: none;
  margin: 0 auto 12px;
  background-color: #f9f9f9;
}

.bg {
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}

.piece {
  position: absolute;
  top: 0;
  left: 0;
  cursor: grab;
  user-select: none;
  z-index: 2;
}

.verifying-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.75);
  color: #0c1e55;
  font-size: 14px;
}

.slider-wrapper {
  position: relative;
  width: 300px;
  height: 36px;
  margin: 0 auto 12px;
  user-select: none;
  overflow: hidden;
}

.slider {
  -webkit-appearance: none;
  width: 100%;
  height: 40px;
  background: transparent;
  outline: none;
  cursor: pointer;
  position: relative;
  z-index: 4;
}

.slider::-webkit-slider-runnable-track {
  height: 8px;
  background: transparent;
  margin-top: 1px;
  border: none;
}

.slider::-moz-range-track {
  height: 8px;
  background: transparent;
  border: none;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid #666;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  margin-top: -10px;
  transition: background 0.2s, border-color 0.2s, transform 0.1s;
  position: relative;
  z-index: 4;
}

.slider::-moz-range-thumb {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid #666;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  margin-top: -10px;
  transition: background 0.2s, border-color 0.2s, transform 0.1s;
  position: relative;
  z-index: 4;
}

.slider::-webkit-slider-thumb:hover {
  background: #f5f5f5;
  border-color: #444;
}

.slider::-moz-range-thumb:hover {
  background: #f5f5f5;
  border-color: #444;
}

.slider:active::-webkit-slider-thumb {
  background: #ececec;
  border-color: #333;
  transform: scale(1.1);
}

.slider:active::-moz-range-thumb {
  background: #ececec;
  border-color: #333;
  transform: scale(1.1);
}

.slider-wrapper.hint::before {
  content: '';
  position: absolute;
  top: 17px;
  left: 0;
  width: 100%;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  z-index: 3;
}

.slider-wrapper.hint::after {
  content: '';
  position: absolute;
  top: 17px;
  left: 20%;
  width: 40%;
  height: 7px;
  background: #fee5a3;
  border-radius: 2px;
  animation: hintSweep 3s infinite;
  z-index: 3;
}

.close-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  border: none;
  background: transparent;
  font-size: 14px;
  cursor: pointer;
  color: #999;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #333;
}

.slider-wrapper.hint .slider {
  background-image: linear-gradient(90deg, rgba(255, 255, 255, 0) 0, rgba(255, 255, 255, 0) 100%);
}

@keyframes hintSweep {
  0% {
    left: 10%;
  }

  100% {
    left: 130%;
  }
}
</style>
