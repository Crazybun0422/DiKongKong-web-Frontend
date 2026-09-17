<script setup>
import { onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import http from '../services/http'

const { t } = useI18n()
const closed = ref(false), loading = ref(false), saving = ref(false), loaded = ref(false), loadFailed = ref(false)
async function load() {
  if (loading.value || saving.value) return
  loading.value = true
  loaded.value = false
  loadFailed.value = false
  try {
    const { data } = await http.get('/auth/social-config')
    if (!data?.success || typeof data.data?.closed !== 'boolean') throw new Error()
    closed.value = data.data.closed
    loaded.value = true
  } catch {
    loadFailed.value = true
    message.error(t('socialSettings.loadFailed'))
  } finally { loading.value = false }
}
async function save() {
  if (!loaded.value || loading.value || saving.value) return
  saving.value = true
  try {
    const { data } = await http.post('/auth/social-config', { closed: closed.value })
    if (!data?.success || typeof data.data?.closed !== 'boolean') throw new Error(data?.message?.zh || t('socialSettings.saveFailed'))
    closed.value = data.data.closed
    message.success(t('socialSettings.saved'))
  } catch (error) { message.error(error.response?.data?.message?.zh || error.message || t('socialSettings.saveFailed')) }
  finally { saving.value = false }
}
onMounted(load)
</script>

<template>
  <a-card :title="t('socialSettings.title')">
    <a-spin :spinning="loading">
      <a-form layout="vertical">
        <a-form-item :label="t('socialSettings.closed')" :help="t('socialSettings.help')">
          <a-switch v-model:checked="closed" :disabled="!loaded || loading || saving" />
        </a-form-item>
        <a-alert v-if="loadFailed" type="error" show-icon :message="t('socialSettings.loadFailed')" style="margin-bottom: 16px" />
        <a-space style="margin-top: 16px">
          <a-button type="primary" html-type="button" :loading="saving" :disabled="!loaded || loading || saving" @click="save">{{ t('common.actions.save') }}</a-button>
          <a-button :disabled="loading || saving" @click="load">{{ t('common.actions.reset') }}</a-button>
        </a-space>
      </a-form>
    </a-spin>
  </a-card>
</template>
