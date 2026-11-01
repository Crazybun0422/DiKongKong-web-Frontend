<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { DownOutlined, MenuOutlined, ArrowUpOutlined, CompassOutlined, EnvironmentOutlined, TeamOutlined, RadarChartOutlined, ApartmentOutlined, NotificationOutlined, WalletOutlined, AppstoreOutlined, ApiOutlined, TrophyOutlined, ShoppingOutlined, SendOutlined, SettingOutlined } from '@ant-design/icons-vue'
import { AUTH_TOKEN_KEY } from '../services/http'
import { fetchProfile } from '../services/profile'
import ProfileModal from '../components/ProfileModal.vue'
import logoImage from '../landing/assets/logo.png'
import AdminNavigation from '../components/AdminNavigation.vue'
import { loadAdminAppearance } from '../theme/adminAppearance'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()

const menuItems = computed(() => [
  { key: 'home', group: '工作空间', icon: CompassOutlined, label: t('navigation.home'), path: { name: 'home' } },
  { key: 'airspace', group: '工作空间', icon: EnvironmentOutlined, label: t('navigation.airspace'), path: { name: 'airspace' } },
  { key: 'users', group: '用户与运营', icon: TeamOutlined, label: t('navigation.user'), path: { name: 'users' } },
  { key: 'onlineUsers', group: '用户与运营', icon: RadarChartOutlined, label: t('navigation.onlineUsers'), path: { name: 'onlineUsers' } },
  { key: 'groups', group: '用户与运营', icon: ApartmentOutlined, label: t('navigation.groups'), path: { name: 'groups' } },
  { key: 'subscriptionPush', group: '用户与运营', icon: NotificationOutlined, label: t('navigation.subscription'), path: { name: 'subscriptionPush' } },
  { key: 'flpPool', group: '平台管理', icon: WalletOutlined, label: t('navigation.flpPool'), path: { name: 'flpPool' } },
  { key: 'discoveryPromotions', group: '用户与运营', icon: AppstoreOutlined, label: t('navigation.discoveryPromotions'), path: { name: 'discoveryPromotions' } },
  { key: 'apiAccess', group: '平台管理', icon: ApiOutlined, label: t('navigation.apiAccess'), path: { name: 'apiAccess' } },
  { key: 'droneLeaderboard', group: '用户与运营', icon: TrophyOutlined, label: '涂鸦飞行天梯', path: { name: 'droneLeaderboard' } },
  { key: 'planetMarket', group: '用户与运营', icon: ShoppingOutlined, label: '星球有市', path: { name: 'planetMarket' } },
  { key: 'flightMeetups', group: '用户与运营', icon: SendOutlined, label: '星球约飞管理', path: { name: 'flightMeetups' } },
  { key: 'settings', group: '平台管理', icon: SettingOutlined, label: t('navigation.settings'), path: { name: 'settings' } },
])

const currentMenu = computed(() => menuItems.value.find(item => item.key === route.name))
const mobileMenuOpen = ref(false)
const menuButton = ref(null)
watch(() => route.fullPath, () => { mobileMenuOpen.value = false })
const handleDrawerChange = (open) => { if (!open) menuButton.value?.focus() }

const profileVisible = ref(false)
const profileData = ref(null)
const headerLoading = ref(false)

const displayName = computed(() => {
  if (profileData.value?.username) return profileData.value.username
  return localStorage.getItem('admin_username') || t('profile.menu')
})

const displayAvatar = computed(() => profileData.value?.avatarUrl || '')

const usernameInitials = computed(() => displayName.value.slice(0, 1).toUpperCase())


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
  loadAdminAppearance()
  loadProfile()
})
</script>

<template>
  <div class="admin-shell">
    <a class="skip-link" href="#admin-content">跳转到页面内容</a>
    <aside class="admin-sidebar">
      <a class="admin-brand" href="/"><img :src="logoImage" alt="低空星球" /><span>低空星球<small>管理中心</small></span></a>
      <AdminNavigation :items="menuItems" />
    </aside>
    <div class="admin-workspace">
      <header class="admin-topbar">
        <button ref="menuButton" class="mobile-menu-button" type="button" aria-label="打开管理菜单" :aria-expanded="mobileMenuOpen" @click="mobileMenuOpen = true"><MenuOutlined /></button>
        <div class="admin-breadcrumb"><span>管理中心</span><span aria-hidden="true">/</span><strong>{{ currentMenu?.label }}</strong></div>
        <a class="admin-doc-link" href="/docs/api/" target="_blank" rel="noopener">API 文档 <ArrowUpOutlined :rotate="45" /></a>
        <a-dropdown :trigger="['click']">
          <button class="profile-chip" type="button" aria-label="账户菜单">
            <img v-if="displayAvatar" class="avatar-image" :src="displayAvatar" alt="" />
            <span v-else class="avatar-circle">{{ usernameInitials }}</span>
            <span class="profile-name">{{ displayName }}</span><DownOutlined />
          </button>
          <template #overlay><a-menu @click="onProfileMenuClick"><a-menu-item key="profile">{{ t('profile.viewProfile') }}</a-menu-item><a-menu-divider /><a-menu-item key="logout">{{ t('profile.logout') }}</a-menu-item></a-menu></template>
        </a-dropdown>
      </header>
      <main id="admin-content" class="admin-content" tabindex="-1">
        <div class="workspace-heading"><span>LOW ALTITUDE PLANET</span><span class="workspace-section">{{ currentMenu?.group }}</span></div>
        <router-view />
      </main>
      <footer class="admin-footer"><span>低空星球 · 让飞行，连接更多可能。</span><a href="/">访问官网 ↗</a></footer>
    </div>
    <a-drawer v-model:open="mobileMenuOpen" title="低空星球 · 管理中心" placement="left" :width="288" class="admin-mobile-drawer" @after-open-change="handleDrawerChange">
      <AdminNavigation :items="menuItems" @navigate="mobileMenuOpen = false" />
    </a-drawer>
    <ProfileModal v-model:visible="profileVisible" @updated="handleProfileUpdated" />
  </div>
