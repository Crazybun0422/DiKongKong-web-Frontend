<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { fetchMarkers, MARKER_REVIEW_STATUS } from '../../services/markers'

const { t } = useI18n()
const router = useRouter()

const pendingCount = ref(0)
const loading = ref(false)

const loadPendingCount = async () => {
  loading.value = true
  try {
    const { totalElements } = await fetchMarkers({
      page: 1,
      size: 1,
      status: MARKER_REVIEW_STATUS.PENDING,
    })
    pendingCount.value = totalElements ?? 0
  } catch (error) {
    console.error('Failed to load pending markers count', error)
  } finally {
    loading.value = false
  }
}

const goToPendingMarkers = () => {
  router.push({
    name: 'airspace',
    query: { status: MARKER_REVIEW_STATUS.PENDING },
  }).catch(() => {})
}

onMounted(() => {
  loadPendingCount()
})
</script>

<template>
  <div class="home-wrapper">
    <button class="summary-card" type="button" @click="goToPendingMarkers">
      <span class="value">{{ loading ? '...' : pendingCount }}</span>
      <span class="label">
        {{ t('dashboard.pending') }}
        <span aria-hidden="true"> ></span>
      </span>
    </button>
  </div>
</template>

<style scoped>
.home-wrapper {
  min-height: 320px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding-left: clamp(24px, 10vw, 72px);
}

.summary-card {
  width: 240px;
  height: 160px;
  background: #ffffff;
  border-radius: 18px;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  color: #111827;
  cursor: pointer;
  border: none;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.summary-card:focus-visible {
  outline: 3px solid rgba(99, 102, 241, 0.4);
}

.summary-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.18);
}

.value {
  font-size: 3rem;
  font-weight: 600;
}

.label {
  font-size: 0.95rem;
  color: #1f3d99;
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
