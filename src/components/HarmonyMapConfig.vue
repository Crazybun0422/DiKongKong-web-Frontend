<script setup>
import { onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import http from '../services/http'

const { t } = useI18n()
const mapKey = ref('')
const loading = ref(false)
const loaded = ref(false)
const saving = ref(false)
const feedback = ref('')
const savedAt = ref('')
const load = async () => {
  if (loading.value || saving.value) return
  feedback.value = ''
  loading.value = true
  try {
    const response = await http.get('/harmony/config/map-key')
    if (response.data?.success !== true) throw new Error('load-failed')
    mapKey.value = response.data?.data?.mapKey || ''
    loaded.value = true
  } catch {
    feedback.value = 'loadFailed'
    message.error(t('harmonyMap.loadFailed'))
  } finally { loading.value = false }
}
const save = async () => {
  if (loading.value || saving.value || !loaded.value) return
  feedback.value = ''
  const value = mapKey.value.trim()
  if (!/^[A-Za-z0-9-]{0,128}$/.test(value)) {
    feedback.value = 'invalid'
    message.error(t('harmonyMap.invalid'))
    return
  }
  saving.value = true
  try {
    const response = await http.post('/auth/harmony/config', { mapKey: value })
    if (response.data?.success !== true) throw new Error('save-failed')
    mapKey.value = value
    savedAt.value = new Date().toLocaleTimeString()
    feedback.value = 'saved'
    message.success(t('harmonyMap.saved'))
  } catch {
    feedback.value = 'saveFailed'
    message.error(t('harmonyMap.saveFailed'))
  }
  finally { saving.value = false }
}
onMounted(load)
</script>

<template>
  <a-card :title="t('harmonyMap.title')" style="margin-bottom: 24px">
    <p>{{ t('harmonyMap.description') }}</p>
    <a-spin :spinning="loading">
      <a-form :model="{ mapKey }" layout="vertical" @finish="save">
        <a-form-item name="mapKey" :label="t('harmonyMap.label')">
          <a-input v-model:value="mapKey" :placeholder="t('harmonyMap.placeholder')" :maxlength="128" :disabled="saving || loading || !loaded" @change="feedback = ''" />
        </a-form-item>
        <a-space>
          <a-button type="primary" html-type="submit" :loading="saving" :disabled="loading || !loaded">{{ t('common.actions.save') }}</a-button>
          <a-button @click="load" :disabled="loading || saving">{{ t('common.actions.reset') }}</a-button>
        </a-space>
        <div aria-live="polite" style="margin-top: 16px">
          <a-alert v-if="feedback" :type="feedback === 'saved' ? 'success' : 'error'" show-icon
            :message="feedback === 'saved' ? t('harmonyMap.savedAt', { time: savedAt }) : t(`harmonyMap.${feedback}`)" />
        </div>
      </a-form>
    </a-spin>
  </a-card>
</template>
