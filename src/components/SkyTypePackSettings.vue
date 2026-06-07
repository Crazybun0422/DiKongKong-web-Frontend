<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { ReloadOutlined, UploadOutlined } from '@ant-design/icons-vue'
import { useI18n } from 'vue-i18n'
import {
  buildSkyTypeAvatarPackDownloadUrl,
  fetchSkyTypeAvatarPackVersion,
  uploadSkyTypeAvatarPack,
} from '../services/skyTypeAvatarPack'
import { extractObjectName } from '../services/files'

const { t } = useI18n()

const packLoading = ref(false)
const packSaving = ref(false)
const selectedFile = ref(null)
const fileInputRef = ref(null)

const packConfig = reactive({
  fileName: '',
  version: '',
})

const packForm = reactive({
  fileName: '',
  version: '',
})

const packageTree = `low_altitude_skytype_posters_en/
  female/
    airspace_night_guardian.png
    beginner_pilot.png
    cloud_hunter.png
    low_altitude_execution_officer.png
    sky_director.png
    stargroup_leader.png
    wind_rider_fpv.png
  male/
    airspace_night_guardian.png
    beginner_pilot.png
    cloud_hunter.png
    low_altitude_execution_officer.png
    sky_director.png
    stargroup_leader.png
    wind_rider_fpv.png`

const currentDownloadUrl = computed(() =>
  packConfig.fileName ? buildSkyTypeAvatarPackDownloadUrl(packConfig.fileName) : '',
)

const bumpVersion = (version) => {
  const parts = String(version || '').trim().split('.')
  if (parts.length >= 3 && parts.every((part) => /^\d+$/.test(part))) {
    parts[parts.length - 1] = String(Number(parts[parts.length - 1]) + 1)
    return parts.join('.')
  }
  return version ? `${version}.1` : '1.0.0'
}

const resetForm = (version = '') => {
  selectedFile.value = null
  packForm.fileName = ''
  packForm.version = bumpVersion(version)
}

const loadPackVersion = async () => {
  packLoading.value = true
  try {
    const data = await fetchSkyTypeAvatarPackVersion()
    const normalized = data || {}
    packConfig.fileName = extractObjectName(normalized.fileName || '')
    packConfig.version = normalized.version || ''
  } catch (error) {
    if (error?.response?.status !== 404) {
      console.error('Failed to load sky type avatar pack config', error)
      message.error(t('settings.system.skyTypeAvatarPack.messages.loadFailed'))
    }
    packConfig.fileName = ''
    packConfig.version = ''
  } finally {
    packLoading.value = false
    resetForm(packConfig.version)
  }
}

const handleFileSelect = (event) => {
  const file = event?.target?.files?.[0]
  if (!file) return
  selectedFile.value = file
  packForm.fileName = file.name || ''
  if (!String(packForm.version || '').trim()) {
    packForm.version = bumpVersion(packConfig.version)
  }
  if (event?.target) {
    event.target.value = ''
  }
}

const clearSelection = () => {
  selectedFile.value = null
  packForm.fileName = ''
}

const triggerFileSelect = () => {
  if (packSaving.value) return
  fileInputRef.value?.click()
}

const submitUpload = async () => {
  if (!selectedFile.value) {
    message.warning(t('settings.system.skyTypeAvatarPack.messages.noFile'))
    return
  }
  const version = String(packForm.version || '').trim()
  if (!version) {
    message.warning(t('settings.system.skyTypeAvatarPack.messages.noVersion'))
    return
  }
  if (packSaving.value) return

  packSaving.value = true
  try {
    await uploadSkyTypeAvatarPack(selectedFile.value, version)
    message.success(t('settings.system.skyTypeAvatarPack.messages.uploadSuccess'))
    await loadPackVersion()
  } catch (error) {
    console.error('Failed to upload sky type avatar pack', error)
    message.error(t('settings.system.skyTypeAvatarPack.messages.uploadFailed'))
  } finally {
    packSaving.value = false
  }
}

onMounted(() => {
  loadPackVersion()
})
</script>

