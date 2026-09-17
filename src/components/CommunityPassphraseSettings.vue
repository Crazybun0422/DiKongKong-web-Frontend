<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import http from '../services/http'

const base = '/community-passphrases/admin'
const route = useRoute()
const loading = ref(false), saving = ref(false), loaded = ref(false), fileInput = ref(null)
const date = ref(''), wordCount = ref(0), claimedCount = ref(0), words = ref([])
const stock = ref(null)
const config = reactive({ firstCount: 100, firstReward: 0.5, laterReward: 0.2 })
const today = reactive({ word: '', explanation: '' })
const wordsLoading = ref(false), wordsError = ref(''), wordSaving = ref(false), editorOpen = ref(false)
const wordPage = ref(1), wordPageSize = ref(10), nextSerial = ref(1), originalSerial = ref(null)
const wordForm = reactive({ serial: null, word: '', explanation: '', previousWord: '', previousExplanation: '' })
let wordsVersion = 0, disposed = false
const disabled = computed(() => !loaded.value || loading.value || saving.value || wordSaving.value || editorOpen.value)
const pagination = computed(() => ({
  current: wordPage.value, pageSize: wordPageSize.value, total: wordCount.value,
  showSizeChanger: true, showQuickJumper: true, pageSizeOptions: ['10', '20', '50', '100'],
  showTotal: total => `共 ${total} 条`,
}))
const columns = [{ title: '序号', dataIndex: 'serial', width: 80 }, { title: '词语 / 口令', dataIndex: 'word', width: 160 }, { title: '讲解正文', dataIndex: 'explanation' }, { title: '状态', key: 'used', width: 90 }, { title: '操作', key: 'actions', width: 85 }]
const errorText = (error) => error?.response?.data?.message?.zh || error?.message || '操作失败，请重试'
async function load() {
  loading.value = true
  try {
    const { data } = await http.get(base)
    if (!data?.success) throw new Error(data?.message?.zh || '加载失败')
    const value = data.data
    date.value = value.date
    Object.assign(config, value.config)
    Object.assign(today, { word: value.today?.word || '', explanation: value.today?.explanation || '' })
    claimedCount.value = value.today?.claimedCount || 0
    wordCount.value = value.wordCount
    stock.value = value.stock
    loaded.value = true
    await loadWords()
  } catch (error) { loaded.value = false; message.error(errorText(error)) }
  finally { loading.value = false }
}
async function loadWords(page = wordPage.value, size = wordPageSize.value) {
  const version = ++wordsVersion
  wordsLoading.value = true
  wordsError.value = ''
  wordPage.value = page
  wordPageSize.value = size
  try {
    const { data } = await http.get(`${base}/words`, { params: { page, size } })
    if (disposed || version !== wordsVersion) return
    if (!data?.success || !Array.isArray(data.data?.items)) throw new Error('词库加载失败')
    const result = data.data
    words.value = result.items
    wordPage.value = result.page
    wordPageSize.value = result.size
    wordCount.value = result.total
    nextSerial.value = result.nextSerial
    stock.value = result.stock
  } catch (error) {
    if (!disposed && version === wordsVersion) { words.value = []; wordsError.value = errorText(error) }
  } finally { if (!disposed && version === wordsVersion) wordsLoading.value = false }
}
function onTableChange(value) {
  if (disabled.value) return
  const size = Number(value.pageSize)
  return loadWords(size === wordPageSize.value ? Number(value.current) : 1, size)
}
function openWordEditor(record = null) {
  if (disabled.value || wordsLoading.value) return
  originalSerial.value = record?.serial ?? null
  Object.assign(wordForm, {
    serial: record?.serial ?? (nextSerial.value <= 2147483647 ? nextSerial.value : null),
    word: record?.word || '', explanation: record?.explanation || '',
    previousWord: record?.word || '', previousExplanation: record?.explanation || '',
  })
  editorOpen.value = true
}
async function saveWord() {
  if (wordSaving.value) return
  if (wordForm.serial != null && (!Number.isInteger(wordForm.serial) || wordForm.serial < 1 || wordForm.serial > 2147483647)) return message.warning('序号须为正整数')
  const payload = { ...wordForm, word: wordForm.word.trim(), explanation: wordForm.explanation.trim() }
  if (!payload.word || !payload.explanation) return message.warning('请填写词语和讲解正文')
  if (Array.from(payload.word).length > 32 || Array.from(payload.explanation).length > 2000) return message.warning('词语最多32字，讲解正文最多2000字')
  wordSaving.value = true
  try {
    const { data } = originalSerial.value == null
      ? await http.post(`${base}/words`, payload)
      : await http.put(`${base}/words/${originalSerial.value}`, payload)
    if (disposed) return
    if (!data?.success) throw new Error(data?.message?.zh || '保存失败')
    editorOpen.value = false
    message.success(originalSerial.value == null ? '词语已新增' : '词语已保存')
    await loadWords(Math.max(1, Math.ceil(data.data.position / wordPageSize.value)))
  } catch (error) { if (!disposed) message.error(errorText(error)) }
  finally { if (!disposed) wordSaving.value = false }
}
async function saveConfig() {
  if (disabled.value) return
  if (!Number.isInteger(config.firstCount) || config.firstReward == null || config.laterReward == null) return message.warning('请完整填写奖励配置')
  saving.value = true
  try { await http.put(`${base}/config`, { ...config }); message.success('口令奖励配置已保存') }
  catch (error) { message.error(errorText(error)) }
  finally { saving.value = false }
}
async function saveToday() {
  if (disabled.value) return
  if (!today.word.trim() || !today.explanation.trim()) return message.warning('请填写词语和讲解正文')
  saving.value = true
  try {
    const { data } = await http.put(`${base}/today`, { date: date.value, word: today.word.trim(), explanation: today.explanation.trim() })
    Object.assign(today, { word: data.data.word, explanation: data.data.explanation })
    claimedCount.value = data.data.claimedCount
    message.success('今日口令已更新，领取记录和输错次数保持不变')
    try {
      const response = await http.get(`${base}/stock`)
      stock.value = response.data.data
    } catch { message.warning('口令已保存，库存状态刷新失败，请稍后刷新') }
  } catch (error) { message.error(errorText(error)) }
  finally { saving.value = false }
}
function resetClaims() {
  if (disabled.value) return
  const resetDate = date.value
  Modal.confirm({
    title: `重置 ${resetDate} 的领取状态？`,
    content: '当天已领取的人员将可以再次领取奖励。已发放的FLP保留，累计领取顺序和输错次数不变。',
    okText: '重置领取', cancelText: '取消', okType: 'danger',
    async onOk() {
      saving.value = true
      try {
        const { data } = await http.post(`${base}/reset-claims`, { date: resetDate })
        if (!data?.success) throw new Error(data?.message?.zh || '重置失败')
        message.success(`已重置 ${data.data.resetCount} 人的领取状态`)
      } catch (error) { message.error(errorText(error)); throw error }
      finally { saving.value = false }
    },
  })
}
async function downloadTemplate() {
  try {
    const { data } = await http.get(`${base}/words/template`, { responseType: 'blob' })
    const url = URL.createObjectURL(data), link = document.createElement('a')
    link.href = url; link.download = '口令词库模板.xlsx'; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch { message.error('模板下载失败，请重试') }
}
function chooseFile(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  if (!/\.xlsx$/i.test(file.name) || file.size > 2 * 1024 * 1024) return message.warning('请选择不超过2MB的.xlsx文件')
  Modal.confirm({
    title: '替换提示词库？',
    content: `将使用“${file.name}”替换现有词库。已经生成的今日口令保持不变，可在下方单独修改。`,
    okText: '上传并替换', cancelText: '取消',
    async onOk() {
      saving.value = true
      try {
        const form = new FormData(); form.append('file', file)
        const { data } = await http.post(`${base}/words/import`, form)
        message.success(`已导入 ${data.data.count} 条词语`)
        wordPage.value = 1
        await load()
      } catch (error) { message.error(errorText(error)); throw error }
      finally { saving.value = false }
    }
  })
}
onMounted(async () => {
  await load()
  if (route.hash === '#community-passphrase') {
    await nextTick()
    document.getElementById('community-passphrase')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }
})
onBeforeUnmount(() => { disposed = true; wordsVersion++ })
</script>

<template>
  <a-card id="community-passphrase" title="社群口令福利" class="passphrase-settings">
    <template #extra><a-button :loading="loading" :disabled="saving || wordSaving || editorOpen" @click="load">刷新</a-button></template>
    <a-alert v-if="!loaded && !loading" type="error" message="口令设置加载失败，请点击刷新" show-icon />
    <a-spin :spinning="loading">
      <a-alert v-if="stock?.low" :type="stock.exhausted ? 'error' : 'warning'" show-icon :message="stock.exhausted ? '口令词库已用完，请上传新词语' : `未使用口令仅剩 ${stock.remaining} 条，请及时补充`" style="margin-bottom:20px" />
      <section>
        <h3>阶梯奖励</h3>
        <p>每天每人只能领取一次；每日输错 3 次后，当天不可再领取。会员按基础奖励的 2 倍发放。</p>
        <div class="reward-fields">
          <label>首档人数<a-input-number v-model:value="config.firstCount" :min="0" :max="1000000" :precision="0" :disabled="disabled" addon-after="人" /></label>
          <label>前 {{ config.firstCount }} 名<a-input-number v-model:value="config.firstReward" :min="0" :max="1000000" :precision="8" :step="0.1" :disabled="disabled" addon-after="FLP" /></label>
          <label>第 {{ (config.firstCount || 0) + 1 }} 名起<a-input-number v-model:value="config.laterReward" :min="0" :max="1000000" :precision="8" :step="0.1" :disabled="disabled" addon-after="FLP" /></label>
        </div>
        <a-button type="primary" :disabled="disabled" :loading="saving" @click="saveConfig">保存奖励配置</a-button>
      </section>
      <section>
        <h3>今日口令 · {{ date }}</h3>
        <p>北京时间每天 00:00 从词库选词，词语本身就是口令。今日累计发放 {{ claimedCount }} 次。</p>
        <a-form layout="vertical">
          <a-form-item label="词语 / 今日口令"><a-input v-model:value="today.word" :maxlength="32" :disabled="disabled" placeholder="例如：爽飞" /></a-form-item>
          <a-form-item label="领取后展示的讲解正文"><a-textarea v-model:value="today.explanation" :rows="3" :maxlength="2000" :disabled="disabled" /></a-form-item>
          <a-space><a-button type="primary" :disabled="disabled" :loading="saving" @click="saveToday">保存今日口令</a-button><a-button danger :disabled="disabled" :loading="saving" @click="resetClaims">重置领取</a-button></a-space>
        </a-form>
      </section>
      <section>
        <h3>提示词库 · {{ wordCount }} 条<span v-if="stock"> · 未使用 {{ stock.remaining }} 条</span></h3>
        <p>上传 .xlsx 文件，第一行依次为：序号、词语、讲解正文。最多 10000 条、2MB；整份校验通过后替换词库。</p>
        <p>每天从未使用词语中选取一条。已用过的词语再次上传也不会重新参与自动选词；用完后暂停生成，请补充新的词语。</p>
        <div class="upload-actions"><a-button @click="downloadTemplate">下载模板</a-button><a-button :disabled="disabled" :loading="saving" @click="fileInput?.click()">上传词库</a-button><a-button type="primary" :disabled="disabled || wordsLoading" @click="openWordEditor()">新增词语</a-button></div>
        <input ref="fileInput" type="file" accept=".xlsx" hidden @change="chooseFile" />
        <a-alert v-if="wordsError" type="error" show-icon :message="wordsError" style="margin-bottom:12px"><template #action><a-button :disabled="disabled" @click="loadWords()">重试</a-button></template></a-alert>
        <a-table :columns="columns" :data-source="words" :loading="wordsLoading" row-key="serial" :pagination="pagination" size="small" :scroll="{ x: 750 }" @change="onTableChange">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'used'"><a-tag :color="record.used ? 'default' : 'green'">{{ record.used ? '已使用' : '未使用' }}</a-tag></template>
            <template v-else-if="column.key === 'actions'"><a-button type="link" size="small" :disabled="disabled || wordsLoading" @click="openWordEditor(record)">编辑</a-button></template>
            <template v-else><span style="white-space:pre-wrap;overflow-wrap:anywhere">{{ record[column.dataIndex] }}</span></template>
          </template>
        </a-table>
      </section>
    </a-spin>
    <a-modal v-model:open="editorOpen" :title="originalSerial == null ? '新增词语' : '编辑词语'" ok-text="保存" cancel-text="取消" :confirm-loading="wordSaving" :closable="!wordSaving" :mask-closable="!wordSaving" :keyboard="!wordSaving" :cancel-button-props="{ disabled: wordSaving }" @ok="saveWord">
      <a-form layout="vertical">
        <a-form-item label="序号"><a-input-number v-model:value="wordForm.serial" :min="1" :max="2147483647" :precision="0" :disabled="wordSaving" :placeholder="originalSerial == null ? '留空自动分配' : '留空保留当前序号'" style="width:100%" /></a-form-item>
        <a-form-item label="词语 / 口令" required><a-input v-model:value="wordForm.word" :maxlength="32" :disabled="wordSaving" /></a-form-item>
        <a-form-item label="讲解正文" required><a-textarea v-model:value="wordForm.explanation" :rows="5" :maxlength="2000" :disabled="wordSaving" show-count /></a-form-item>
      </a-form>
      <p>修改词库不会改变已经发布的今日口令；需要更改今天的内容，请在「今日口令」中修改。</p>
    </a-modal>
  </a-card>
</template>

<style scoped>
.passphrase-settings{margin-top:24px}section+section{border-top:1px solid #eee;margin-top:24px;padding-top:24px}h3{font-size:16px;margin:0 0 10px}p{color:#888;font-size:13px;line-height:1.7}.reward-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin:16px 0}.reward-fields label{display:flex;flex-direction:column;gap:8px}.upload-actions{display:flex;gap:12px;margin:16px 0}@media(max-width:700px){.reward-fields{grid-template-columns:1fr}}
</style>
