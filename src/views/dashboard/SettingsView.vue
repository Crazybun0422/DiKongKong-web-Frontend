<script setup>
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div class="placeholder">
    <h2>{{ t('navigation.settings') }}</h2>
    <p>Coming soon...</p>
  </div>
</template>

<style scoped>
.placeholder {
  min-height: 320px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 0.75rem;
  color: #1f2937;
}

h2 {
  margin: 0;
}
</style>
