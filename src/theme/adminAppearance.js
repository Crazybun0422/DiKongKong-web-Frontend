import { computed, ref, watchEffect } from 'vue';
import { theme } from 'ant-design-vue';
import http, { AUTH_TOKEN_KEY } from '../services/http';
import { DEFAULT_ADMIN_THEME, findAdminTheme } from './adminThemes';

const CACHE_KEY = 'dikongkong_admin_appearance';
const readCache = () => {
  try { return findAdminTheme(localStorage.getItem(CACHE_KEY))?.id || DEFAULT_ADMIN_THEME; }
  catch { return DEFAULT_ADMIN_THEME; }
};
export const savedAdminSkin = ref(readCache());
export const appearanceLoading = ref(false);
export const appearanceLoaded = ref(false);
export const appearanceError = ref('');
export const appearanceSaving = ref(false);
const activeTheme = computed(() => findAdminTheme(savedAdminSkin.value) || findAdminTheme(DEFAULT_ADMIN_THEME));
let pendingLoad;
let pendingToken;

function applySkin(id) {
  savedAdminSkin.value = findAdminTheme(id)?.id || DEFAULT_ADMIN_THEME;
  try { localStorage.setItem(CACHE_KEY, savedAdminSkin.value); } catch { /* Server remains the source of truth. */ }
}

watchEffect(() => {
  const root = document.documentElement;
  root.dataset.adminSkin = activeTheme.value.id;
  for (const [key, value] of Object.entries(activeTheme.value.colors)) root.style.setProperty(`--admin-${key}`, value);
  root.style.setProperty('--admin-topbar', `${activeTheme.value.colors.bg}f5`);
  root.style.setProperty('--admin-selection', `${activeTheme.value.colors.lime}40`);
});

export const adminTheme = computed(() => {
  const c = activeTheme.value.colors;
  return {
    algorithm: theme.darkAlgorithm,
    token: {
      colorPrimary: c.lime, colorInfo: c.lime, colorSuccess: '#75d6a0', colorWarning: '#edc777', colorError: '#ff8585',
      colorBgBase: c.bg, colorBgContainer: c.surface, colorBgElevated: c.raised,
      colorText: c.text, colorTextSecondary: c.muted, colorTextPlaceholder: c.muted, colorTextDisabled: c.muted,
      colorBorder: c.border, colorBorderSecondary: c.line, borderRadius: 8, controlHeight: 38,
      fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", sans-serif',
    },
    components: {
      Button: { colorError: '#ff8585', colorErrorHover: '#ffabab', colorErrorActive: '#ef7777', colorTextLightSolid: c['on-accent'], controlOutlineWidth: 0, colorPrimary: c.lime, colorPrimaryHover: c['accent-hover'], colorPrimaryActive: c['accent-active'] },
      Table: { colorFillAlter: c.raised, colorTextHeading: c.text, controlItemBgActive: c['accent-soft'], controlItemBgActiveHover: c['accent-soft'], padding: 14 },
      Tabs: { colorPrimary: c.lime, colorPrimaryHover: c['accent-hover'], colorPrimaryActive: c['accent-active'] },
      Switch: { colorPrimary: c.lime, colorPrimaryHover: c['accent-hover'] },
    },
  };
});

export function loadAdminAppearance() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) return Promise.resolve(false);
  if (pendingLoad && pendingToken === token) return pendingLoad;
  pendingToken = token;
  appearanceLoading.value = true;
  appearanceLoaded.value = false;
  appearanceError.value = '';
  const request = http.get('/auth/appearance').then(({ data }) => {
    if (localStorage.getItem(AUTH_TOKEN_KEY) !== token) return false;
    if (data?.success !== true || !data.data || typeof data.data.skin !== 'string') throw new Error('Invalid appearance response');
    applySkin(data.data.skin);
    appearanceLoaded.value = true;
    return true;
  }).catch(() => {
    if (localStorage.getItem(AUTH_TOKEN_KEY) === token) appearanceError.value = '无法读取管理员皮肤设置，请重试。';
    return false;
  }).finally(() => {
    if (pendingLoad === request) { appearanceLoading.value = false; pendingLoad = null; }
  });
  pendingLoad = request;
  return request;
}

export async function saveAdminAppearance(skin) {
  if (!findAdminTheme(skin) || appearanceSaving.value || !appearanceLoaded.value) throw new Error('请先读取管理员设置。');
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) throw new Error('请重新登录。');
  appearanceSaving.value = true;
  try {
    const { data } = await http.put('/auth/appearance', { skin });
    if (localStorage.getItem(AUTH_TOKEN_KEY) !== token) throw new Error('登录状态已改变，请重新登录。');
    if (data?.success !== true || data.data?.skin !== skin) throw new Error('皮肤保存失败，请重试。');
    applySkin(skin);
  } finally { appearanceSaving.value = false; }
}
