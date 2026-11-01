<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import { fetchExternalMapConfig, saveExternalMapConfig } from '../services/externalMap'

const { t, locale } = useI18n({
  useScope: 'local',
  messages: {
    'zh-CN': {
      title: '对外搜索 Key 配置',
      description: '独立于小程序、Android 和其他现有 Key 配置，仅开放地点搜索、地理编码和路线规划。',
      credentials: '在本页配置，保存后立即生效',
      serverHelp: '填写独立腾讯 WebService Key 和 Auth Token，参数保存在后端。无需修改服务器配置或重启。',
      key: '独立腾讯 Key', tokenStatus: 'Auth Token', service: '服务状态',
      keyInput: '设置 / 更换腾讯 Key', keyPlaceholder: '输入独立腾讯 WebService Key',
      keySaved: '已配置，留空保留现有 Key',
      keyHelp: '用于后端调用腾讯地图。保存后不回显，留空保留现有值；更换后立即生效。',
      invalidKey: '腾讯 Key 必须为 1–128 位字母、数字或短横线',
      configured: '已配置', missing: '未配置', ready: '已就绪', unavailable: '未就绪',
      enabled: '启用对外搜索服务', enabledHelp: '启用前需填写腾讯 Key 和 Auth Token；关闭后外部请求立即停止。',
      token: '设置 / 更换 Auth Token', placeholder: '输入 32–128 位字母、数字、下划线或短横线',
      tokenHelp: '这是独立的外部调用凭证。留空保留现有 Token；保存新值后旧 Token 立即失效。服务端仅保存哈希，无法回显，请先复制保存。',
      generate: '生成随机 Token', copy: '复制 Token', save: '保存配置', reload: '刷新配置',
      saved: '配置已保存', loadFailed: '读取配置失败，请刷新重试', saveFailed: '保存失败，请重试',
      invalid: 'Auth Token 必须为 32–128 位字母、数字、下划线或短横线',
      notReady: '请先填写腾讯 Key 和 Auth Token',
      generated: '已生成 Token，请先复制保存，再点击“保存配置”生效', copied: 'Token 已复制', copyFailed: '复制失败，请手动复制',
      randomFailed: '浏览器无法生成安全随机数，请手动填写 Token',
      usage: '调用方式', authHelp: '三个接口均必须携带以下请求头，不能使用管理端登录 Token 或现有其他 Key：',
      search: '地点搜索', geocode: '地理编码（地址转坐标）', direction: '路线规划',
      paramsSearch: '必填 keyword、boundary；可选 page_size、page_index、filter、orderby。',
      paramsGeocode: '必填 address；可选 region。',
      paramsDirection: 'mode 支持 driving、walking、bicycling；必填 from、to，格式为纬度,经度。驾车可传 waypoints（最多 10 个，以分号分隔）。',
      coordinates: '输入与返回坐标使用腾讯 GCJ-02；接口不会自动转换为 WGS84 或 GeoJSON。',
    },
    en: {
      title: 'External search key configuration',
      description: 'Independent of existing mini program, Android and other keys. Exposes only place search, geocoding and directions.',
      credentials: 'Configure here; changes take effect on save',
      serverHelp: 'Enter a dedicated Tencent WebService Key and Auth Token. Settings are stored on the backend. No server configuration or restart is required.',
      key: 'Dedicated Tencent key', tokenStatus: 'Auth Token', service: 'Service status',
      keyInput: 'Set / replace Tencent Key', keyPlaceholder: 'Enter a dedicated Tencent WebService Key',
      keySaved: 'Configured; leave blank to keep the current key',
      keyHelp: 'Used by the backend to call Tencent Maps. Saved keys are not returned. Leave blank to keep the current value; replacements take effect immediately.',
      invalidKey: 'Use 1–128 letters, digits or hyphens for the Tencent Key.',
      configured: 'Configured', missing: 'Not configured', ready: 'Ready', unavailable: 'Not ready',
      enabled: 'Enable external search', enabledHelp: 'A Tencent Key and Auth Token are required. Disabling blocks external requests immediately.',
      token: 'Set / replace Auth Token', placeholder: '32–128 letters, digits, underscores or hyphens',
      tokenHelp: 'This is a separate external credential. Leave blank to keep the current token. Saving a new token revokes the old one immediately. Only its hash is stored; copy it before saving.',
      generate: 'Generate token', copy: 'Copy token', save: 'Save configuration', reload: 'Refresh configuration',
      saved: 'Configuration saved', loadFailed: 'Unable to load configuration. Please retry.', saveFailed: 'Unable to save. Please retry.',
      invalid: 'Use 32–128 letters, digits, underscores or hyphens for the Auth Token.',
      notReady: 'Enter a Tencent Key and Auth Token first.',
      generated: 'Token generated. Copy it, then save the configuration to activate it.', copied: 'Token copied', copyFailed: 'Copy failed. Please copy manually.',
      randomFailed: 'Secure random generation is unavailable. Enter a token manually.',
      usage: 'API access', authHelp: 'All three endpoints require this header. Admin login tokens and other existing keys are not accepted:',
      search: 'Place search', geocode: 'Geocoding (address to coordinates)', direction: 'Directions',
      paramsSearch: 'Required: keyword, boundary. Optional: page_size, page_index, filter, orderby.',
      paramsGeocode: 'Required: address. Optional: region.',
      paramsDirection: 'mode: driving, walking or bicycling. Required: from, to as latitude,longitude. Driving accepts up to 10 semicolon-separated waypoints.',
      coordinates: 'Coordinates use Tencent GCJ-02. No automatic conversion to WGS84 or GeoJSON.',
    },
  },
})

