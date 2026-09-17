<script setup>
import { onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import http from '../services/http'

const { t } = useI18n()
const channels = ['debug', 'release']
const fields = ['apiBase', 'assetBase']
const defaults = {
  debug: { apiBase: 'https://kylee-suborbital-herta.ngrok-free.dev', assetBase: 'https://kylee-suborbital-herta.ngrok-free.dev' },
  release: { apiBase: 'https://skylane.cn', assetBase: 'https://www.skylane.cn' },
}
const form = reactive({ debug: { apiBase: '', assetBase: '' }, release: { apiBase: '', assetBase: '' } })
const busy = ref(false)
const loaded = ref(false)
const feedback = ref('')
function normalize(value) {
  const clean = value.trim().replace(/\/+$/, '')
  if (!clean) return ''
  const url = new URL(clean)
  if (clean.length > 512 || !clean.startsWith('https://') || url.username || url.password || url.search || url.hash || url.pathname !== '/' || url.port === '0' || /[\s\\]/.test(clean)) throw new Error('invalid')
  return clean
}
async function load() {
  if (busy.value) return
  busy.value = true
  feedback.value = ''
  try {
    const { data } = await http.get('/android/config/environments')
    if (data?.success !== true || !data.data?.debug || !data.data?.release) throw new Error('loadFailed')
    for (const channel of channels) for (const field of fields) form[channel][field] = data.data[channel][field] || ''
    loaded.value = true
  } catch { feedback.value = 'loadFailed' }
  finally { busy.value = false }
}
async function save() {
  if (busy.value || !loaded.value) return
  let body
  try { body = Object.fromEntries(channels.map(channel => [channel, Object.fromEntries(fields.map(field => [field, normalize(form[channel][field])]))])) }
  catch { feedback.value = 'invalid'; return }
  busy.value = true
  feedback.value = ''
  try {
    const { data } = await http.post('/auth/android/config/environments', body)
    if (data?.success !== true) throw new Error('saveFailed')
    for (const channel of channels) Object.assign(form[channel], body[channel])
    feedback.value = 'saved'
    message.success(t('androidServer.saved'))
  } catch { feedback.value = 'saveFailed'; message.error(t('androidServer.saveFailed')) }
  finally { busy.value = false }
}
onMounted(load)
</script>

<template>
  <a-card :title="t('androidServer.title')" style="margin-bottom: 24px">
    <p>{{ t('androidServer.description') }}</p>
    <a-form layout="vertical" :model="form" @finish="save">
      <template v-for="channel in channels" :key="channel">
        <a-divider orientation="left">{{ t(`androidServer.${channel}`) }}</a-divider>
        <a-form-item v-for="field in fields" :key="field" :label="t(`androidServer.${field}`)">
          <a-input v-model:value="form[channel][field]" :data-testid="`${channel}-${field}`" :placeholder="defaults[channel][field]"
            :maxlength="512" :disabled="busy || !loaded" allow-clear @change="feedback = ''" />
          <small>{{ t('androidServer.defaultValue', { value: defaults[channel][field] }) }}</small>
        </a-form-item>
      </template>
      <a-space>
        <a-button type="primary" html-type="submit" :loading="busy" :disabled="busy || !loaded">{{ t('common.actions.save') }}</a-button>
        <a-button :disabled="busy" @click="load">{{ t('common.actions.reset') }}</a-button>
      </a-space>
      <div aria-live="polite" style="margin-top: 16px">
        <a-alert v-if="feedback" :type="feedback === 'saved' ? 'success' : 'error'" show-icon :message="t(`androidServer.${feedback}`)" />
      </div>
    </a-form>
  </a-card>
</template>
