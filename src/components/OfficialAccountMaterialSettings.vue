<script setup>
import { onMounted, ref } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  createOfficialAccountMaterial,
  deleteOfficialAccountMaterial,
  fetchOfficialAccountMaterials,
  fetchOfficialAccountPublishConfig,
  updateOfficialAccountMaterial,
  updateOfficialAccountPublishConfig,
} from '../services/officialAccountMaterials'
import { buildDownloadUrl, extractObjectName, uploadPublicFile } from '../services/files'

const MAX_IMAGES = 9
const loading = ref(false)
const saving = ref(false)
const uploading = ref(false)
const configLoading = ref(false)
const configSaving = ref(false)
const rows = ref([])
const page = ref(0)
const size = ref(10)
const total = ref(0)
const editorOpen = ref(false)
const editingId = ref('')
const fileInput = ref(null)
const form = ref(emptyForm())
const publishConfig = ref({
  topic: '#航拍作品分享',
  limit: 10,
  recommendPath: '/pages/map/map',
  recommendTitle: '了解我们头顶的空域划分',
})

const columns = [
  { title: '素材', key: 'material' },
  { title: '发布奖励', key: 'reward', width: 120 },
  { title: '状态', key: 'enabled', width: 90 },
  { title: '更新时间', key: 'updatedAt', width: 180 },
  { title: '操作', key: 'actions', width: 150 },
]

function emptyForm() {
  return { title: '', content: '', tagsText: '航拍作品分享', rewardFlp: 0.2, enabled: true, images: [] }
}

const formatTime = (value) => (value ? String(value).replace('T', ' ').slice(0, 19) : '-')
const imageUrl = (name) => buildDownloadUrl(extractObjectName(name) || name)

const loadPublishConfig = async () => {
  configLoading.value = true
  try {
    const result = await fetchOfficialAccountPublishConfig()
    publishConfig.value = {
      topic: result?.topic || '',
      limit: Number(result?.limit) || 10,
      recommendPath: result?.recommendPath || '',
      recommendTitle: result?.recommendTitle || '',
    }
  } catch (error) {
    console.error('Failed to load official-account publish config', error)
    message.error('加载贴图专栏配置失败')
  } finally {
    configLoading.value = false
  }
}

const savePublishConfig = async () => {
  const payload = {
    topic: String(publishConfig.value.topic || '').trim(),
    limit: Number(publishConfig.value.limit) || 0,
    recommendPath: String(publishConfig.value.recommendPath || '').trim(),
    recommendTitle: String(publishConfig.value.recommendTitle || '').trim(),
  }
  if (!payload.topic) return message.warning('请输入话题名称')
  if (payload.limit < 1 || payload.limit > 10) return message.warning('展示数量应为 1 至 10 条')
  if (!/^\/(?!\/)/.test(payload.recommendPath)) return message.warning('跳转页面必须是以 / 开头的小程序页面路径')
  if (!payload.recommendTitle) return message.warning('请输入链接卡片标题')
  configSaving.value = true
  try {
    publishConfig.value = await updateOfficialAccountPublishConfig(payload)
    message.success('贴图专栏配置已保存')
  } catch (error) {
    console.error('Failed to save official-account publish config', error)
    message.error('保存贴图专栏配置失败')
  } finally {
    configSaving.value = false
  }
}

const loadRows = async (nextPage = page.value) => {
  loading.value = true
  try {
    const result = await fetchOfficialAccountMaterials({ page: nextPage, size: size.value })
    rows.value = Array.isArray(result?.content) ? result.content : []
    page.value = Number(result?.page) || 0
    total.value = Number(result?.totalElements) || 0
  } catch (error) {
    console.error('Failed to load official-account materials', error)
    message.error('加载贴图素材失败')
  } finally {
    loading.value = false
  }
}

const openCreate = () => {
  editingId.value = ''
  form.value = emptyForm()
  editorOpen.value = true
}

const openEdit = (record) => {
  editingId.value = record.id
  form.value = {
    title: record.title || '',
    content: record.content || '',
    tagsText: (record.tags || []).join('、'),
    rewardFlp: Number(record.rewardFlp) || 0,
    enabled: record.enabled !== false,
    images: (record.imageFileNames || []).map((objectName, index) => ({
      uid: `${record.id}-${index}`,
      objectName: extractObjectName(objectName) || objectName,
      url: imageUrl(objectName),
    })),
  }
  editorOpen.value = true
}

