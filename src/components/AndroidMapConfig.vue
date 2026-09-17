<script setup>
import { onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import http from '../services/http'

const { t } = useI18n()
const mapKey = ref('')
const loading = ref(false)
const saving = ref(false)
const feedback = ref('')
const savedAt = ref('')
const load = async () => {
  if (loading.value || saving.value) return
  feedback.value = ''
  loading.value = true
  try {
    const response = await http.get('/android/config/map-key')
    if (response.data?.success !== true) throw new Error('load-failed')
    mapKey.value = response.data?.data?.mapKey || ''
  } catch {
    feedback.value = 'loadFailed'
    message.error(t('androidMap.loadFailed'))
  } finally { loading.value = false }
}
const save = async () => {
  if (loading.value || saving.value) return
  feedback.value = ''
  const value = mapKey.value.trim()
  if (!/^[A-Za-z0-9-]{1,128}$/.test(value)) {
    feedback.value = 'invalid'
    message.error(t('androidMap.invalid'))
    return
  }
  saving.value = true
  try {
    const response = await http.post('/auth/android/config', { mapKey: value })
    if (response.data?.success !== true) throw new Error('save-failed')
    mapKey.value = value
    savedAt.value = new Date().toLocaleTimeString()
    feedback.value = 'saved'
    message.success(t('androidMap.saved'))
  } catch {
    feedback.value = 'saveFailed'
    message.error(t('androidMap.saveFailed'))
  }
  finally { saving.value = false }
}
onMounted(load)
</script>

<template>
  <a-card :title="t('androidMap.title')" style="margin-bottom: 24px">
    <p>{{ t('androidMap.description') }}</p>
    <a-spin :spinning="loading">
      <a-form :model="{ mapKey }" layout="vertical" @finish="save">
        <a-form-item name="mapKey" :label="t('androidMap.label')">
          <a-input v-model:value="mapKey" :placeholder="t('androidMap.placeholder')" :maxlength="128" :disabled="saving || loading" @change="feedback = ''" />
        </a-form-item>
        <a-space>
          <a-button type="primary" html-type="submit" :loading="saving" :disabled="loading">{{ t('common.actions.save') }}</a-button>
          <a-button @click="load" :disabled="loading || saving">{{ t('common.actions.reset') }}</a-button>
        </a-space>
        <div aria-live="polite" style="margin-top: 16px">
          <a-alert v-if="feedback" :type="feedback === 'saved' ? 'success' : 'error'" show-icon
            :message="feedback === 'saved' ? t('androidMap.savedAt', { time: savedAt }) : t(`androidMap.${feedback}`)" />
        </div>
      </a-form>
    </a-spin>
  </a-card>
</template>