const status = reactive({ enabled: false, tokenConfigured: false, keyConfigured: false, ready: false })
const form = reactive({ enabled: false, authToken: '', tencentKey: '' })
const loading = ref(false), saving = ref(false), loaded = ref(false), feedback = ref(''), feedbackType = ref('info')
const busy = computed(() => loading.value || saving.value)
const credentialRows = computed(() => [
  { label: 'key', value: status.keyConfigured },
  { label: 'tokenStatus', value: status.tokenConfigured },
])
function notify(key, type = 'error', error) {
  const serverMessage = error?.response?.data?.message?.zh
  feedback.value = String(locale.value).startsWith('zh') && serverMessage ? serverMessage : t(key)
  feedbackType.value = type
  message[type](feedback.value)
}
function applyStatus(data) {
  for (const key of Object.keys(status)) status[key] = data[key] === true
  form.enabled = status.enabled
  form.authToken = ''
  form.tencentKey = ''
  loaded.value = true
}
async function load() {
  if (busy.value) return
  loading.value = true
  feedback.value = ''
  try { applyStatus(await fetchExternalMapConfig()) }
  catch (error) { loaded.value = false; notify('loadFailed', 'error', error) }
  finally { loading.value = false }
}
async function save() {
  if (busy.value || !loaded.value) return
  const token = form.authToken.trim()
  const key = form.tencentKey.trim()
  if (key && !/^[A-Za-z0-9-]{1,128}$/.test(key)) return notify('invalidKey')
  if (token && !/^[A-Za-z0-9_-]{32,128}$/.test(token)) return notify('invalid')
  if (form.enabled && ((!status.keyConfigured && !key) || (!status.tokenConfigured && !token))) return notify('notReady')
  saving.value = true
  try {
    applyStatus(await saveExternalMapConfig({ enabled: form.enabled, ...(token ? { authToken: token } : {}), ...(key ? { tencentKey: key } : {}) }))
    notify('saved', 'success')
  } catch (error) { notify('saveFailed', 'error', error) }
  finally { saving.value = false }
}
function generate() {
  try {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    form.authToken = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
    notify('generated', 'info')
  } catch { notify('randomFailed') }
}
async function copyToken() {
  try { await navigator.clipboard.writeText(form.authToken.trim()); notify('copied', 'success') }
  catch { notify('copyFailed') }
}
onMounted(load)
</script>

