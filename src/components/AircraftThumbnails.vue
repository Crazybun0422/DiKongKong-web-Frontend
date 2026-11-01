<script setup>
import { onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import http from '../services/http'
const catalog = ref({ version: '', aircraft: [] })
const file = ref(null), busy = ref(false)
const endpoint = '/config/aircraft-thumbnails'
const unwrap = value => value?.data?.data ?? value?.data ?? value
const imageUrl = path => path?.startsWith('/api/') ? String(http.defaults.baseURL || '/api').replace(/\/api\/?$/, '') + path : path
async function load() {
  try { catalog.value = unwrap(await http.get(endpoint + '/admin')) }
  catch (e) { message.error(e.message || '机型缩略图加载失败') }
}
async function upload() {
  if (!file.value) return message.warning('请选择缩略图 ZIP')
  busy.value = true
  try {
    const body = new FormData(); body.append('file', file.value)
    catalog.value = unwrap(await http.post(endpoint, body, { timeout: 180000 }))
    file.value = null; message.success('机型缩略图已更新')
  } catch (e) { message.error(e.response?.data?.message?.zh || e.message || '上传失败') }
  finally { busy.value = false }
}
onMounted(load)
</script>
<template>
  <section class="aircraft-thumbnails">
    <h3>机型缩略图</h3>
    <p>上传包含 manifest.json、128/、1024/ 的透明 PNG 资源 ZIP（最大 96 MB）。客户端仅加载 128×128，1024×1024 保留在后端，可通过链接查看。</p>
    <a-alert :message="`当前版本：${catalog.version || '未上传'} · ${catalog.aircraft.length} 个机型`" type="info" show-icon />
    <form @submit.prevent="upload">
      <input type="file" accept=".zip,application/zip" :disabled="busy" @change="file = $event.target.files?.[0] || null" />
      <a-button type="primary" html-type="submit" :loading="busy">上传缩略图压缩包</a-button>
    </form>
    <a-table :data-source="catalog.aircraft" row-key="slug" :pagination="{ pageSize: 12 }" :scroll="{ x: 530 }">
      <a-table-column title="机型" data-index="name" />
      <a-table-column title="标识" data-index="slug" />
      <a-table-column title="128×128"><template #default="{ record }"><img :src="imageUrl(record.thumbnail128)" width="64" height="64" :alt="record.name" /></template></a-table-column>
      <a-table-column title="1024×1024"><template #default="{ record }"><a v-if="record.thumbnail1024" :href="imageUrl(record.thumbnail1024)" target="_blank" rel="noopener">查看原图</a><span v-else>未上传</span></template></a-table-column>
    </a-table>
  </section>
</template>
<style scoped>
.aircraft-thumbnails{padding:20px;max-width:1100px}p{color:#687080}form{display:flex;flex-wrap:wrap;gap:16px;margin:24px 0}input{max-width:100%}img{object-fit:contain;vertical-align:middle}
</style>