</template>

<style scoped>
.admin-shell { min-height: 100vh; }
.admin-sidebar { position: fixed; inset: 0 auto 0 0; width: 236px; background: var(--admin-sidebar); border-right: 1px solid var(--admin-line); padding: 28px 16px 20px; overflow-y: auto; display: flex; flex-direction: column; z-index: 20; }
.admin-brand { display: flex; align-items: center; gap: 12px; color: var(--admin-text); padding: 0 10px 32px; font-size: 20px; font-weight: 600; letter-spacing: 1px; }
.admin-brand img { width: 42px; height: 42px; border-radius: 50%; }
.admin-brand small { display: block; color: var(--admin-muted); font-size: 10px; font-weight: 400; letter-spacing: 3px; margin-top: 5px; }
.admin-sidebar :deep(.admin-navigation) { flex: 1; min-height: auto; }
.admin-workspace { margin-left: 236px; min-width: 0; min-height: 100vh; display: flex; flex-direction: column; }
.admin-topbar { min-height: 78px; padding: 12px 32px; border-bottom: 1px solid var(--admin-line); display: flex; align-items: center; gap: 24px; background: var(--admin-topbar); position: sticky; top: 0; z-index: 15; backdrop-filter: blur(12px); }
.admin-breadcrumb { display: flex; align-items: center; gap: 12px; color: var(--admin-muted); font-size: 12px; flex: 1; min-width: 0; }
.admin-breadcrumb strong { color: var(--admin-text); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.admin-doc-link { font-size: 12px; color: var(--admin-muted); display: flex; gap: 8px; align-items: center; }
.profile-chip { display: flex; align-items: center; gap: 10px; border: 1px solid var(--admin-line); border-radius: 99px; padding: 5px 12px 5px 5px; background: var(--admin-surface); color: var(--admin-text); min-height: 44px; cursor: pointer; }
.avatar-image, .avatar-circle { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; }
.avatar-circle { display: grid; place-items: center; background: var(--admin-summary); color: var(--admin-summary-text); font-weight: 600; }
.profile-name { max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
.admin-content { flex: 1; width: 100%; min-width: 0; padding: 28px 32px 40px; max-width: 1920px; margin: auto; }
.workspace-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 26px; color: var(--admin-muted); font-size: 10px; letter-spacing: 2px; }
.workspace-section { letter-spacing: 1px; color: var(--admin-muted); }
.admin-footer { margin: 0 32px; padding: 20px 0; border-top: 1px solid var(--admin-line); display: flex; justify-content: space-between; gap: 12px; color: var(--admin-muted); font-size: 11px; }
.admin-footer a { color: inherit; }
.mobile-menu-button { display: none; }
.skip-link { position: fixed; top: -100px; left: 16px; z-index: 1100; background: var(--admin-lime); color: var(--admin-on-accent); padding: 12px 20px; border-radius: 8px; }
.skip-link:focus { top: 12px; }
@media (max-width: 1100px) { .admin-sidebar { width: 216px; padding-inline: 12px; } .admin-workspace { margin-left: 216px; } .admin-content { padding: 24px; } .admin-topbar { padding-inline: 24px; } }
@media (max-width: 900px) { .admin-sidebar { display: none; } .admin-workspace { margin-left: 0; } .admin-topbar { min-height: 68px; gap: 12px; padding: 10px 16px; } .mobile-menu-button { display: grid; place-items: center; width: 44px; height: 44px; flex-shrink: 0; border: 1px solid var(--admin-line); border-radius: 8px; color: var(--admin-text); background: var(--admin-surface); font-size: 18px; } .admin-content { padding: 22px 16px 32px; } .admin-footer { margin-inline: 16px; } }
@media (max-width: 600px) { .admin-doc-link, .profile-name, .admin-breadcrumb > span { display: none; } .admin-breadcrumb { font-size: 14px; } .profile-chip { gap: 6px; padding-right: 8px; } .workspace-heading { font-size: 9px; margin-bottom: 20px; letter-spacing: 1px; } .admin-footer { flex-wrap: wrap; padding-bottom: max(20px, env(safe-area-inset-bottom)); } }
</style>
