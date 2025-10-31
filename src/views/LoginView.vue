<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AdminAuthPanel from '../components/AdminAuthPanel.vue'
import backgroundImage from '../assets/img/bg.png'

const { t } = useI18n()

const backgroundStyle = computed(() => ({
  backgroundImage:
    `linear-gradient(135deg, rgba(31, 124, 255, 0.22), rgba(45, 194, 255, 0.08)), url(${backgroundImage})`,
}))
</script>

<template>
  <div class="auth-page" :style="backgroundStyle">
    <header class="brand">
      <span class="brand-text">{{ t('app.brand') }}</span>
    </header>
    <main class="auth-main">
      <AdminAuthPanel />
    </main>
  </div>
</template>

<style scoped>
.auth-page {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 5rem 2rem;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.brand {
  position: fixed;
  top: 2.5rem;
  left: 3rem;
  z-index: 5;
  color: #f4f8ff;
  letter-spacing: 0.08em;
  font-size: 2.25rem;
  font-weight: 600;
}

.brand-text {
  display: inline-block;
}

.auth-main {
  position: relative;
  z-index: 1;
  width: min(420px, 100%);
  margin-left: auto;
  margin-right: 6rem;
}

.auth-main::before {
  content: '';
  position: absolute;
  inset: -5px;
  border-radius: 32px;
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.22);
  box-shadow: 0 18px 48px rgba(14, 42, 102, 0.18);
  z-index: -1;
  pointer-events: none;
}

@media (max-width: 768px) {
  .auth-page {
    padding: 3.5rem 1.25rem;
    justify-content: center;
  }

  .brand {
    left: 2.5rem;
    top: 3rem;
  }

  .auth-main {
    margin-right: 0;
    margin-left: 0;
  }

  .auth-main::before {
    inset: -18px;
    border-radius: 28px;
  }
}

@media (max-width: 480px) {
  .auth-main::before {
    inset: -12px;
    border-radius: 24px;
  }

  .brand {
    font-size: 1rem;
  }
}
</style>