const collectPasteFiles = (event) => {
  const clipboard = event?.clipboardData
  if (!clipboard) return []
  const fromItems = Array.from(clipboard.items || [])
    .filter((item) => item.kind === 'file' && /^image\//i.test(item.type || ''))
    .map((item) => item.getAsFile())
    .filter(Boolean)
  return fromItems.length
    ? fromItems
    : Array.from(clipboard.files || []).filter((file) => /^image\//i.test(file.type || ''))
}

const uploadImages = async (files) => {
  const images = Array.from(files || []).filter((file) => /^image\//i.test(file.type || ''))
  const remain = MAX_IMAGES - form.value.images.length
  if (!images.length || remain <= 0) {
    if (remain <= 0) message.warning(`最多上传 ${MAX_IMAGES} 张图片`)
    return
  }
  uploading.value = true
  try {
    const uploaded = []
    for (const file of images.slice(0, remain)) {
      const result = await uploadPublicFile(file)
      const objectName = extractObjectName(result?.objectName || result?.url || '')
      if (!objectName) continue
      uploaded.push({ uid: `${Date.now()}-${Math.random()}`, objectName, url: buildDownloadUrl(objectName) })
    }
    form.value.images = [...form.value.images, ...uploaded]
  } catch (error) {
    console.error('Failed to upload material image', error)
    message.error('图片上传失败')
  } finally {
    uploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

const handlePaste = async (event) => {
  const files = collectPasteFiles(event)
  if (!files.length) return
  event.preventDefault()
  await uploadImages(files)
}

const removeImage = (uid) => {
  form.value.images = form.value.images.filter((item) => item.uid !== uid)
}

const submit = async () => {
  const title = String(form.value.title || '').trim()
  const content = String(form.value.content || '').trim()
  if (!title) return message.warning('请输入素材标题')
  if (!content && !form.value.images.length) return message.warning('请输入内容或添加图片')
  if (uploading.value) return message.warning('图片仍在上传')
  const payload = {
    title,
    content,
    imageFileNames: form.value.images.map((item) => item.objectName),
    tags: String(form.value.tagsText || '')
      .split(/[、,，\s]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 10),
    rewardFlp: Math.max(0, Number(form.value.rewardFlp) || 0),
    enabled: Boolean(form.value.enabled),
  }
  saving.value = true
  try {
    if (editingId.value) await updateOfficialAccountMaterial(editingId.value, payload)
    else await createOfficialAccountMaterial(payload)
    message.success(editingId.value ? '素材已更新' : '素材已发布')
    editorOpen.value = false
    await loadRows(editingId.value ? page.value : 0)
  } catch (error) {
    console.error('Failed to save official-account material', error)
    message.error('保存贴图素材失败')
  } finally {
    saving.value = false
  }
}

const removeRecord = (record) => {
  Modal.confirm({
    title: '删除贴图素材',
    content: `确定删除“${record.title}”吗？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      await deleteOfficialAccountMaterial(record.id)
      message.success('素材已删除')
      await loadRows(rows.value.length === 1 && page.value > 0 ? page.value - 1 : page.value)
    },
  })
}

const handleTableChange = (pagination) => {
  size.value = Number(pagination?.pageSize) || size.value
  loadRows(Math.max(0, Number(pagination?.current || 1) - 1))
}

onMounted(() => Promise.all([loadPublishConfig(), loadRows()]))
</script>

<template>
  <section class="material-settings">
    <div class="publish-config">
      <div class="publish-config-heading">
        <div>
          <h4>贴图专栏配置</h4>
          <p>统一控制贴图专栏和素材同步发布参数。</p>
        </div>
        <a-button type="primary" :loading="configSaving" :disabled="configLoading" @click="savePublishConfig">保存配置</a-button>
      </div>
      <a-form layout="vertical" class="publish-config-form">
        <a-form-item label="话题名称">
          <a-input v-model:value="publishConfig.topic" :maxlength="20" placeholder="#航拍作品分享" />
        </a-form-item>
        <a-form-item label="展示数量">
          <a-input-number v-model:value="publishConfig.limit" :min="1" :max="10" :precision="0" />
        </a-form-item>
        <a-form-item label="链接卡片跳转页面">
          <a-input v-model:value="publishConfig.recommendPath" :maxlength="200" placeholder="/pages/map/map" />
        </a-form-item>
        <a-form-item label="链接卡片标题">
          <a-input v-model:value="publishConfig.recommendTitle" :maxlength="100" placeholder="了解我们头顶的空域划分" />
        </a-form-item>
      </a-form>
    </div>

    <header class="material-header">
      <div>
        <h4>贴图素材中心</h4>
        <p>发布平台素材，用户可同步到公众号贴图并获得对应FLP。</p>
      </div>
      <div class="material-actions">
        <a-button type="primary" @click="openCreate">发布素材</a-button>
        <a-button :loading="loading" @click="loadRows()">刷新</a-button>
      </div>
    </header>

    <a-table
      row-key="id"
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :pagination="{ current: page + 1, pageSize: size, total, showSizeChanger: true }"
      @change="handleTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'material'">
          <div class="material-title">{{ record.title }}</div>
          <div class="material-copy">{{ record.content || '图片素材' }}</div>
          <div v-if="record.imageFileNames?.length" class="material-thumbs">
            <img v-for="name in record.imageFileNames.slice(0, 5)" :key="name" :src="imageUrl(name)" alt="" />
            <span v-if="record.imageFileNames.length > 5">+{{ record.imageFileNames.length - 5 }}</span>
          </div>
        </template>
        <template v-else-if="column.key === 'reward'">{{ Number(record.rewardFlp || 0) }} FLP</template>
        <template v-else-if="column.key === 'enabled'">
          <a-tag :color="record.enabled ? 'green' : 'default'">{{ record.enabled ? '已上架' : '已下架' }}</a-tag>
        </template>
        <template v-else-if="column.key === 'updatedAt'">{{ formatTime(record.updatedAt || record.createdAt) }}</template>
        <template v-else-if="column.key === 'actions'">
          <a-space>
            <a-button type="link" size="small" @click="openEdit(record)">编辑</a-button>
            <a-button type="link" danger size="small" @click="removeRecord(record)">删除</a-button>
          </a-space>
        </template>
      </template>
    </a-table>

    <a-modal v-model:open="editorOpen" :title="editingId ? '编辑贴图素材' : '发布贴图素材'" :confirm-loading="saving" @ok="submit">
      <a-form layout="vertical">
        <a-form-item label="素材标题"><a-input v-model:value="form.title" :maxlength="100" /></a-form-item>
        <a-form-item label="图文内容">
          <a-textarea v-model:value="form.content" :rows="5" @paste="handlePaste" placeholder="输入文案，可直接粘贴图片" />
        </a-form-item>
        <div class="material-upload" @paste="handlePaste">
          <div class="upload-toolbar">
            <span>图片（最多 {{ MAX_IMAGES }} 张）</span>
            <a-button size="small" :loading="uploading" @click="fileInput?.click()">选择图片</a-button>
            <input ref="fileInput" hidden type="file" accept="image/*" multiple @change="uploadImages($event.target.files)" />
          </div>
          <div v-if="form.images.length" class="editor-thumbs">
            <div v-for="item in form.images" :key="item.uid" class="editor-thumb">
              <img :src="item.url" alt="" />
              <button type="button" @click="removeImage(item.uid)">×</button>
            </div>
          </div>
        </div>
        <a-form-item label="话题标签"><a-input v-model:value="form.tagsText" placeholder="多个标签用逗号分隔" /></a-form-item>
        <div class="form-inline">
          <a-form-item label="发布奖励"><a-input-number v-model:value="form.rewardFlp" :min="0" :precision="4" addon-after="FLP" /></a-form-item>
          <a-form-item label="上架"><a-switch v-model:checked="form.enabled" /></a-form-item>
        </div>
      </a-form>
    </a-modal>
  </section>
</template>

<style scoped>
.material-settings { padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; }
.publish-config { margin-bottom: 20px; padding-bottom: 18px; border-bottom: 1px solid #e5e7eb; }
.publish-config-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
.publish-config-heading h4 { margin: 0; font-size: 17px; color: #0f172a; }
.publish-config-heading p { margin: 5px 0 0; color: #64748b; font-size: 13px; }
.publish-config-form { display: grid; grid-template-columns: minmax(180px, .8fr) 120px minmax(260px, 1.2fr) minmax(260px, 1.2fr); gap: 12px; }
.publish-config-form :deep(.ant-form-item) { margin-bottom: 0; }
.publish-config-form :deep(.ant-input-number) { width: 100%; }
.material-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
.material-header h4 { margin: 0; font-size: 17px; color: #0f172a; }
.material-header p { margin: 5px 0 0; color: #64748b; font-size: 13px; }
.material-actions, .upload-toolbar, .form-inline { display: flex; align-items: center; gap: 10px; }
.material-title { font-weight: 700; color: #0f172a; }
.material-copy { max-width: 680px; margin-top: 3px; overflow: hidden; color: #64748b; white-space: nowrap; text-overflow: ellipsis; }
.material-thumbs, .editor-thumbs { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.material-thumbs img { width: 40px; height: 40px; object-fit: cover; border-radius: 4px; }
.material-thumbs span { align-self: center; color: #64748b; }
.material-upload { margin: -4px 0 18px; padding: 10px; border: 1px dashed #cbd5e1; border-radius: 6px; }
.upload-toolbar { justify-content: space-between; color: #475569; }
.editor-thumb { position: relative; width: 68px; height: 68px; overflow: hidden; border-radius: 5px; }
.editor-thumb img { width: 100%; height: 100%; object-fit: cover; }
.editor-thumb button { position: absolute; top: 3px; right: 3px; width: 20px; height: 20px; padding: 0; border: 0; border-radius: 50%; background: rgba(15, 23, 42, .72); color: #fff; cursor: pointer; }
.form-inline { align-items: flex-end; }
.form-inline :deep(.ant-form-item) { margin-bottom: 0; }
@media (max-width: 1100px) {
  .publish-config-form { grid-template-columns: 1fr 120px; }
}
</style>