<template>
  <a-card :title="t('title')" class="external-map-config">
    <p>{{ t('description') }}</p>
    <a-alert type="info" show-icon :message="t('credentials')" :description="t('serverHelp')" />
    <a-spin :spinning="loading">
      <a-descriptions bordered :column="{ xs: 1, sm: 2 }" class="credential-status">
        <a-descriptions-item v-for="row in credentialRows" :key="row.label" :label="t(row.label)">
          <a-tag :color="loaded && row.value ? 'green' : 'default'">{{ loaded ? t(row.value ? 'configured' : 'missing') : '—' }}</a-tag>
        </a-descriptions-item>
        <a-descriptions-item :label="t('service')">
          <a-tag :color="loaded && status.ready ? 'green' : 'default'">{{ loaded ? t(status.ready ? 'ready' : 'unavailable') : '—' }}</a-tag>
        </a-descriptions-item>
      </a-descriptions>
      <a-form layout="vertical" :model="form" @finish="save">
        <a-form-item :label="t('keyInput')" :help="t('keyHelp')">
          <a-input-password v-model:value="form.tencentKey" :aria-label="t('keyInput')"
            :placeholder="t(status.keyConfigured ? 'keySaved' : 'keyPlaceholder')"
            :maxlength="128" autocomplete="new-password" :disabled="busy || !loaded" />
        </a-form-item>
        <a-form-item :label="t('enabled')" :help="t('enabledHelp')">
          <a-switch v-model:checked="form.enabled" :aria-label="t('enabled')" :disabled="busy || !loaded" />
        </a-form-item>
        <a-form-item :label="t('token')" :help="t('tokenHelp')">
          <a-input-password v-model:value="form.authToken" :aria-label="t('token')" :placeholder="t('placeholder')"
            :maxlength="128" autocomplete="new-password" :disabled="busy || !loaded" />
          <a-space wrap class="token-actions">
            <a-button @click="generate" :disabled="busy || !loaded">{{ t('generate') }}</a-button>
            <a-button @click="copyToken" :disabled="busy || !form.authToken.trim()">{{ t('copy') }}</a-button>
          </a-space>
        </a-form-item>
        <a-space wrap class="form-actions">
          <a-button type="primary" html-type="submit" :loading="saving" :disabled="loading || !loaded">{{ t('save') }}</a-button>
          <a-button @click="load" :disabled="busy">{{ t('reload') }}</a-button>
        </a-space>
      </a-form>
      <div aria-live="polite" class="feedback">
        <a-alert v-if="feedback" :type="feedbackType" show-icon :message="feedback" />
      </div>
    </a-spin>
    <a-divider />
    <h3>{{ t('usage') }}</h3>
    <p>{{ t('authHelp') }}</p>
    <pre>Authorization: Bearer &lt;AUTH_TOKEN&gt;</pre>
    <div v-for="endpoint in [
      { name: 'search', path: '/api/open/v1/map/search', params: 'paramsSearch' },
      { name: 'geocode', path: '/api/open/v1/map/geocode', params: 'paramsGeocode' },
      { name: 'direction', path: '/api/open/v1/map/direction/{mode}', params: 'paramsDirection' },
    ]" :key="endpoint.name" class="endpoint">
      <strong>{{ t(endpoint.name) }}</strong>
      <pre>GET {{ endpoint.path }}</pre>
      <p>{{ t(endpoint.params) }}</p>
    </div>
    <p class="coordinate-hint">{{ t('coordinates') }}</p>
  </a-card>
</template>

<style scoped>
.external-map-config { margin-bottom: 24px; min-width: 0; overflow-wrap: anywhere; }
.credential-status { margin: 24px 0; }
.token-actions { margin-top: 12px; }
.form-actions { margin-top: 24px; }
.feedback { margin-top: 16px; }
.endpoint { margin-top: 20px; }
pre { padding: 12px; background: var(--admin-raised); border-radius: 6px; white-space: pre-wrap; overflow-wrap: anywhere; }
.coordinate-hint { color: var(--admin-muted); }
</style>
