<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { DownOutlined } from '@ant-design/icons-vue'
import { AUTH_TOKEN_KEY } from '../services/http'
import { fetchProfile } from '../services/profile'
import ProfileModal from '../components/ProfileModal.vue'
import logoImage from '../assets/img/dkk.png'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()

const menuItems = computed(() => [
  { key: 'home', label: t('navigation.home'), path: { name: 'home' } },
  { key: 'airspace', label: t('navigation.airspace'), path: { name: 'airspace' } },
  { key: 'users', label: t('navigation.user'), path: { name: 'users' } },
  { key: 'groups', label: t('navigation.groups'), path: { name: 'groups' } },
  { key: 'settings', label: t('navigation.settings'), path: { name: 'settings' } },
])

const selectedKey = computed(() => (route.name ? String(route.name) : ''))

const profileVisible = ref(false)
const profileData = ref(null)
const headerLoading = ref(false)

const displayName = computed(() => {
  if (profileData.value?.username) return profileData.value.username
  return localStorage.getItem('admin_username') || t('profile.menu')
})

const displayAvatar = computed(() => profileData.value?.avatarUrl || '')

const usernameInitials = computed(() => displayName.value.slice(0, 1).toUpperCase())

const handleMenuSelect = (key) => {
  const item = menuItems.value.find((entry) => entry.key === key)
  if (!item) return
  if (route.name === item.path.name) return
  router.push(item.path).catch(() => {})
}

const handleProfileUpdated = (updated) => {
  profileData.value = {
    ...profileData.value,
    ...updated,
  }
  localStorage.setItem('admin_username', profileData.value.username || '')
}

const onProfileMenuClick = ({ key }) => {
  if (key === 'profile') {
    profileVisible.value = true
  }
  if (key === 'logout') {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.removeItem('admin_username')
    localStorage.removeItem('admin_login_seq')
    router.push({ name: 'login' }).catch(() => {})
  }
}

const loadProfile = async () => {
  headerLoading.value = true
  try {
    const data = await fetchProfile()
    profileData.value = data
    if (data?.username) {
      localStorage.setItem('admin_username', data.username)
    }
  } catch (error) {
    console.warn('Failed to load profile for header', error)
  } finally {
    headerLoading.value = false
  }
}

onMounted(() => {
  loadProfile()
})
</script>

<template>
  <div class="layout">
    <header class="top-bar">
      <div class="logo-area">
        <div class="logo-chip">
          <img class="logo-image" :src="logoImage" alt="DKK logo" />
        </div>
        <div class="brand-labels">
          <span class="brand-primary">{{ t('app.brandPrimary') }}</span>
          <span class="brand-tag">{{ t('app.brandTag') }}</span>
        </div>
      </div>
      <nav class="main-nav">
        <button
          v-for="item in menuItems"
          :key="item.key"
          :class="['nav-link', { active: selectedKey === item.key }]"
          type="button"
          @click="handleMenuSelect(item.key)"
        >
          {{ item.label }}
        </button>
      </nav>
      <a-dropdown trigger="click">
        <div class="profile-chip">
          <template v-if="displayAvatar">
            <img class="avatar-image" :src="displayAvatar" alt="avatar" />
          </template>
          <template v-else>
            <span class="avatar-circle">{{ usernameInitials }}</span>
          </template>
          <span class="profile-name">{{ displayName }}</span>
          <DownOutlined />
        </div>
        <template #overlay>
          <a-menu @click="onProfileMenuClick">
            <a-menu-item key="profile">{{ t('profile.viewProfile') }}</a-menu-item>
            <a-menu-divider />
            <a-menu-item key="logout">{{ t('profile.logout') }}</a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>
    </header>
    <main class="content-area">
      <section class="content-card">
        <a-spin :spinning="headerLoading">
          <router-view />
        </a-spin>
      </section>
    </main>
    <ProfileModal v-model:visible="profileVisible" @updated="handleProfileUpdated" />
  </div>
</template>

<style scoped>
.layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #efefef;
}

.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #070707;
  color: #ffffff;
  padding: 0 2rem;
  height: 72px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.logo-area {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.logo-chip {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 18px rgba(255, 255, 255, 0.35);
}

.logo-image {
  width: 46px;
  height: 46px;
  object-fit: contain;
}

.brand-labels {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  color: #ffffff;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.brand-primary {
  font-size: 1.35rem;
  font-weight: 600;
}

.brand-tag {
  font-size: 0.9rem;
  padding: 0.1rem 0.75rem;
  border: 1px solid rgba(74, 162, 255, 0.75);
  border-radius: 999px;
  background: rgba(66, 148, 255, 0.9);
  color: #ffffff;
  letter-spacing: 0.08em;
  box-shadow: 0 0 12px rgba(66, 148, 255, 0.45);
}

.main-nav {
  display: flex;
  gap: 2.5rem;
  align-items: center;
}

.nav-link {
  background: transparent;
  border: none;
  color: #f2f2f2;
  font-size: 1rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  cursor: pointer;
  padding: 0.5rem 0;
  position: relative;
  transition: color 0.2s ease;
}

.nav-link::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: -0.4rem;
  width: 100%;
  height: 3px;
  background: transparent;
  transition: background 0.2s ease;
}

.nav-link:hover {
  color: #ffffff;
}

.nav-link.active::after {
  background: #ffffff;
}

.profile-chip {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  cursor: pointer;
  font-size: 0.95rem;
  color: #ffffff;
}

.avatar-image {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid rgba(255, 255, 255, 0.35);
}

.avatar-circle {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1f68ff, #67a7ff);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-weight: 600;
}

.profile-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.content-area {
  flex: 1;
  display: flex;
  justify-content: center;
  padding: 2.5rem clamp(16px, 5vw, 50px) 3rem;
}

.content-card {
  width: 100%;
  max-width: 100%;
  min-height: calc(100vh - 72px - 5rem);
  background: #f5f5f5;
  border-radius: 16px;
  border: 1px solid #d9d9d9;
  padding: 2.5rem;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3);
  margin: 0 auto;
}

@media (max-width: 960px) {
  .main-nav {
    gap: 1.5rem;
  }
}

@media (max-width: 720px) {
  .top-bar {
    flex-wrap: wrap;
    height: auto;
    padding: 1rem;
    gap: 1rem;
  }

  .main-nav {
    order: 3;
    width: 100%;
    justify-content: space-around;
  }

  .content-card {
    width: 100%;
    padding: 1.5rem;
  }
}
</style>
