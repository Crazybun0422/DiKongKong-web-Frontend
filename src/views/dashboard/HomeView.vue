<script setup>
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div class="home-wrapper">
    <div class="summary-card">
      <span class="value">1</span>
      <span class="label">{{ t('dashboard.pending') }} ></span>
    </div>
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
}

.value {
  font-size: 3rem;
  font-weight: 600;
}

.label {
  font-size: 0.95rem;
  color: #1f3d99;
}
</style>