<template>
  <section class="skytype-pack">
    <header class="section-header skytype-pack__header">
      <div>
        <h3>{{ t('settings.system.skyTypeAvatarPack.title') }}</h3>
        <p>{{ t('settings.system.skyTypeAvatarPack.subtitle') }}</p>
      </div>
      <div class="skytype-pack__meta">
        <span class="skytype-pack__meta-label">
          {{ t('settings.system.skyTypeAvatarPack.currentVersionLabel') }}
        </span>
        <span class="skytype-pack__meta-value">
          {{ packConfig.version || t('settings.system.skyTypeAvatarPack.emptyVersion') }}
        </span>
      </div>
    </header>

    <a-spin :spinning="packLoading">
      <div class="skytype-pack__current">
        <span class="skytype-pack__current-label">
          {{ t('settings.system.skyTypeAvatarPack.currentFileLabel') }}
        </span>
        <a v-if="packConfig.fileName" :href="currentDownloadUrl" target="_blank" rel="noreferrer">
          {{ packConfig.fileName }}
        </a>
        <span v-else class="empty-hint">
          {{ t('settings.system.skyTypeAvatarPack.emptyFile') }}
        </span>
      </div>

      <div class="skytype-pack__content">
        <div class="skytype-pack__form">
          <a-form layout="vertical">
            <a-form-item :label="t('settings.system.skyTypeAvatarPack.fields.file')">
              <div class="skytype-pack__upload">
                <input
                  ref="fileInputRef"
                  class="skytype-pack__input"
                  type="file"
                  accept=".zip,.rar,.7z"
                  :disabled="packSaving"
                  hidden
                  @change="handleFileSelect"
                />
                <div class="skytype-pack__trigger">
                  <a-button type="dashed" @click="triggerFileSelect">
                    <template #icon><UploadOutlined /></template>
                    {{
                      packForm.fileName
                        ? t('settings.system.skyTypeAvatarPack.actions.replaceFile')
                        : t('settings.system.skyTypeAvatarPack.actions.selectFile')
                    }}
                  </a-button>
                </div>
                <span v-if="packForm.fileName" class="skytype-pack__file-name">
                  {{ packForm.fileName }}
                </span>
                <a-button v-if="packForm.fileName" type="link" danger @click="clearSelection">
                  {{ t('settings.system.skyTypeAvatarPack.actions.removeFile') }}
                </a-button>
              </div>
              <div class="skytype-pack__helper">
                {{ t('settings.system.skyTypeAvatarPack.helper') }}
              </div>
            </a-form-item>

            <a-form-item :label="t('settings.system.skyTypeAvatarPack.fields.version')">
              <a-input
                v-model:value="packForm.version"
                :placeholder="t('settings.system.skyTypeAvatarPack.placeholders.version')"
              />
            </a-form-item>

            <div class="skytype-pack__actions">
              <a-button type="primary" :loading="packSaving" @click="submitUpload">
                {{ t('settings.system.skyTypeAvatarPack.actions.upload') }}
              </a-button>
              <a-button type="default" :disabled="packSaving || packLoading" @click="loadPackVersion">
                <template #icon><ReloadOutlined /></template>
                {{ t('settings.system.skyTypeAvatarPack.actions.reload') }}
              </a-button>
            </div>
          </a-form>
        </div>

        <div class="skytype-pack__spec">
          <div class="skytype-pack__spec-title">
            {{ t('settings.system.skyTypeAvatarPack.structureTitle') }}
          </div>
          <pre class="skytype-pack__tree">{{ packageTree }}</pre>
        </div>
      </div>
    </a-spin>
  </section>
</template>

<style scoped>
.skytype-pack {
  display: flex;
  flex-direction: column;
  gap: 20px;
  border-radius: 16px;
  background: #fff;
  padding: 24px;
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.06);
}

.skytype-pack__header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.skytype-pack__meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  color: #475569;
  font-size: 13px;
}

.skytype-pack__meta-label,
.skytype-pack__current-label,
.skytype-pack__spec-title {
  color: #64748b;
  font-weight: 600;
}

.skytype-pack__meta-value {
  color: #0f172a;
  font-weight: 600;
}

.skytype-pack__current {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  font-size: 14px;
}

.skytype-pack__content {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
  gap: 24px;
}

.skytype-pack__upload {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.skytype-pack__trigger {
  display: inline-flex;
}

.skytype-pack__input {
  display: none;
}

.skytype-pack__file-name {
  font-size: 13px;
  color: #0f172a;
  word-break: break-all;
}

.skytype-pack__helper {
  margin-top: 8px;
  color: #64748b;
  font-size: 13px;
}

.skytype-pack__actions {
  display: flex;
  gap: 12px;
}

.skytype-pack__spec {
  border-radius: 12px;
  background: linear-gradient(180deg, #eff6ff 0%, #f8fafc 100%);
  padding: 16px;
  border: 1px solid #dbeafe;
}

.skytype-pack__tree {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: #0f172a;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 960px) {
  .skytype-pack__header {
    flex-direction: column;
  }

  .skytype-pack__meta {
    align-items: flex-start;
  }

  .skytype-pack__content {
    grid-template-columns: 1fr;
  }
}
</style>
