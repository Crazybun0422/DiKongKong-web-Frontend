<script setup>
import { onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import http from '../services/http'
const catalog = ref({ activeVersion: '', releases: [] })
const file = ref(null), version = ref(''), busy = ref(false)
const unwrap = value => value?.data?.data ?? value?.data ?? value
const endpoint = '/config/drone-flight-resources'
async function load() {
  try { catalog.value = unwrap(await http.get(endpoint)) }
  catch (e) { message.error(e.message || '资源版本加载失败') }
}
async function upload() {
  if (!file.value || !version.value.trim()) return message.warning('请选择资源 ZIP 并填写版本号')
  busy.value = true
  try {
    const data = new FormData(); data.append('file', file.value); data.append('version', version.value.trim())
    await http.post(endpoint, data, { timeout: 180000 })
    message.success('资源已上传，请在版本列表中启用'); file.value = null; version.value = ''; await load()
  } catch (e) { message.error(e.message || '上传失败') } finally { busy.value = false }
}
async function activate(value) {
  busy.value = true
  try { await http.post(endpoint + '/activate', { version: value }); await load(); message.success('已切换资源版本，客户端下次进入游戏时自动加载') }
  catch (e) { message.error(e.message || '版本切换失败') } finally { busy.value = false }
}
onMounted(load)
</script>

<template>
  <section class="drone-resources">
    <h3>涂鸦飞行资源</h3>
    <p>上传完整 ZIP，同时管理 Android 和小程序资源。客户端进入游戏时自动检查版本、下载并解压，历史版本可重新启用。</p>
    <a-alert :message="`当前启用：${catalog.activeVersion || '尚未启用资源版本'}`" type="info" show-icon />
    <a-form :model="{ file, version }" layout="vertical" @finish="upload">
      <a-form-item label="资源压缩包"><input type="file" accept=".zip,application/zip" :disabled="busy" @change="file = $event.target.files?.[0] || null" /><small>选择编译生成的 drone-flight-v21-*.zip（同时包含两端资源），最大 40 MB。</small></a-form-item>
      <a-form-item label="资源版本"><a-input v-model:value="version" placeholder="例如 21.2.0" :disabled="busy" /></a-form-item>
      <a-button type="primary" html-type="submit" :loading="busy">上传新版本</a-button>
      <a-button :disabled="busy" @click="load">刷新</a-button>
    </a-form>
    <a-table :data-source="catalog.releases" row-key="version" :pagination="{ pageSize: 8 }">
      <a-table-column title="版本" data-index="version" />
      <a-table-column title="上传时间" data-index="createdAt" />
      <a-table-column title="资源大小"><template #default="{ record }">Android {{ (record.packages.android.size / 1048576).toFixed(2) }} MB · 小程序 {{ (record.packages.mini.size / 1048576).toFixed(2) }} MB</template></a-table-column>
      <a-table-column title="操作"><template #default="{ record }"><a-tag v-if="record.version === catalog.activeVersion" color="green">使用中</a-tag><a-button v-else :disabled="busy" @click="activate(record.version)">启用此版本</a-button></template></a-table-column>
    </a-table>
  </section>
</template>

<style scoped>
.drone-resources { padding: 20px; max-width: 1100px; } p, small { color: #687080; } small { display: block; margin-top: 8px; } form { margin: 24px 0; max-width: 620px; } button + button { margin-left: 12px; }
</style>
