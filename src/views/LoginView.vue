<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AdminAuthPanel from '../components/AdminAuthPanel.vue'
import backgroundImage from '../assets/img/bg.png'
import brandLogo from '../assets/img/dkk.png'

const { t } = useI18n()

const backgroundStyle = computed(() => ({
  backgroundImage:
    `linear-gradient(135deg, rgba(31, 124, 255, 0.22), rgba(45, 194, 255, 0.08)), url(${backgroundImage})`,
}))
</script>

<template>
  <div class="auth-page" :style="backgroundStyle">
    <header class="brand">
      <div class="brand-badge">
        <img class="brand-logo" :src="brandLogo" alt="DKK logo" />
        <div class="brand-labels">
          <span class="brand-primary">{{ t('app.brandPrimary') }}</span>
          <span class="brand-tag">{{ t('app.brandTag') }}</span>
        </div>
      </div>
    </header>
    <main class="auth-main">
      <AdminAuthPanel />
    </main>
    <a class="icp-link" href="https://beian.miit.gov.cn/" target="_blank" rel="noopener">
      苏ICP备2025183953号-2
    </a>
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
  top: 2.75rem;
  left: clamp(1.8rem, 2vw, 8.5rem);
  z-index: 5;
}

.brand-badge {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1.5rem 0.75rem 0.9rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.24);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: 0 10px 30px rgba(8, 16, 48, 0.25);
}

.brand-logo {
  width: clamp(48px, 6vw, 64px);
  height: clamp(48px, 6vw, 64px);
  object-fit: contain;
  filter: drop-shadow(0 6px 16px rgba(0, 0, 0, 0.25));
}

.brand-labels {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: #ffffff;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.brand-primary {
  font-size: clamp(1.5rem, 2vw, 2.25rem);
}

.brand-tag {
  font-size: 0.95rem;
  text-transform: none;
  padding: 0.15rem 0.9rem;
  border-radius: 999px;
  border: 1px solid rgba(74, 162, 255, 0.7);
  background: rgba(66, 148, 255, 0.9);
  color: #ffffff;
  font-weight: 600;
  box-shadow: 0 0 12px rgba(66, 148, 255, 0.45);
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
    left: 2rem;
    top: 2rem;
  }

  .brand-badge {
    border-radius: 24px;
    padding: 0.6rem 1rem 0.6rem 0.7rem;
    gap: 0.75rem;
  }

  .brand-logo {
    width: 44px;
    height: 44px;
  }

  .brand-labels {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.35rem;
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
    position: static;
    margin-bottom: 1rem;
    width: 100%;
    display: flex;
    justify-content: center;
  }
}

.icp-link {
  position: fixed;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.775rem;
  color: #ffffff;
  text-decoration: none;
}

.icp-link:hover,
.icp-link:focus {
  text-decoration: underline;
}
</style>
