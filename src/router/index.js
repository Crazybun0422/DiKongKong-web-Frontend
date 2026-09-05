import { createRouter, createWebHistory } from 'vue-router'
import { AUTH_TOKEN_KEY } from '../services/http'

const LoginView = () => import('../views/LoginView.vue')
const MainLayout = () => import('../layouts/MainLayout.vue')
const HomeView = () => import('../views/dashboard/HomeView.vue')
const AirspaceMapView = () => import('../views/dashboard/AirspaceMapView.vue')
const UserManagementView = () => import('../views/dashboard/UserManagementView.vue')
const WorkGroupManagementView = () => import('../views/dashboard/WorkGroupManagementView.vue')
const SettingsView = () => import('../views/dashboard/SettingsView.vue')
const SubscriptionPushView = () => import('../views/dashboard/SubscriptionPushView.vue')
const FlpPoolView = () => import('../views/dashboard/FlpPoolView.vue')
const ApiAccessManagementView = () => import('../views/dashboard/ApiAccessManagementView.vue')
const DiscoveryPromotionView = () => import('../views/dashboard/DiscoveryPromotionView.vue')

const routes = [
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    meta: { requiresAuth: false },
  },
  {
    path: '/',
    component: MainLayout,
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'home',
        component: HomeView,
      },
      {
        path: 'airspace',
        name: 'airspace',
        component: AirspaceMapView,
      },
      {
        path: 'users',
        name: 'users',
        component: UserManagementView,
      },
      {
        path: 'groups',
        name: 'groups',
        component: WorkGroupManagementView,
      },
      {
        path: 'subscription-push',
        name: 'subscriptionPush',
        component: SubscriptionPushView,
      },
      {
        path: 'flp-pool',
        name: 'flpPool',
        component: FlpPoolView,
      },
      {
        path: 'discovery-promotions',
        name: 'discoveryPromotions',
        component: DiscoveryPromotionView,
      },
      {
        path: 'api-access',
        name: 'apiAccess',
        component: ApiAccessManagementView,
      },
      {
        path: 'settings',
        name: 'settings',
        component: SettingsView,
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  if (to.meta.requiresAuth && !token) {
    next({ name: 'login' })
    return
  }
  if (to.name === 'login' && token) {
    next({ name: 'home' })
    return
  }
  next()
})

export default router
