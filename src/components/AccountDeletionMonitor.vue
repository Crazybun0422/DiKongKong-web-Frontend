<script setup>
import { ref } from 'vue'
import http from '../services/http'
const open = ref(false), busy = ref(false), error = ref(''), jobs = ref([]), code = ref(''), inventory = ref(null)
const columns = [{ title: '低空号', dataIndex: 'feature_code' }, { title: '处理状态', dataIndex: 'state' }, { title: '重试次数', dataIndex: 'attempts' }, { title: '错误代码', dataIndex: 'error_code' }, { title: '更新时间', dataIndex: 'updated_at' }]
async function load(path, target) {
  if (busy.value) return
  busy.value = true; error.value = ''
  try { const response = await http.get(path); if (!response.data?.success) throw new Error(response.data?.message?.zh || '加载失败'); target.value = response.data.data }
  catch (e) { error.value = e.response?.data?.message?.zh || e.message || '加载失败，请重试' }
  finally { busy.value = false }
}
function show() { open.value = true; load('/auth/account-deletions', jobs) }
function refreshJobs() { return load('/auth/account-deletions', jobs) }
function inspectResources() { return load('/auth/account-deletions/inventory/' + encodeURIComponent(code.value), inventory) }
</script>
<template>
  <a-button @click="show">注销处理记录</a-button>
  <a-drawer v-model:open="open" title="账户注销处理" width="min(880px, 95vw)">
    <a-alert type="warning" show-icon message="此处仅用于查看清理进度和资源核验，不会替用户注销账户。" description="存在历史未记录归属的文件、未完成款项或工作组时，必须先处理。不要通过手动删除用户表来绕过检查。" />
    <a-alert v-if="error" style="margin-top:16px" type="error" :message="error" />
    <a-space style="margin:20px 0"><a-input v-model:value="code" placeholder="输入低空号核对资源" :maxlength="6" /><a-button :loading="busy" :disabled="code.length !== 6" @click="inspectResources">查询资源</a-button><a-button :loading="busy" @click="refreshJobs">刷新任务</a-button></a-space>
    <div v-if="inventory" class="inventory"><p>账户：{{ inventory.featureCode }}</p><p>标记 {{ inventory.counts.pins }} · 商户 {{ inventory.counts.markers }} · 动态 {{ inventory.counts.broadcasts }} · 已登记文件 {{ inventory.counts.files }}</p><p v-for="item in inventory.blockers" :key="item">{{ item }}</p><details v-if="inventory.unresolvedFiles.length"><summary>待核验的历史文件（{{ inventory.unresolvedFiles.length }}）</summary><p v-for="file in inventory.unresolvedFiles" :key="file">{{ file }}</p></details></div>
    <a-table :columns="columns" :data-source="jobs" row-key="id" :loading="busy" :pagination="{ pageSize: 10 }" :scroll="{ x: 700 }" />
    <p>PREPARED：尚未提交；QUEUED：已停用、等待清理；RETRY：保留任务重试；COMPLETE：已清理。完成记录不再保留低空号。</p>
  </a-drawer>
</template>
<style scoped>.inventory { margin-bottom:20px;padding:16px;background:#f5f6f8;overflow-wrap:anywhere; }.inventory p { margin:8px 0; }</style>
