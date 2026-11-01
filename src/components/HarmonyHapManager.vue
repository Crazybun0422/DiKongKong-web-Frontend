<script setup>
import { computed, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import http, { API_BASE_URL } from '../services/http'

const releases = ref([])
const loading = ref(false)
const uploading = ref(false)
const selecting = ref(null)
const current = computed(() => releases.value.find(item => item.selected) || releases.value[0])
const progress = ref(0)
const file = ref(null)
const fileInput = ref(null)
const notes = ref('')
const error = ref('')
const sizeLabel = bytes => `${(Number(bytes) / 1024 / 1024).toFixed(1)} MB`
const downloadUrl = item => `${API_BASE_URL.replace(/\/api\/?$/, '')}${item.downloadUrl}`
const errorMessage = (e, fallback) => e?.response?.data?.message?.zh || fallback
async function load() {
  loading.value = true
  try {
    const { data } = await http.get('/harmony/app-releases')
    if (!data.success) throw new Error()
    releases.value = data.data || []
  } catch (e) { error.value = errorMessage(e, '安装包版本加载失败，请重试') }
  finally { loading.value = false }
}
function selectFile(event) {
  error.value = ''
  const selected = event.target.files?.[0]
  if (selected && (!/\.hap$/i.test(selected.name) || !selected.size || selected.size > 350 * 1024 * 1024)) {
    error.value = '请选择不超过 350 MB 的 HAP 安装包'
    event.target.value = ''; file.value = null
  } else file.value = selected || null
}
async function upload() {
  if (!file.value || uploading.value) return
  error.value = ''; progress.value = 0; uploading.value = true
  const body = new FormData()
  body.append('file', file.value)
  body.append('releaseNotes', notes.value.trim())
  try {
    const { data } = await http.post('/harmony/app-releases', body, {
      timeout: 600000,
      onUploadProgress: event => { if (event.total) progress.value = Math.min(100, Math.round(event.loaded * 100 / event.total)) },
    })
    if (!data.success) throw new Error()
    message.success(`HarmonyOS ${data.data.versionName} 已发布，官网鸿蒙入口可下载`)
    file.value = null; notes.value = ''; if (fileInput.value) fileInput.value.value = ''
    await load()
  } catch (e) { error.value = errorMessage(e, '上传未完成或网络中断，请刷新版本列表确认后重试') }
  finally { uploading.value = false }
}
onMounted(load)
async function selectRelease(item) {
  if (selecting.value || uploading.value) return
  selecting.value = item.id; error.value = ''
  try {
    const { data } = await http.put(`/harmony/app-releases/${item.id}/active`)
    if (!data.success) throw new Error()
    await load()
    message.success(`当前版本已切换为 ${item.versionName}，官网下载已同步`)
  } catch (e) { error.value = errorMessage(e, '版本切换失败，请刷新后重试') }
  finally { selecting.value = null }
}
</script>

<template>
  <a-card title="HarmonyOS 测试安装包" class="hap-manager">
    <p class="hap-help">上传 HAP 后自动读取包名和版本，并设为当前测试版本；官网主页的鸿蒙下载入口同步生效。保留当前包及前三个历史包，可随时切换。每次上传需提高 versionCode。</p>
    <p class="hap-help">已升级用户无法直接安装较低版本编码；如需回退已安装版本，请用旧版代码提高 versionCode 后重新上传，保留原签名。</p>
    <p class="hap-help">HAP 用于签名允许的测试设备或开发工具安装；正式面向用户发布请通过华为应用市场。</p>
    <a-alert v-if="error" :message="error" type="error" show-icon class="hap-alert" />
    <div v-if="current" class="hap-current">
      <div class="hap-current-heading"><strong>当前升级版本 {{ current.versionName }}</strong><a-tag color="green">官网测试包</a-tag></div>
      <p>版本编码 {{ current.versionCode }} · {{ sizeLabel(current.sizeBytes) }} · {{ current.publishedAt?.replace('T', ' ') }}</p>
      <a :href="downloadUrl(current)" download>下载当前安装包</a>
    </div>
    <p v-else-if="!loading" class="hap-help">尚未上传鸿蒙安装包，上传后官网鸿蒙下载入口自动生效。</p>
    <a-form :model="{ file, notes }" layout="vertical" @finish="upload">
      <a-form-item label="HarmonyOS HAP 安装包">
        <input ref="fileInput" type="file" accept=".hap,application/octet-stream" :disabled="uploading" aria-label="选择 HAP 安装包" @change="selectFile" />
        <div v-if="file" class="hap-selected">{{ file.name }} · {{ sizeLabel(file.size) }}</div>
      </a-form-item>
      <a-form-item label="更新说明（选填）">
        <a-textarea v-model:value="notes" :maxlength="2000" show-count :rows="3" :disabled="uploading" placeholder="介绍本次更新内容" />
      </a-form-item>
      <div v-if="uploading" role="status" class="hap-upload-progress">
        <a-progress :percent="progress" :status="progress === 100 ? 'normal' : 'active'" />
        <span>{{ progress === 100 ? '上传完成，正在校验版本并发布…' : '正在上传安装包，请保持页面打开' }}</span>
      </div>
      <div class="hap-actions">
        <a-button type="primary" html-type="submit" :disabled="!file || uploading || !!selecting" :loading="uploading">上传并发布</a-button>
        <a-button :loading="loading" :disabled="uploading" @click="error = ''; load()">刷新版本列表</a-button>
      </div>
    </a-form>
    <div v-if="releases.length" class="hap-history">
      <strong>可用安装包与回滚选择</strong>
      <div v-for="item in releases" :key="item.id" class="hap-history-row">
        <span>{{ item.versionName }} · {{ item.versionCode }} · {{ sizeLabel(item.sizeBytes) }}</span>
        <a :href="downloadUrl(item)" download>下载安装包</a>
        <a-tag v-if="item.id === current?.id" color="green">当前升级包</a-tag>
        <a-popconfirm v-else :title="`将 ${item.versionName} 设为升级版本？`" ok-text="切换" cancel-text="取消" @confirm="selectRelease(item)">
          <a-button size="small" :disabled="uploading || !!selecting" :loading="selecting === item.id">设为升级包</a-button>
        </a-popconfirm>
      </div>
    </div>
  </a-card>
</template>

<style scoped>
.hap-help,.hap-current p,.hap-upload-progress{color:var(--admin-muted);font-size:13px;line-height:1.8}
.hap-alert{margin-bottom:16px}.hap-current{padding:16px 18px;background:var(--admin-raised);border-radius:12px;margin-bottom:22px}
.hap-current-heading,.hap-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.hap-current p{margin:8px 0}.hap-manager input[type=file]{max-width:100%}.hap-selected{overflow-wrap:anywhere;font-size:13px;margin-top:8px}
.hap-upload-progress{margin-bottom:16px}.hap-history{margin-top:24px}.hap-history summary{cursor:pointer;color:var(--admin-muted)}
.hap-history-row{display:flex;gap:12px;justify-content:space-between;flex-wrap:wrap;border-bottom:1px solid var(--admin-line);padding:12px 0;font-size:13px}
@media(max-width:480px){.hap-actions>*{flex:1}.hap-current{padding:14px}.hap-history-row{flex-direction:column}}
</style>
